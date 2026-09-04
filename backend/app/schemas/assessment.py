from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict

class RubricKeyPointSchema(BaseModel):
    id: Optional[str] = None
    text: str
    points: float = 1.0
    is_mandatory_keyword: bool = False
    formatting: Optional[Dict[str, Any]] = None

class RubricDeductionSchema(BaseModel):
    id: Optional[str] = None
    error_condition: str
    penalty: float = -1.0

class LevelBandSchema(BaseModel):
    level: int
    min_marks: float
    max_marks: float
    descriptor: str = ""

class QuestionSchema(BaseModel):
    id: Optional[str] = None
    order_index: int = 1
    text: str
    marks: float = 0.0
    question_type: str = "short"  # 'short', 'long', 'mcq'
    answer_lines: int = 4
    options: List[str] = []
    correct_answer: Optional[str] = None  # MCQ correct option or expected answer summary
    marking_scheme: Optional[str] = None  # 'point_based' or 'level_based'
    level_bands: Optional[List[LevelBandSchema]] = None
    diagram_image_url: Optional[str] = None
    key_points: List[RubricKeyPointSchema] = []
    deductions: List[RubricDeductionSchema] = []

class AssessmentCreate(BaseModel):
    title: str
    subject: str
    total_marks: int
    duration_minutes: int = 60
    due_date: Optional[datetime] = None
    questions: Optional[List[QuestionSchema]] = []

class AssessmentUpdate(BaseModel):
    title: Optional[str] = None
    subject: Optional[str] = None
    total_marks: Optional[int] = None
    duration_minutes: Optional[int] = None
    due_date: Optional[datetime] = None
    questions: Optional[List[QuestionSchema]] = None
    status: Optional[str] = None

class AssessmentResponse(BaseModel):
    id: str
    teacher_id: str
    teacher_name: Optional[str] = None
    title: str
    subject: str
    total_marks: int
    duration_minutes: int
    due_date: Optional[datetime] = None
    share_token: str
    status: str
    created_at: datetime
    questions: List[QuestionSchema] = []
    model_config = ConfigDict(from_attributes=True)

class QuestionExtractItem(BaseModel):
    order_index: int
    text: str
    marks: float
    question_type: Optional[str] = "short"
    answer_lines: Optional[int] = 4
    options: Optional[List[str]] = []
    correct_answer: Optional[str] = None
    # Diagram/table detection from Gemini Vision OCR
    has_diagram_or_table: bool = False
    bounding_box: Optional[List[float]] = None  # [ymin, xmin, ymax, xmax] normalized 0-1000
    diagram_image_url: Optional[str] = None  # Cropped asset URL (uploads/mcq_diagrams/<id>.png)

class QuestionExtractResponse(BaseModel):
    questions: List[QuestionExtractItem]
    raw_ocr: Optional[str] = None
    error: Optional[str] = None  # Populated when extraction fails

class RubricExtractResponse(BaseModel):
    question_text: Optional[str] = None
    key_points: List[RubricKeyPointSchema] = []
    deductions: List[RubricDeductionSchema] = []

class RubricGenerateRequest(BaseModel):
    question_text: str
    marks: float
    question_type: str = "short"
    subject: str = "General"
    options: Optional[List[str]] = []
    correct_answer: Optional[str] = None

class RubricGenerateResponse(BaseModel):
    key_points: List[RubricKeyPointSchema] = []
    deductions: List[RubricDeductionSchema] = []
    expected_answer_summary: Optional[str] = None

class BulkRubricItem(BaseModel):
    order_index: int
    matched: bool = True
    key_points: List[RubricKeyPointSchema] = []
    deductions: List[RubricDeductionSchema] = []

class BulkAnswerKeyResponse(BaseModel):
    success: bool
    rubrics: dict = {}  # order_index -> {matched, key_points, deductions}
    error: Optional[str] = None
