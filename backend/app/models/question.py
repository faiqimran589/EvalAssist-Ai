import uuid
from sqlalchemy import Column, String, Integer, Float, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class Question(Base):
    __tablename__ = "questions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    assessment_id = Column(String(36), ForeignKey("assessments.id", ondelete="CASCADE"), nullable=False, index=True)
    order_index = Column(Integer, nullable=False, default=1)
    text = Column(Text, nullable=False)
    marks = Column(Float, nullable=False, default=0.0)
    question_type = Column(String(50), nullable=False, default="short")  # 'short', 'long', 'mcq'
    answer_lines = Column(Integer, nullable=False, default=4)
    options = Column(Text, nullable=True, default="[]")  # JSON list of options for MCQ
    correct_answer = Column(Text, nullable=True, default=None)  # MCQ correct option text, or expected answer summary
    # Level-based (holistic) marking scheme for essay / composition / humanities
    marking_scheme = Column(String(30), nullable=True, default=None)  # 'point_based' (default) or 'level_based'
    level_bands = Column(JSON, nullable=True, default=None)
    # e.g. [{"level": 1, "min_marks": 1, "max_marks": 4, "descriptor": "Basic understanding..."}, ...]
    diagram_image_url = Column(Text, nullable=True, default=None)  # Path to extracted diagram/figure image for this question

    # Relationships
    assessment = relationship("Assessment", back_populates="questions")
    key_points = relationship("RubricKeyPoint", back_populates="question", cascade="all, delete-orphan")
    deductions = relationship("RubricDeduction", back_populates="question", cascade="all, delete-orphan")
    grades = relationship("QuestionGrade", back_populates="question", cascade="all, delete-orphan")
