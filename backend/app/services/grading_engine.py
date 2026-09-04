import json
import asyncio
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.submission import Submission
from app.models.question import Question
from app.models.question_grade import QuestionGrade
from app.models.assessment import Assessment
from app.services.gemini_vision import GeminiVisionService
from app.services.semantic_evaluator import SemanticEvaluator
from app.services.storage import get_full_path

class GradingEngine:
    @staticmethod
    async def grade_submission(
        db: Session,
        submission_id: str,
        typed_answers: Optional[Dict[str, str]] = None
    ) -> Submission:
        """
        Grades an entire submission question-by-question using Gemini AI.
        Supports handwritten image/PDF uploads, portal typed answers, or both.
        Stores QuestionGrades, computes total score and average confidence,
        and sets submission status to 'published', 'needs_review', or 'grading_error'.
        """
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            raise ValueError(f"Submission {submission_id} not found")

        assessment = db.query(Assessment).filter(Assessment.id == submission.assessment_id).first()
        if not assessment:
            raise ValueError("Associated assessment not found")

        # Load file bytes if available
        full_path = get_full_path(submission.file_path) if submission.file_path else None
        image_bytes = b""
        mime_type = "image/png"
        if full_path and full_path.exists():
            with open(full_path, "rb") as f:
                image_bytes = f.read()
            if full_path.suffix.lower() == ".pdf":
                mime_type = "application/pdf"
            elif full_path.suffix.lower() in [".jpg", ".jpeg"]:
                mime_type = "image/jpeg"
            elif full_path.suffix.lower() == ".webp":
                mime_type = "image/webp"
            elif full_path.suffix.lower() == ".txt":
                mime_type = "text/plain"

        # ---- Pre-OCR: Extract text from image ONCE for all questions ----
        # Gemini OCR is fast (2-5s), accurate for all languages. Runs once here
        # and shared across all questions (avoids redundant API calls).
        pre_extracted_ocr_text = ""
        if image_bytes and mime_type != "text/plain":
            try:
                from app.services.ocr_service import extract_student_answer_text
                import logging as _logging
                _ge_logger = _logging.getLogger("evalassist.grading_engine")
                _ge_logger.info("grading_engine: Pre-OCR: Extracting text from image via Gemini...")
                pre_extracted_ocr_text = await asyncio.wait_for(
                    extract_student_answer_text(image_bytes, mime_type),
                    timeout=30.0,
                )
                _ge_logger.info(
                    f"grading_engine: Pre-OCR extracted {len(pre_extracted_ocr_text)} chars"
                )
            except asyncio.TimeoutError:
                import logging as _logging
                _logging.getLogger("evalassist.grading_engine").warning(
                    "grading_engine: Pre-OCR timed out after 30s. Will fall back to per-question Gemini OCR."
                )
            except Exception as e:
                import logging as _logging
                _logging.getLogger("evalassist.grading_engine").warning(
                    f"grading_engine: Pre-OCR failed: {e}. Will fall back to per-question Gemini OCR."
                )

        total_awarded = 0.0
        total_possible = 0.0
        confidences = []
        summary_en_parts = []
        summary_ur_parts = []

        # Clear existing question grades if re-grading
        db.query(QuestionGrade).filter(QuestionGrade.submission_id == submission.id).delete()

        total_q = len(assessment.questions)

        async def grade_single_question(q, q_index: int):
            key_points_data = [
                {
                    "text": kp.text,
                    "points": kp.points,
                    "is_mandatory_keyword": getattr(kp, 'is_mandatory_keyword', False),
                    "formatting": getattr(kp, 'formatting', None),
                }
                for kp in q.key_points
            ]
            deductions_data = [{"error_condition": d.error_condition, "penalty": d.penalty} for d in q.deductions]
            q_typed = typed_answers.get(q.id) if typed_answers else None
            q_number = q_index + 1  # 1-based question number

            # Extract marking scheme and level bands for holistic grading
            q_marking_scheme = getattr(q, 'marking_scheme', None)
            q_level_bands = getattr(q, 'level_bands', None)

            # 1. Deterministic MCQ grading (No LLM call needed)
            if getattr(q, 'question_type', 'short') == 'mcq':
                correct_ans = str(getattr(q, 'correct_answer', '') or '').strip()
                student_ans = str(q_typed or '').strip()

                is_correct = False
                if correct_ans and student_ans and student_ans not in ["[No option selected]", ""]:
                    c_low = correct_ans.lower()
                    s_low = student_ans.lower()
                    if c_low == s_low:
                        is_correct = True
                    else:
                        # Strip prefixes like (A), A), A., (B)
                        import re
                        c_clean = re.sub(r"^\(?[a-d0-9]\)?[\.\:\)]?\s*", "", c_low).strip()
                        s_clean = re.sub(r"^\(?[a-d0-9]\)?[\.\:\)]?\s*", "", s_low).strip()
                        if c_clean and s_clean and c_clean == s_clean:
                            is_correct = True
                        else:
                            # Match single option letter prefix
                            c_let = re.match(r"^\(?([a-d0-9])\)?", c_low)
                            s_let = re.match(r"^\(?([a-d0-9])\)?", s_low)
                            if c_let and s_let and c_let.group(1) == s_let.group(1):
                                is_correct = True

                marks_awarded = float(q.marks) if is_correct else 0.0
                return {
                    "q": q,
                    "result": {
                        "marks_awarded": marks_awarded,
                        "marks_total": q.marks,
                        "confidence_score": 1.0,
                        "correct_points": [f"Selected correct option: {q.correct_answer}"] if is_correct else [],
                        "deducted_points": [] if is_correct else [{
                            "issue": "Incorrect MCQ Option",
                            "reason": f"Selected '{q_typed or 'None'}', expected '{q.correct_answer or 'Configured Option'}'",
                            "concept": f"{assessment.subject} > Multiple Choice",
                            "penalty": -q.marks
                        }],
                        "annotations": [],
                        "improvement_tip": "Review the concept corresponding to this question." if not is_correct else "Correct selection.",
                        "extracted_answer_text": q_typed or "[No option selected]",
                        "ai_summary_en": f"MCQ graded deterministically: {'Correct (+%s)' % q.marks if is_correct else 'Incorrect (0/%s)' % q.marks}.",
                        "ai_summary_ur": f"کثیر الانتخابی سوال: {'درست' if is_correct else 'غلط'}"
                    },
                    "error": None
                }

            # 2. Short / Long Answer Grading via Groq (primary) + Gemini (fallback)
            try:
                # If we already have pre-extracted OCR text, pass it as typed_answer_text
                # and DON'T pass image_bytes (avoids re-running expensive OCR per question).
                # If pre-OCR failed, pass the raw image for per-question fallback.
                effective_typed = q_typed
                effective_image = image_bytes if image_bytes else None

                if pre_extracted_ocr_text:
                    # Merge pre-extracted OCR text with any typed answer
                    if effective_typed:
                        effective_typed = f"{effective_typed}\n\n[Handwritten Answer (OCR)]:\n{pre_extracted_ocr_text}"
                    else:
                        effective_typed = pre_extracted_ocr_text
                    effective_image = None  # Skip per-question OCR

                grade_result = await asyncio.wait_for(
                    GeminiVisionService.grade_answer(
                        question_id=q.id,
                        question_text=q.text,
                        marks_total=q.marks,
                        subject=assessment.subject,
                        key_points=key_points_data,
                        deductions=deductions_data,
                        image_bytes=effective_image,
                        mime_type=mime_type,
                        typed_answer_text=effective_typed,
                        expected_answer_summary=getattr(q, 'correct_answer', None),
                        correct_answer=getattr(q, 'correct_answer', None),
                        question_number=q_number,
                        total_questions=total_q,
                        marking_scheme=q_marking_scheme,
                        level_bands=q_level_bands,
                    ),
                    timeout=300.0
                )
                return {"q": q, "result": grade_result, "error": None}
            except asyncio.TimeoutError:
                import logging as _logging
                _logging.getLogger("evalassist.grading_engine").error(
                    f"grading_engine: Question {q.id} grading timed out after 300s"
                )
                # Fall through to semantic evaluator
                evaluated = SemanticEvaluator.evaluate_answer(
                    question_text=q.text,
                    marks_total=q.marks,
                    subject=assessment.subject,
                    key_points=key_points_data,
                    deductions=deductions_data,
                    student_answer=q_typed or pre_extracted_ocr_text or (
                        image_bytes.decode('utf-8', errors='ignore') if image_bytes and mime_type == 'text/plain' else "Answer submitted."
                    ),
                    expected_answer=getattr(q, 'correct_answer', None)
                )
                evaluated["question_id"] = q.id
                if q_typed and not evaluated.get("extracted_answer_text"):
                    evaluated["extracted_answer_text"] = q_typed
                return {"q": q, "result": evaluated, "error": None}
            except Exception as e:
                import logging as _logging
                _logging.getLogger("evalassist.grading_engine").error(
                    f"grading_engine: Question {q.id} grading failed: {e}"
                )
                # Semantic evaluation fallback: evaluates conceptual meaning and awards appropriate marks (never zero for valid answers)
                evaluated = SemanticEvaluator.evaluate_answer(
                    question_text=q.text,
                    marks_total=q.marks,
                    subject=assessment.subject,
                    key_points=key_points_data,
                    deductions=deductions_data,
                    student_answer=q_typed or (image_bytes.decode('utf-8', errors='ignore') if image_bytes and mime_type == 'text/plain' else "Answer submitted."),
                    expected_answer=getattr(q, 'correct_answer', None)
                )
                evaluated["question_id"] = q.id
                if q_typed and not evaluated.get("extracted_answer_text"):
                    evaluated["extracted_answer_text"] = q_typed
                return {"q": q, "result": evaluated, "error": None}


        results = await asyncio.gather(*[grade_single_question(q, i) for i, q in enumerate(assessment.questions)])

        for item in results:
            q = item["q"]
            grade_result = item["result"]
            awarded = float(grade_result.get("marks_awarded", 0.0))
            conf = float(grade_result.get("confidence_score", 0.85))
            total_awarded += awarded
            total_possible += q.marks
            confidences.append(conf)

            if grade_result.get("ai_summary_en"):
                summary_en_parts.append(grade_result["ai_summary_en"])
            if grade_result.get("ai_summary_ur"):
                summary_ur_parts.append(grade_result["ai_summary_ur"])

            # Store QuestionGrade
            extracted_ans = grade_result.get("extracted_answer_text") or (typed_answers.get(q.id) if typed_answers else "")
            q_grade = QuestionGrade(
                submission_id=submission.id,
                question_id=q.id,
                marks_awarded=awarded,
                preliminary_marks_awarded=awarded,
                marks_total=q.marks,
                confidence_score=conf,
                correct_points=json.dumps(grade_result.get("correct_points", [])),
                deducted_points=json.dumps(grade_result.get("deducted_points", [])),
                annotations=json.dumps(grade_result.get("annotations", [])),
                improvement_tip=grade_result.get("improvement_tip", ""),
                extracted_answer_text=extracted_ans
            )
            db.add(q_grade)

        avg_conf = sum(confidences) / len(confidences) if confidences else 0.0
        submission.preliminary_score = total_awarded
        submission.overall_score = total_awarded
        submission.avg_confidence = avg_conf

        # AI Evaluation produces preliminary marks which remain hidden from the student until teacher review & finalization.
        has_errors = any(item.get("error") for item in results) if results else False
        if has_errors and not any(item.get("result") for item in results):
            submission.status = "grading_error"
            submission.ai_summary_en = "AI grading encountered errors. Teacher review required."
            submission.ai_summary_ur = "AI درجہ بندی میں خرابی ہوئی۔ استاد کا جائزہ ضروری ہے۔"
        else:
            submission.status = "needs_review"  # Awaiting Teacher Review
            submission.ai_summary_en = summary_en_parts[0] if summary_en_parts else "AI preliminary evaluation complete. Awaiting teacher review."
            submission.ai_summary_ur = summary_ur_parts[0] if summary_ur_parts else "AI ابتدائی جائزہ مکمل۔ استاد کا جائزہ درکار ہے۔"

        submission.graded_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(submission)
        return submission

    @staticmethod
    async def instruct_ai_revision(
        db: Session,
        submission_id: str,
        instruction: str,
        question_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processes a teacher's instruction to re-evaluate or modify AI-generated marks.
        Stores the proposed revision without automatically finalizing it.
        """
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            raise ValueError(f"Submission {submission_id} not found")

        assessment = db.query(Assessment).filter(Assessment.id == submission.assessment_id).first()
        total_marks = assessment.total_marks if assessment else 100

        # Read image bytes if available
        image_bytes = None
        full_path = get_full_path(submission.file_path)
        if full_path.exists():
            with open(full_path, "rb") as f:
                image_bytes = f.read()

        # Build questions data
        questions_data = []
        for qg in submission.question_grades:
            q = qg.question
            questions_data.append({
                "id": qg.id,
                "question_id": qg.question_id,
                "order_index": q.order_index if q else 1,
                "text": q.text if q else "Question",
                "marks_total": qg.marks_total,
                "marks_awarded": qg.marks_awarded,
                "improvement_tip": qg.improvement_tip or "",
                "extracted_answer_text": qg.extracted_answer_text or ""
            })

        revision_result = await GeminiVisionService.revise_evaluation_with_instruction(
            questions_data=questions_data,
            overall_score=submission.overall_score,
            total_marks=float(total_marks),
            teacher_instruction=instruction,
            image_bytes=image_bytes
        )

        revised_score = revision_result["revised_overall_score"]
        ai_notes = revision_result["ai_revision_notes"]
        q_revisions = revision_result.get("question_revisions", {})

        # Store proposed revisions
        submission.revised_score = revised_score
        submission.ai_revision_notes = ai_notes
        if submission.status != "published":
            submission.status = "under_review"

        for qg in submission.question_grades:
            if qg.id in q_revisions:
                qg.revised_marks_awarded = q_revisions[qg.id]
                qg.ai_revision_notes = f"Revised from {qg.marks_awarded} to {q_revisions[qg.id]} per teacher instruction."

        db.commit()
        db.refresh(submission)

        return {
            "revised_score": revised_score,
            "ai_revision_notes": ai_notes,
            "question_grades": q_revisions
        }

    @staticmethod
    def accept_ai_revision(db: Session, submission_id: str) -> Submission:
        """
        Accepts the AI's revised score and applies it as current working marks.
        """
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            raise ValueError("Submission not found")

        if submission.revised_score is not None:
            submission.overall_score = submission.revised_score
            for qg in submission.question_grades:
                if qg.revised_marks_awarded is not None:
                    qg.marks_awarded = qg.revised_marks_awarded
            submission.revised_score = None

        db.commit()
        db.refresh(submission)
        return submission

    @staticmethod
    def reject_ai_revision(db: Session, submission_id: str) -> Submission:
        """
        Rejects the AI proposed revision, keeping prior scores intact.
        """
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            raise ValueError("Submission not found")

        submission.revised_score = None
        for qg in submission.question_grades:
            qg.revised_marks_awarded = None

        db.commit()
        db.refresh(submission)
        return submission

    @staticmethod
    def finalize_submission(db: Session, submission_id: str) -> Submission:
        """
        Finalizes and publishes the student's submission result.
        The teacher-approved score becomes the official single source of truth.
        """
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            raise ValueError("Submission not found")

        submission.final_score = submission.overall_score
        for qg in submission.question_grades:
            qg.final_marks_awarded = qg.marks_awarded

        submission.status = "published"
        db.commit()
        db.refresh(submission)
        return submission

