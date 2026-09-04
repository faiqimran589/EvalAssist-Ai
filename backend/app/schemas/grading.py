from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict

class AnnotationItem(BaseModel):
    bbox: List[float] = []
    label: str
    type: str = "positive"

class DeductedPointItem(BaseModel):
    issue: str
    reason: str
    concept: str = "General"
    penalty: float = -1.0

class QuestionGradeDetail(BaseModel):
    id: str
    question_id: str
    question_text: Optional[str] = None
    order_index: Optional[int] = None
    marks_awarded: float
    preliminary_marks_awarded: Optional[float] = 0.0
    revised_marks_awarded: Optional[float] = None
    final_marks_awarded: Optional[float] = None
    marks_total: float
    confidence_score: float
    correct_points: List[str] = []
    deducted_points: List[DeductedPointItem] = []
    annotations: List[AnnotationItem] = []
    improvement_tip: Optional[str] = None
    ai_revision_notes: Optional[str] = None
    extracted_answer_text: Optional[str] = None

class SubmissionDetailResponse(BaseModel):
    id: str
    attempt_id: str
    assessment_id: str
    assessment_title: Optional[str] = None
    subject: Optional[str] = None
    student_id: str
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    file_path: str
    status: str
    overall_score: float
    preliminary_score: Optional[float] = 0.0
    revised_score: Optional[float] = None
    final_score: Optional[float] = None
    total_marks: float
    avg_confidence: float
    ai_summary_en: Optional[str] = None
    ai_summary_ur: Optional[str] = None
    ai_revision_notes: Optional[str] = None
    graded_at: datetime
    question_grades: List[QuestionGradeDetail] = []
    model_config = ConfigDict(from_attributes=True)

class AIInstructionRequest(BaseModel):
    instruction: str
    question_id: Optional[str] = None

class AIRevisionResponse(BaseModel):
    revised_score: float
    ai_revision_notes: str
    question_grades: Dict[str, float] = {}

class AttemptStartResponse(BaseModel):
    attempt_id: str
    assessment_id: str
    started_at: datetime
    duration_seconds_snapshot: int
    extended_seconds: int
    remaining_seconds: int
    status: str
    assessment_title: str
    subject: str
    total_marks: int

class AttemptStatusResponse(BaseModel):
    attempt_id: str
    status: str
    remaining_seconds: int
    duration_seconds_snapshot: int
    extended_seconds: int
    is_expired: bool
    blur_event_count: int

class BlurEventLogRequest(BaseModel):
    event_type: str = "blur"
    timestamp: Optional[str] = None
    details: Optional[str] = None

class AttemptExtendRequest(BaseModel):
    attempt_id: str
    extend_minutes: int = 15

class ManualGradeOverrideRequest(BaseModel):
    question_grades: Dict[str, float]
