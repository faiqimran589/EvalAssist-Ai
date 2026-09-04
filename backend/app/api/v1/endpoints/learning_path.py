from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.submission import Submission
from app.models.question_grade import QuestionGrade
from app.schemas.growth_plan import LearningPathDiagnosticResponse, PracticeModuleResponse, PracticeQuestion
from app.api.deps import get_current_student

router = APIRouter()

@router.get("/diagnostic", response_model=LearningPathDiagnosticResponse)
def get_learning_path_diagnostic(
    concept: Optional[str] = Query(None, description="Pre-focused weak concept query from submission detail"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student)
):
    """
    Returns personalized diagnostic focus, journey map, revision plan, and practice triggers.
    """
    chosen_concept = concept or "# Mathematics > Algebra > Quadratic Formulas"
    if not chosen_concept.startswith("#"):
        chosen_concept = f"# {chosen_concept}"

    return LearningPathDiagnosticResponse(
        concept_hierarchy=chosen_concept,
        mastery_pct=65.0,
        target_mastery_pct=90.0,
        pathway_completion_pct=45.0,
        ai_summary="Flagged due to consistent minor computational errors in expanding complex roots during the Midterm.",
        revision_plan=[
            "Review discriminant properties and edge cases.",
            "Practice FOIL method specifically for imaginary numbers.",
            "Revisit Midterm Question 4a for guided correction."
        ],
        journey_steps=[
            {
                "title": "Thesis Construction Mastery",
                "status": "completed",
                "badge": "Completed"
            },
            {
                "title": "Evidence Integration",
                "status": "current",
                "badge": "Current Focus"
            },
            {
                "title": "Synthesizing Counterarguments",
                "status": "locked",
                "badge": "Locked"
            }
        ],
        suggested_materials=[
            {
                "title": "Formula Sheet: Algebra II",
                "type": "PDF Guide",
                "action": "Download"
            },
            {
                "title": "Focus Exercise: Radical Simp.",
                "type": "Video Mini-Lesson",
                "action": "Watch"
            }
        ],
        practice_module_id="mod-quad-1"
    )

@router.get("/practice/{module_id}", response_model=PracticeModuleResponse)
def get_practice_module(
    module_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student)
):
    """
    Returns high-yield bilingual practice problems with explanations in English and Urdu.
    """
    return PracticeModuleResponse(
        concept="Mathematics > Algebra > Quadratic Formulas",
        questions=[
            PracticeQuestion(
                id="q1",
                question_text="If ax² + bx + c = 0 has equal real roots, what must be the value of the discriminant b² - 4ac?",
                options=["b² - 4ac > 0", "b² - 4ac = 0", "b² - 4ac < 0", "b² = 2ac"],
                correct_answer="b² - 4ac = 0",
                explanation_en="When the discriminant is zero (b² - 4ac = 0), the quadratic equation produces exactly one repeated real root.",
                explanation_ur="جب تفریق کنندہ صفر کے برابر ہو (b² - 4ac = 0)، تو دو درجی مساوات کے دو مساوی حقیقی روٹس حاصل ہوتے ہیں۔",
                concept="Algebra > Quadratic Formulas"
            ),
            PracticeQuestion(
                id="q2",
                question_text="Calculate the roots of x² - 6x + 9 = 0 using factorization or formula.",
                options=["x = 3 (repeated)", "x = ±3", "x = -3 (repeated)", "x = 0, 9"],
                correct_answer="x = 3 (repeated)",
                explanation_en="Factoring (x - 3)² = 0 yields x = 3 as a double root.",
                explanation_ur="(x - 3)² = 0 کے تحت حل کرنے سے x = 3 ایک تکراری روٹ کے طور پر حاصل ہوتا ہے۔",
                concept="Algebra > Quadratic Formulas"
            ),
            PracticeQuestion(
                id="q3",
                question_text="What is the unit of electric current in SI units?",
                options=["Volt (V)", "Ampere (A)", "Ohm (Ω)", "Coulomb (C)"],
                correct_answer="Ampere (A)",
                explanation_en="Electric current is measured in Amperes (A), defined as 1 Coulomb per second.",
                explanation_ur="برقی رو کی بین الاقوامی اکائی ایمپیئر (A) ہے، جو فی سیکنڈ ایک کولمب چارج کے بہاؤ کے برابر ہے۔",
                concept="Physics > Electricity"
            )
        ]
    )
