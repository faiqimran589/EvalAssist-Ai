import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

class AssessmentAttempt(Base):
    __tablename__ = "assessment_attempts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assessment_id = Column(String(36), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    duration_seconds_snapshot = Column(Integer, nullable=False, default=3600)
    extended_seconds = Column(Integer, nullable=False, default=0)
    status = Column(String(50), nullable=False, default="in_progress")  # 'in_progress', 'submitted', 'expired'
    submitted_at = Column(DateTime, nullable=True)
    blur_events = Column(Text, nullable=True, default="[]")  # JSON array of timestamped blur / visibility change events

    __table_args__ = (
        UniqueConstraint("assessment_id", "student_id", name="uq_assessment_student_attempt"),
    )

    assessment = relationship("Assessment", back_populates="attempts")
    student = relationship("User", back_populates="attempts")
    submission = relationship("Submission", back_populates="attempt", uselist=False, cascade="all, delete-orphan")
