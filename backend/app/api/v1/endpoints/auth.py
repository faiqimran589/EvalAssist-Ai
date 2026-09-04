from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.models.user import User
from app.models.teacher_student_link import TeacherStudentLink
from app.models.assessment import Assessment
from app.models.assessment_attempt import AssessmentAttempt
from app.schemas.auth import (
    UserRegister, StudentTokenRegister, UserLogin, Token,
    QuickJoinResolveResponse
)
from app.schemas.user import UserResponse
from app.api.deps import get_current_user

router = APIRouter()

@router.post("/register", response_model=Token)
def register_teacher(data: UserRegister, db: Session = Depends(get_db)):
    """Teacher self-registration form."""
    existing = db.query(User).filter(User.email == data.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    user = User(
        name=data.name,
        email=data.email,
        password_hash=get_password_hash(data.password),
        plain_password=data.password,
        role="teacher"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(subject=user.id, role=user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role
    }

def _get_assessment_by_token(db: Session, token_code: str) -> Assessment:
    """Fetches the assessment linked to a share token (case-insensitive)."""
    clean_token = token_code.strip().upper()
    return db.query(Assessment).filter(func.upper(Assessment.share_token) == clean_token).first()


def _ensure_token_not_expired(assessment: Assessment) -> None:
    """
    Validates the CURRENT server UTC time against THIS assessment's own due_date.
    Scope isolation: each token maps to exactly one assessment row, so only that
    assessment's deadline is evaluated — never a global or session-wide setting.
    """
    if assessment.due_date:
        due = assessment.due_date
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        if datetime.now(timezone.utc) > due:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This assessment token has expired."
            )


@router.post("/register-student-token", response_model=Token)
def register_student_with_token(data: StudentTokenRegister, db: Session = Depends(get_db)):
    """
    Student registration strictly through a teacher's assessment token.
    Creates student, links to teacher, and enrolls in the assessment.
    Blocks enrollment if the assessment's own due date has passed.
    """
    assessment = _get_assessment_by_token(db, data.share_token)
    if not assessment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid assessment token. Please check with your teacher."
        )

    # Enforce this assessment's deadline before creating the enrollment
    _ensure_token_not_expired(assessment)

    user = db.query(User).filter(User.email == data.email).first()
    if user:
        if user.role != "student":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This email belongs to a teacher account."
            )
        # Update plain_password if not already stored (for returning students)
        if not user.plain_password or user.plain_password != data.password:
            user.plain_password = data.password
            db.commit()
    else:
        user = User(
            name=data.name,
            email=data.email,
            password_hash=get_password_hash(data.password),
            plain_password=data.password,  # Store readable password for teacher dashboard
            role="student"
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    # Link student with teacher if not linked yet
    link = db.query(TeacherStudentLink).filter(
        TeacherStudentLink.teacher_id == assessment.teacher_id,
        TeacherStudentLink.student_id == user.id
    ).first()
    if not link:
        link = TeacherStudentLink(teacher_id=assessment.teacher_id, student_id=user.id)
        db.add(link)
        db.commit()

    access_token = create_access_token(subject=user.id, role=user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role
    }

@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    """Login with email and password. Validates portal role match if expected_role is provided."""
    user = db.query(User).filter(User.email == data.email.strip()).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

    # Enforce strict portal-role matching: prevent cross-portal access
    if data.expected_role and user.role != data.expected_role:
        portal_name = "Teacher" if data.expected_role == "teacher" else "Student"
        actual_role = "teacher" if user.role == "teacher" else "student"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"This account is registered as a {actual_role}. Please use the {actual_role.capitalize()} Portal to sign in."
        )

    # Backfill plain_password on login if not already stored
    if not user.plain_password or user.plain_password != data.password:
        user.plain_password = data.password
        db.commit()

    access_token = create_access_token(subject=user.id, role=user.role)
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role
    }

from sqlalchemy import func
from app.models.teacher_student_link import TeacherStudentLink

@router.get("/quick-join/resolve", response_model=QuickJoinResolveResponse)
def resolve_quick_join_token(
    token: str = Query(..., description="Short share token e.g. AB-123"),
    db: Session = Depends(get_db)
):
    """Resolves share token to assessment and teacher details."""
    assessment = _get_assessment_by_token(db, token)
    if not assessment:
        return QuickJoinResolveResponse(
            valid=False,
            message="No assessment found matching this token."
        )

    # Evaluate the current server UTC time against THIS joined assessment's
    # due_date before exposing it as joinable.
    _ensure_token_not_expired(assessment)

    teacher = db.query(User).filter(User.id == assessment.teacher_id).first()
    return QuickJoinResolveResponse(
        valid=True,
        assessment_id=assessment.id,
        assessment_title=assessment.title,
        subject=assessment.subject,
        teacher_id=assessment.teacher_id,
        teacher_name=teacher.name if teacher else "Instructor",
        duration_minutes=assessment.duration_minutes,
        total_marks=assessment.total_marks,
        message="Assessment found."
    )

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Get authenticated user profile."""
    return current_user
