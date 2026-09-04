import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException

from app.models.assessment import Assessment
from app.models.assessment_attempt import AssessmentAttempt
from app.models.submission import Submission
from app.models.user import User

class SessionManager:
    @staticmethod
    def start_attempt(db: Session, student_id: str, assessment_id: str) -> AssessmentAttempt:
        """
        Starts an attempt for a student on an assessment.
        Enforces single attempt constraint via DB query + DB constraint.
        Blocks attempt creation if the assessment due date has passed.
        """
        assessment = db.query(Assessment).filter(Assessment.id == assessment_id).first()
        if not assessment:
            raise HTTPException(status_code=404, detail="Assessment not found")

        # Enforce due date deadline: block new attempts after due date
        if assessment.due_date:
            due = assessment.due_date
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
            if datetime.now(timezone.utc) > due:
                raise HTTPException(
                    status_code=400,
                    detail=f"The deadline for this assessment has passed (Due: {due.strftime('%b %d, %Y at %I:%M %p UTC')}). No new attempts are allowed."
                )

        # Check existing attempt
        existing = db.query(AssessmentAttempt).filter(
            AssessmentAttempt.student_id == student_id,
            AssessmentAttempt.assessment_id == assessment_id
        ).first()

        if existing:
            if existing.status == "submitted":
                raise HTTPException(status_code=400, detail="You have already submitted this assessment.")
            return existing

        # Ensure TeacherStudentLink exists
        from app.models.teacher_student_link import TeacherStudentLink
        link = db.query(TeacherStudentLink).filter(
            TeacherStudentLink.teacher_id == assessment.teacher_id,
            TeacherStudentLink.student_id == student_id
        ).first()
        if not link:
            link = TeacherStudentLink(teacher_id=assessment.teacher_id, student_id=student_id)
            db.add(link)

        attempt = AssessmentAttempt(
            assessment_id=assessment_id,
            student_id=student_id,
            started_at=datetime.now(timezone.utc),
            duration_seconds_snapshot=assessment.duration_minutes * 60,
            extended_seconds=0,
            status="in_progress",
            blur_events="[]"
        )
        db.add(attempt)
        try:
            db.commit()
        except IntegrityError:
            # Race condition: another request created the attempt simultaneously
            db.rollback()
            existing = db.query(AssessmentAttempt).filter(
                AssessmentAttempt.student_id == student_id,
                AssessmentAttempt.assessment_id == assessment_id
            ).first()
            if existing:
                if existing.status == "submitted":
                    raise HTTPException(status_code=400, detail="You have already submitted this assessment.")
                return existing
            raise HTTPException(status_code=500, detail="Failed to create assessment attempt.")
        db.refresh(attempt)
        return attempt

    @staticmethod
    def get_attempt_status(db: Session, attempt_id: str) -> Dict[str, Any]:
        """
        Computes remaining seconds dynamically from server timestamp.
        Also factors in the assessment's due_date as a hard deadline.
        """
        attempt = db.query(AssessmentAttempt).filter(AssessmentAttempt.id == attempt_id).first()
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found")

        now = datetime.now(timezone.utc)
        started_at = attempt.started_at
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)

        elapsed_seconds = int((now - started_at).total_seconds())
        total_allowed = attempt.duration_seconds_snapshot + attempt.extended_seconds
        remaining = max(0, total_allowed - elapsed_seconds)

        # Also enforce assessment due_date as a hard deadline
        assessment = db.query(Assessment).filter(Assessment.id == attempt.assessment_id).first()
        if assessment and assessment.due_date:
            due = assessment.due_date
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
            due_remaining = int((due - now).total_seconds())
            # Due date takes precedence: if past due, remaining is negative
            if due_remaining <= 0:
                remaining = due_remaining  # Negative value signals overdue
            else:
                remaining = min(remaining, due_remaining)

        blur_count = 0
        if attempt.blur_events:
            try:
                blur_count = len(json.loads(attempt.blur_events))
            except Exception:
                pass

        is_expired = (remaining <= 0) and attempt.status == "in_progress"
        if is_expired:
            attempt.status = "expired"
            db.commit()

        return {
            "attempt_id": attempt.id,
            "status": attempt.status,
            "remaining_seconds": remaining,
            "duration_seconds_snapshot": attempt.duration_seconds_snapshot,
            "extended_seconds": attempt.extended_seconds,
            "is_expired": is_expired,
            "blur_event_count": blur_count
        }

    @staticmethod
    def extend_attempt(db: Session, attempt_id: str, minutes: int = 15) -> AssessmentAttempt:
        attempt = db.query(AssessmentAttempt).filter(AssessmentAttempt.id == attempt_id).first()
        if not attempt:
            raise HTTPException(status_code=404, detail="Attempt not found")

        attempt.extended_seconds += (minutes * 60)
        if attempt.status == "expired":
            attempt.status = "in_progress"

        db.commit()
        db.refresh(attempt)
        return attempt

    @staticmethod
    def log_blur_event(db: Session, attempt_id: str, event_type: str = "blur", details: Optional[str] = None):
        attempt = db.query(AssessmentAttempt).filter(AssessmentAttempt.id == attempt_id).first()
        if not attempt:
            return

        events = []
        if attempt.blur_events:
            try:
                events = json.loads(attempt.blur_events)
            except Exception:
                events = []

        events.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "event_type": event_type,
            "details": details or "User navigated away from assessment window"
        })
        attempt.blur_events = json.dumps(events)
        db.commit()
