import uuid
from sqlalchemy import Column, String, Float, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class RubricKeyPoint(Base):
    __tablename__ = "rubric_key_points"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    points = Column(Float, nullable=False, default=1.0)
    # Formatting metadata extracted from rubric (bold/underline/italic) - used for keyword-strict grading
    is_mandatory_keyword = Column(Boolean, nullable=False, default=False)
    formatting = Column(JSON, nullable=True, default=None)
    # e.g. {"bold_terms": ["Ohm's Law", "V=IR"], "underline_terms": ["current"]}

    question = relationship("Question", back_populates="key_points")


class RubricDeduction(Base):
    __tablename__ = "rubric_deductions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    question_id = Column(String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    error_condition = Column(Text, nullable=False)
    penalty = Column(Float, nullable=False, default=-1.0)  # Always stored as negative (e.g. -1.0)

    question = relationship("Question", back_populates="deductions")
