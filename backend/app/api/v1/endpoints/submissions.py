import json
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.submission import Submission
from app.models.question_grade import QuestionGrade
from app.models.assessment import Assessment
from app.models.assessment_attempt import AssessmentAttempt
from app.schemas.grading import (
    SubmissionDetailResponse, QuestionGradeDetail, AnnotationItem,
    DeductedPointItem, ManualGradeOverrideRequest, AIInstructionRequest, AIRevisionResponse
)
from app.api.deps import get_current_teacher, get_current_user
from app.services.grading_engine import GradingEngine

router = APIRouter()

def serialize_submission(sub: Submission, db: Session) -> Dict[str, Any]:
    assessment = db.query(Assessment).filter(Assessment.id == sub.assessment_id).first()
    student = db.query(User).filter(User.id == sub.student_id).first()

    grades_by_qid = {qg.question_id: qg for qg in sub.question_grades}
    grades_list = []

    questions = assessment.questions if assessment else []
    if not questions and sub.question_grades:
        questions = [qg.question for qg in sub.question_grades if qg.question]

    for idx, q in enumerate(sorted(questions, key=lambda x: x.order_index if x else 1), start=1):
        if not q:
            continue
        qg = grades_by_qid.get(q.id)
        if qg:
            try:
                correct = json.loads(qg.correct_points) if qg.correct_points else []
            except Exception:
                correct = []

            try:
                deductions_raw = json.loads(qg.deducted_points) if qg.deducted_points else []
                deductions = [DeductedPointItem(**item) if isinstance(item, dict) else DeductedPointItem(issue=str(item), reason="", penalty=-1.0) for item in deductions_raw]
            except Exception:
                deductions = []

            try:
                annotations_raw = json.loads(qg.annotations) if qg.annotations else []
                annotations = [AnnotationItem(**item) if isinstance(item, dict) else AnnotationItem(label=str(item), bbox=[]) for item in annotations_raw]
            except Exception:
                annotations = []

            grades_list.append(QuestionGradeDetail(
                id=qg.id,
                question_id=qg.question_id,
                question_text=q.text,
                order_index=q.order_index,
                marks_awarded=qg.marks_awarded,
                preliminary_marks_awarded=qg.preliminary_marks_awarded if qg.preliminary_marks_awarded is not None else qg.marks_awarded,
                revised_marks_awarded=qg.revised_marks_awarded,
                final_marks_awarded=qg.final_marks_awarded,
                marks_total=q.marks,
                confidence_score=qg.confidence_score,
                correct_points=correct,
                deducted_points=deductions,
                annotations=annotations,
                improvement_tip=qg.improvement_tip,
                ai_revision_notes=qg.ai_revision_notes,
                extracted_answer_text=qg.extracted_answer_text
            ))
        else:
            grades_list.append(QuestionGradeDetail(
                id=f"qg-temp-{q.id}",
                question_id=q.id,
                question_text=q.text,
                order_index=q.order_index,
                marks_awarded=0.0,
                preliminary_marks_awarded=0.0,
                revised_marks_awarded=None,
                final_marks_awarded=None,
                marks_total=q.marks,
                confidence_score=0.9,
                correct_points=[],
                deducted_points=[],
                annotations=[],
                improvement_tip="",
                ai_revision_notes=None,
                extracted_answer_text=""
            ))

    return {
        "id": sub.id,
        "attempt_id": sub.attempt_id,
        "assessment_id": sub.assessment_id,
        "assessment_title": assessment.title if assessment else "Assessment",
        "subject": assessment.subject if assessment else "General",
        "student_id": sub.student_id,
        "student_name": student.name if student else "Student",
        "student_email": student.email if student else "",
        "file_path": sub.file_path,
        "status": sub.status,
        "overall_score": sub.overall_score,
        "preliminary_score": sub.preliminary_score if sub.preliminary_score is not None else sub.overall_score,
        "revised_score": sub.revised_score,
        "final_score": sub.final_score,
        "total_marks": assessment.total_marks if assessment else 100,
        "avg_confidence": sub.avg_confidence,
        "ai_summary_en": sub.ai_summary_en,
        "ai_summary_ur": sub.ai_summary_ur,
        "ai_revision_notes": sub.ai_revision_notes,
        "graded_at": sub.graded_at,
        "question_grades": grades_list
    }

@router.get("", response_model=List[Dict[str, Any]])
def list_teacher_submissions(
    assessment_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """
    Returns all submissions for assessments created by this teacher.
    """
    teacher_assessments = db.query(Assessment).filter(Assessment.teacher_id == current_user.id).all()
    teacher_assessment_ids = [a.id for a in teacher_assessments]

    if not teacher_assessment_ids:
        return []

    query = db.query(Submission).filter(Submission.assessment_id.in_(teacher_assessment_ids))
    if assessment_id:
        query = query.filter(Submission.assessment_id == assessment_id)

    submissions = query.order_by(Submission.graded_at.desc()).all()
    return [serialize_submission(s, db) for s in submissions]

@router.get("/active-attempts", response_model=List[Dict[str, Any]])
def list_active_attempts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """
    Returns in-progress exam attempts with blur violation counts for teacher monitoring.
    """
    teacher_assessments = db.query(Assessment).filter(Assessment.teacher_id == current_user.id).all()
    ids = [a.id for a in teacher_assessments]

    attempts = db.query(AssessmentAttempt).filter(
        AssessmentAttempt.assessment_id.in_(ids),
        AssessmentAttempt.status == "in_progress"
    ).all()

    result = []
    for att in attempts:
        student = db.query(User).filter(User.id == att.student_id).first()
        assess = next((a for a in teacher_assessments if a.id == att.assessment_id), None)
        blur_count = len(json.loads(att.blur_events)) if att.blur_events else 0
        result.append({
            "attempt_id": att.id,
            "student_id": att.student_id,
            "student_name": student.name if student else "Student",
            "assessment_id": att.assessment_id,
            "assessment_title": assess.title if assess else "Assessment",
            "started_at": att.started_at,
            "extended_seconds": att.extended_seconds,
            "blur_events_count": blur_count
        })
    return result

@router.get("/{submission_id}", response_model=SubmissionDetailResponse)
def get_submission_detail(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    return serialize_submission(submission, db)

@router.post("/{submission_id}/instruct-ai", response_model=AIRevisionResponse)
async def instruct_ai_revision(
    submission_id: str,
    data: AIInstructionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """
    Teacher gives instructions to the AI to re-evaluate or modify marks.
    Returns proposed revision with explanation without making it official.
    """
    if not data.instruction.strip():
        raise HTTPException(status_code=400, detail="Instruction cannot be empty.")

    try:
        result = await GradingEngine.instruct_ai_revision(
            db=db,
            submission_id=submission_id,
            instruction=data.instruction.strip(),
            question_id=data.question_id
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI revision failed: {str(e)}")

@router.post("/{submission_id}/accept-ai-revision")
def accept_ai_revision(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """
    Teacher accepts the AI's revised score and applies it as current working marks.
    """
    try:
        sub = GradingEngine.accept_ai_revision(db, submission_id)
        return {"status": "success", "overall_score": sub.overall_score}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{submission_id}/reject-ai-revision")
def reject_ai_revision(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """
    Teacher rejects the AI's revised score proposal.
    """
    try:
        sub = GradingEngine.reject_ai_revision(db, submission_id)
        return {"status": "success", "overall_score": sub.overall_score}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{submission_id}/publish-grades")
def publish_submission_grades(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """Teacher confirms and finalizes grades, making official score visible to student."""
    try:
        sub = GradingEngine.finalize_submission(db, submission_id)
        return {
            "status": "success",
            "message": "Grades finalized and published to student successfully.",
            "final_score": sub.final_score
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{submission_id}/finalize-grades")
def finalize_submission_grades(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """Explicit alias for final score approval."""
    try:
        sub = GradingEngine.finalize_submission(db, submission_id)
        return {
            "status": "success",
            "message": "Official final score saved and published.",
            "final_score": sub.final_score
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{submission_id}/override-grades")
def override_question_grades(
    submission_id: str,
    data: ManualGradeOverrideRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """Teacher manually adjusts awarded marks for individual questions."""
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    total = 0.0
    for qg in submission.question_grades:
        if qg.id in data.question_grades:
            new_score = max(0.0, min(data.question_grades[qg.id], qg.marks_total))
            qg.marks_awarded = new_score
        total += qg.marks_awarded

    submission.overall_score = total
    if submission.status != "published":
        submission.status = "under_review"
    db.commit()
    return {"status": "success", "overall_score": total}
