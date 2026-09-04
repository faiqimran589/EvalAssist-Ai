import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Enum
from sqlalchemy.orm import relationship
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    plain_password = Column(String(255), nullable=True, default=None)  # Stored for teacher visibility
    role = Column(String(50), nullable=False, default="student")  # 'teacher' or 'student'
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    assessments = relationship("Assessment", back_populates="teacher", cascade="all, delete-orphan")
    attempts = relationship("AssessmentAttempt", back_populates="student", cascade="all, delete-orphan")
    submissions = relationship("Submission", back_populates="student", cascade="all, delete-orphan")
