import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Submission(Base):
    __tablename__ = "submissions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    attempt_id = Column(String(36), ForeignKey("assessment_attempts.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    assessment_id = Column(String(36), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String(500), nullable=False)
    status = Column(String(50), nullable=False, default="processing")  # 'processing', 'needs_review', 'under_review', 'published', 'grading_error'
    preliminary_score = Column(Float, nullable=False, default=0.0)  # Initial AI score (hidden from student until teacher approval)
    revised_score = Column(Float, nullable=True)  # AI revised proposed score after teacher instructions
    final_score = Column(Float, nullable=True)  # Official teacher-approved score
    overall_score = Column(Float, nullable=False, default=0.0)  # Working score / finalized score
    avg_confidence = Column(Float, nullable=False, default=0.0)
    ai_summary_en = Column(Text, nullable=True)
    ai_summary_ur = Column(Text, nullable=True)
    ai_revision_notes = Column(Text, nullable=True)  # Explanation from AI for proposed revisions
    graded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    attempt = relationship("AssessmentAttempt", back_populates="submission")
    assessment = relationship("Assessment", back_populates="submissions")
    student = relationship("User", back_populates="submissions")
    question_grades = relationship("QuestionGrade", back_populates="submission", cascade="all, delete-orphan")
