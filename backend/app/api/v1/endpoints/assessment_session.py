from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import uuid
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, BackgroundTasks
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.models.assessment import Assessment
from app.models.assessment_attempt import AssessmentAttempt
from app.models.submission import Submission
from app.schemas.grading import (
    AttemptStartResponse, AttemptStatusResponse, BlurEventLogRequest,
    AttemptExtendRequest
)
from app.api.deps import get_current_user, get_current_student, get_current_teacher
from app.services.session_manager import SessionManager
from app.services.storage import save_upload
from app.services.grading_engine import GradingEngine

router = APIRouter()

@router.post("/start/{assessment_id}", response_model=AttemptStartResponse)
def start_assessment_session(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student)
):
    """
    Initializes a timed exam attempt for a student.
    Enforces the single-attempt constraint.
    """
    assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    attempt = SessionManager.start_attempt(db, student_id=current_user.id, assessment_id=assessment_id)
    status_data = SessionManager.get_attempt_status(db, attempt.id)

    return {
        "attempt_id": attempt.id,
        "assessment_id": assessment.id,
        "started_at": attempt.started_at,
        "duration_seconds_snapshot": attempt.duration_seconds_snapshot,
        "extended_seconds": attempt.extended_seconds,
        "remaining_seconds": status_data["remaining_seconds"],
        "status": attempt.status,
        "assessment_title": assessment.title,
        "subject": assessment.subject,
        "total_marks": assessment.total_marks
    }

@router.get("/status/{attempt_id}", response_model=AttemptStatusResponse)
def get_attempt_status(
    attempt_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetches real-time server-computed timer and status.
    Prevents client-side refresh clock reset exploits.
    """
    return SessionManager.get_attempt_status(db, attempt_id)

@router.post("/extend", response_model=AttemptStatusResponse)
def extend_student_attempt(
    data: AttemptExtendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """
    Teacher adds additional time to an active or expired attempt.
    """
    attempt = SessionManager.extend_attempt(db, data.attempt_id, minutes=data.extend_minutes)
    return SessionManager.get_attempt_status(db, attempt.id)

@router.post("/log-blur/{attempt_id}")
def log_student_blur_event(
    attempt_id: str,
    data: BlurEventLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student)
):
    """
    Logs visibility changes / tab navigation away from the exam portal.
    """
    SessionManager.log_blur_event(db, attempt_id, event_type=data.event_type, details=data.details)
    return {"status": "logged"}

@router.post("/submit/{attempt_id}")
async def submit_assessment(
    attempt_id: str,
    file: Optional[UploadFile] = File(None),
    answers_json: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student)
):
    """
    Submits student's assessment work (via handwritten image/PDF upload, typed portal answers, or both).
    Locks attempt and executes automated grading.
    """
    attempt = db.query(AssessmentAttempt).filter(
        AssessmentAttempt.id == attempt_id,
        AssessmentAttempt.student_id == current_user.id
    ).first()

    if not attempt:
        raise HTTPException(status_code=404, detail="Attempt session not found")

    if attempt.status == "submitted":
        raise HTTPException(status_code=400, detail="This assessment has already been submitted.")

    # Hard-block submissions past the assessment due date (no grace period)
    assessment = db.query(Assessment).filter(Assessment.id == attempt.assessment_id).first()
    if assessment and assessment.due_date:
        due = assessment.due_date
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > due:
            attempt.status = "expired"
            db.commit()
            raise HTTPException(
                status_code=400,
                detail=f"The assessment deadline has passed (Due: {due.strftime('%b %d, %Y at %I:%M %p UTC')}). Submissions are no longer accepted."
            )

    # Check timer expiration with 120 seconds grace period
    status_data = SessionManager.get_attempt_status(db, attempt.id)
    if status_data["remaining_seconds"] <= -120:
        attempt.status = "expired"
        db.commit()
        raise HTTPException(status_code=400, detail="Time expired. Submissions are closed.")

    parsed_answers: Dict[str, str] = {}
    if answers_json:
        try:
            parsed_answers = json.loads(answers_json)
        except Exception:
            pass

    file_rel_path = ""
    if file and file.filename:
        file_rel_path = await save_upload(file, subfolder=f"submissions/{attempt.assessment_id}")
    else:
        # Save typed answers into a formatted submission text document
        upload_root = Path(settings.UPLOAD_DIR).resolve()
        sub_dir = upload_root / "submissions" / attempt.assessment_id
        sub_dir.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4().hex[:12]}_portal_submission.txt"
        dest = sub_dir / filename
        formatted_lines = [f"Student: {current_user.name} ({current_user.email})", "Typed Portal Answers:\n"]
        for q_id, ans_text in parsed_answers.items():
            formatted_lines.append(f"Question ID [{q_id}]:\n{ans_text}\n")
        dest.write_text("\n".join(formatted_lines), encoding="utf-8")
        file_rel_path = f"uploads/submissions/{attempt.assessment_id}/{filename}"

    # Mark attempt submitted
    attempt.status = "submitted"
    attempt.submitted_at = datetime.now(timezone.utc)

    # Create submission record
    submission = Submission(
        attempt_id=attempt.id,
        assessment_id=attempt.assessment_id,
        student_id=current_user.id,
        file_path=file_rel_path,
        status="processing",
        overall_score=0.0,
        avg_confidence=0.0
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    # Trigger grading with typed answers and/or uploaded document
    try:
        await GradingEngine.grade_submission(db, submission.id, typed_answers=parsed_answers)
    except Exception as e:
        import logging
        logging.getLogger("evalassist").error(f"Grading exception during submission {submission.id}: {e}")
        submission.status = "needs_review"
        submission.ai_summary_en = "Submission uploaded successfully and awaiting teacher review."
        db.commit()

    return {
        "status": "success",
        "submission_id": submission.id,
        "message": "Assessment submitted successfully. Evaluation complete."
    }
