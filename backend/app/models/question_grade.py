import uuid
from sqlalchemy import Column, String, Float, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class QuestionGrade(Base):
    __tablename__ = "question_grades"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    submission_id = Column(String(36), ForeignKey("submissions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(String(36), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    marks_awarded = Column(Float, nullable=False, default=0.0)
    preliminary_marks_awarded = Column(Float, nullable=False, default=0.0)
    revised_marks_awarded = Column(Float, nullable=True)
    final_marks_awarded = Column(Float, nullable=True)
    marks_total = Column(Float, nullable=False, default=0.0)
    confidence_score = Column(Float, nullable=False, default=0.0)
    correct_points = Column(Text, nullable=True, default="[]")       # JSON list of matched criteria strings
    deducted_points = Column(Text, nullable=True, default="[]")      # JSON list of {"issue", "reason", "concept", "penalty"}
    annotations = Column(Text, nullable=True, default="[]")          # JSON list of {"bbox": [ymin, xmin, ymax, xmax], "label", "type": "positive"|"issue"}
    improvement_tip = Column(Text, nullable=True)
    ai_revision_notes = Column(Text, nullable=True)
    extracted_answer_text = Column(Text, nullable=True)

    submission = relationship("Submission", back_populates="question_grades")
    question = relationship("Question", back_populates="grades")
