import secrets
import string
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.assessment import Assessment
from app.models.question import Question
from app.models.rubric import RubricKeyPoint, RubricDeduction
from app.schemas.assessment import (
    AssessmentCreate, AssessmentUpdate, AssessmentResponse,
    QuestionExtractResponse, RubricExtractResponse,
    RubricGenerateRequest, RubricGenerateResponse,
    BulkAnswerKeyResponse
)
from app.api.deps import get_current_user, get_current_teacher
from app.services.gemini_vision import GeminiVisionService

router = APIRouter()

def generate_short_token(length: int = 6) -> str:
    prefix = "".join(secrets.choice(string.ascii_uppercase) for _ in range(2))
    num = "".join(secrets.choice(string.digits) for _ in range(3))
    return f"{prefix}-{num}"

@router.post("/extract-questions", response_model=QuestionExtractResponse)
async def extract_questions_from_upload(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_teacher)
):
    """
    Extracts candidate questions and mark allocations from an uploaded question paper image or PDF.
    Uses Gemini Vision OCR. Supports PNG, JPG, WEBP, and PDF.
    """
    content = await file.read()
    mime_type = file.content_type or "image/png"
    try:
        result = await GeminiVisionService.extract_questions(content, mime_type=mime_type)
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.post("/extract-rubric", response_model=RubricExtractResponse)
async def extract_rubric_from_upload(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_teacher)
):
    """
    Extracts expected key points and deduction rules from an uploaded marking scheme / answer key.
    Uses Gemini Vision OCR. Supports PNG, JPG, WEBP, and PDF.
    """
    content = await file.read()
    mime_type = file.content_type or "image/png"
    try:
        result = await GeminiVisionService.extract_rubric(content, mime_type=mime_type)
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.post("/extract-diagrams")
async def extract_diagrams_from_upload(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_teacher)
):
    """
    Detects and crops embedded diagrams, figures, charts, and tables
    from an uploaded exam paper image or PDF. Returns image URLs for each
    detected visual asset that can be linked to MCQ items.
    """
    content = await file.read()
    mime_type = file.content_type or "image/png"
    try:
        from app.services.diagram_extractor import extract_diagrams_from_image, extract_diagrams_from_pdf
        if mime_type == "application/pdf":
            diagrams = await extract_diagrams_from_pdf(content)
        else:
            diagrams = await extract_diagrams_from_image(content, mime_type=mime_type)
        return {
            "success": True,
            "diagrams": diagrams,
            "count": len(diagrams),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Diagram extraction failed: {str(e)}")


@router.post("/generate-rubric", response_model=RubricGenerateResponse)
async def generate_rubric_for_question(
    data: RubricGenerateRequest,
    current_user: User = Depends(get_current_teacher)
):
    """
    Generates an AI-powered, question-specific marking rubric (key_points & deductions)
    tailored to the exact question text, question type, subject, and marks.
    """
    try:
        result = await GeminiVisionService.generate_rubric_for_question(
            question_text=data.question_text,
            marks_total=data.marks,
            question_type=data.question_type,
            subject=data.subject,
            options=data.options,
            correct_answer=data.correct_answer
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate rubric: {str(e)}")

@router.post("/extract-answer-key", response_model=BulkAnswerKeyResponse)
async def extract_bulk_answer_key(
    file: UploadFile = File(...),
    questions: str = Form(...),
    current_user: User = Depends(get_current_teacher)
):
    """
    Extracts rubrics (key_points and deductions) for ALL questions from a single answer key document.
    The 'questions' form field should contain a JSON array of question objects.
    """
    import json as json_module
    try:
        questions_list = json_module.loads(questions)
        if not isinstance(questions_list, list) or len(questions_list) == 0:
            raise HTTPException(status_code=400, detail="Questions must be a non-empty JSON array.")
    except json_module.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON in 'questions' field.")

    content = await file.read()
    mime_type = file.content_type or "image/png"
    try:
        result = await GeminiVisionService.extract_bulk_answer_key(
            image_bytes=content,
            questions=questions_list,
            mime_type=mime_type
        )
        return result
    except RuntimeError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract answer key: {str(e)}")

def serialize_assessment(a: Assessment) -> dict:
    import json
    questions_list = []
    for q in a.questions:
        opts = []
        if getattr(q, 'options', None):
            try:
                opts = json.loads(q.options) if isinstance(q.options, str) else q.options
            except Exception:
                opts = []
        level_bands_data = None
        if getattr(q, 'level_bands', None):
            level_bands_data = q.level_bands if isinstance(q.level_bands, list) else None
        questions_list.append({
            "id": q.id,
            "order_index": q.order_index,
            "text": q.text,
            "marks": q.marks,
            "question_type": getattr(q, 'question_type', 'short') or 'short',
            "answer_lines": getattr(q, 'answer_lines', 4) or 4,
            "options": opts or [],
            "correct_answer": getattr(q, 'correct_answer', None),
            "marking_scheme": getattr(q, 'marking_scheme', None),
            "level_bands": level_bands_data,
            "diagram_image_url": getattr(q, 'diagram_image_url', None),
            "key_points": [
                {
                    "id": kp.id,
                    "text": kp.text,
                    "points": kp.points,
                    "is_mandatory_keyword": getattr(kp, 'is_mandatory_keyword', False),
                    "formatting": getattr(kp, 'formatting', None),
                }
                for kp in q.key_points
            ],
            "deductions": [{"id": d.id, "error_condition": d.error_condition, "penalty": d.penalty} for d in q.deductions],
        })

    return {
        "id": a.id,
        "teacher_id": a.teacher_id,
        "teacher_name": a.teacher.name if a.teacher else "Instructor",
        "title": a.title,
        "subject": a.subject,
        "total_marks": a.total_marks,
        "duration_minutes": a.duration_minutes,
        # Return tz-aware UTC so the API emits an explicit offset ("...Z"/"+00:00").
        # SQLite stores naive datetimes; emitting them without a timezone marker
        # makes JS clients parse the value as LOCAL time, shifting each assessment's
        # deadline by the viewer's UTC offset.
        "due_date": a.due_date.replace(tzinfo=timezone.utc) if a.due_date else None,
        "share_token": a.share_token,
        "status": a.status,
        "created_at": a.created_at,
        "questions": questions_list
    }

@router.post("", response_model=AssessmentResponse)
def create_assessment(
    data: AssessmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """Creates a new assessment in draft or configured state."""
    import json
    # Generate unique share token
    share_token = generate_short_token()
    while db.query(Assessment).filter(Assessment.share_token == share_token).first():
        share_token = generate_short_token()

    assessment = Assessment(
        teacher_id=current_user.id,
        title=data.title,
        subject=data.subject,
        total_marks=data.total_marks,
        duration_minutes=data.duration_minutes,
        due_date=data.due_date,
        share_token=share_token,
        status="draft"
    )
    db.add(assessment)
    db.flush()

    if data.questions:
        for idx, q_data in enumerate(data.questions, start=1):
            opts_str = json.dumps(q_data.options) if q_data.options else "[]"
            level_bands_json = None
            if q_data.level_bands:
                level_bands_json = [lb.model_dump() for lb in q_data.level_bands]
            question = Question(
                assessment_id=assessment.id,
                order_index=idx,
                text=q_data.text,
                marks=q_data.marks,
                question_type=q_data.question_type or "short",
                answer_lines=q_data.answer_lines if q_data.answer_lines is not None else 4,
                options=opts_str,
                correct_answer=q_data.correct_answer,
                marking_scheme=q_data.marking_scheme,
                level_bands=level_bands_json,
                diagram_image_url=q_data.diagram_image_url
            )
            db.add(question)
            db.flush()

            for kp in q_data.key_points:
                db.add(RubricKeyPoint(
                    question_id=question.id,
                    text=kp.text,
                    points=kp.points,
                    is_mandatory_keyword=getattr(kp, 'is_mandatory_keyword', False),
                    formatting=getattr(kp, 'formatting', None)
                ))
            for d in q_data.deductions:
                db.add(RubricDeduction(
                    question_id=question.id,
                    error_condition=d.error_condition,
                    penalty=-abs(d.penalty)  # Ensure negative
                ))

    db.commit()
    db.refresh(assessment)
    return serialize_assessment(assessment)

@router.get("", response_model=List[AssessmentResponse])
def list_teacher_assessments(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists assessments created by teacher or available to enrolled student."""
    if current_user.role == "teacher":
        assessments = db.query(Assessment).filter(Assessment.teacher_id == current_user.id).order_by(Assessment.created_at.desc()).all()
    else:
        assessments = db.query(Assessment).filter(Assessment.status == "published").order_by(Assessment.created_at.desc()).all()
    return [serialize_assessment(a) for a in assessments]

@router.get("/{assessment_id}", response_model=AssessmentResponse)
def get_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return serialize_assessment(assessment)

@router.post("/{assessment_id}/publish", response_model=AssessmentResponse)
def publish_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """
    Publishes and locks the assessment, generating the final shareable link.
    Once published, the assessment is immutable.
    """
    assessment = db.query(Assessment).filter(
        Assessment.id == assessment_id,
        Assessment.teacher_id == current_user.id
    ).first()

    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    assessment.status = "published"
    db.commit()
    db.refresh(assessment)
    return serialize_assessment(assessment)
