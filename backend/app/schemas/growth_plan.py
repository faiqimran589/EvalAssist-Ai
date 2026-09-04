from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class WeakConceptAlertSchema(BaseModel):
    concept: str
    subject: str
    affected_students_count: int
    affected_students_pct: float
    description: str
    severity: str  # 'urgent', 'review_needed', 'stable'
    tag: str       # e.g. 'MATH 101', 'PHYS 201'

class StudentGrowthPlanSchema(BaseModel):
    student_id: str
    student_name: str
    subject: str
    weak_concept: str
    mastery_score: float
    target_mastery: float = 90.0
    diagnostic_summary: str
    revision_plan_points: List[str]
    suggested_materials: List[Dict[str, str]]
    status: str = "active"  # 'active', 'in_progress', 'completed'

class LearningPathDiagnosticResponse(BaseModel):
    concept_hierarchy: str  # e.g. "Mathematics > Algebra > Quadratic Formulas"
    mastery_pct: float
    target_mastery_pct: float = 90.0
    pathway_completion_pct: float = 45.0
    ai_summary: str
    revision_plan: List[str]
    journey_steps: List[Dict[str, Any]]
    suggested_materials: List[Dict[str, str]]
    practice_module_id: Optional[str] = None

class PracticeQuestion(BaseModel):
    id: str
    question_text: str
    options: Optional[List[str]] = None
    correct_answer: str
    explanation_en: str
    explanation_ur: str
    concept: str

class PracticeModuleResponse(BaseModel):
    concept: str
    questions: List[PracticeQuestion]

class PerformanceMatrixRow(BaseModel):
    student_id: str
    student_name: str
    subject: str
    topic_mastery: Dict[str, float]  # topic name -> mastery percentage (0-100)
    test_marks: Optional[Dict[str, str]] = None  # test name -> "8/10", "13/20"
    overall_avg: float               # percentage e.g. 78.0
    status: str                      # 'excelling', 'stable', 'needs_attention'
