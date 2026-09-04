from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.teacher_student_link import TeacherStudentLink
from app.api.deps import get_current_teacher
from app.schemas.growth_plan import StudentGrowthPlanSchema

router = APIRouter()

@router.get("", response_model=List[StudentGrowthPlanSchema])
def list_growth_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """
    Teacher view of AI-generated personalized interventions and revision schedules.
    """
    links = db.query(TeacherStudentLink).filter(TeacherStudentLink.teacher_id == current_user.id).all()
    student_ids = [l.student_id for l in links]

    students = db.query(User).filter(User.id.in_(student_ids)).all() if student_ids else []

    plans = []
    for s in students:
        plans.append(StudentGrowthPlanSchema(
            student_id=s.id,
            student_name=s.name,
            subject="Mathematics",
            weak_concept="Mathematics > Algebra > Quadratic Formulas",
            mastery_score=65.0,
            target_mastery=90.0,
            diagnostic_summary="Flagged due to consistent minor computational errors in expanding complex roots during the Midterm.",
            revision_plan_points=[
                "Review discriminant properties and edge cases.",
                "Practice FOIL method specifically for imaginary numbers.",
                "Revisit Midterm Question 4a for guided correction."
            ],
            suggested_materials=[
                {"title": "Formula Sheet: Algebra II", "type": "PDF Guide", "action": "Download"},
                {"title": "Focus Exercise: Radical Simp.", "type": "Video Mini-Lesson", "action": "Watch"}
            ],
            status="active"
        ))

    return plans
