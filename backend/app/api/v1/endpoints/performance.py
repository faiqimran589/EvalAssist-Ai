from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.teacher_student_link import TeacherStudentLink
from app.models.assessment import Assessment
from app.models.submission import Submission
from app.api.deps import get_current_teacher
from app.services.pattern_analyzer import PatternAnalyzer
from app.schemas.growth_plan import PerformanceMatrixRow

router = APIRouter()

@router.get("/overview", response_model=Dict[str, Any])
def get_performance_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """Returns overview statistics, weekly/monthly curve points, and weak concept alerts."""
    return PatternAnalyzer.get_teacher_overview_stats(db, current_user.id)

@router.get("/matrix", response_model=List[PerformanceMatrixRow])
def get_performance_matrix(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_teacher)
):
    """
    Returns student topic/subject mastery matrix dynamically computed from real finalized submissions.
    """
    teacher_assessments = db.query(Assessment).filter(Assessment.teacher_id == current_user.id).all()
    teacher_assessment_ids = [a.id for a in teacher_assessments]

    if not teacher_assessment_ids:
        return []

    # Get distinct subjects from teacher assessments
    assessment_subject_map = {a.id: a.subject for a in teacher_assessments}
    distinct_subjects = list(dict.fromkeys([a.subject for a in teacher_assessments if a.subject]))

    # Find students who have submissions for this teacher's assessments
    submissions = db.query(Submission).filter(
        Submission.assessment_id.in_(teacher_assessment_ids),
        Submission.status == "published"
    ).all()

    # Also check linked students
    links = db.query(TeacherStudentLink).filter(TeacherStudentLink.teacher_id == current_user.id).all()
    linked_student_ids = [l.student_id for l in links]
    submission_student_ids = [s.student_id for s in submissions]
    all_student_ids = list(set(linked_student_ids + submission_student_ids))

    if not all_student_ids:
        return []

    students = db.query(User).filter(User.id.in_(all_student_ids)).all()

    matrix_rows = []
    for s in students:
        s_subs = [sub for sub in submissions if sub.student_id == s.id]
        if not s_subs and not linked_student_ids:
            continue

        topic_mastery: Dict[str, float] = {}
        test_marks: Dict[str, str] = {}
        all_scores: List[float] = []

        for assess in teacher_assessments:
            sub = next((sb for sb in s_subs if sb.assessment_id == assess.id), None)
            total = assess.total_marks if assess and assess.total_marks > 0 else 100
            if sub:
                score_val = sub.final_score if sub.final_score is not None else sub.overall_score
                score_pct = (score_val / total) * 100
                all_scores.append(score_pct)
                topic_mastery[assess.title] = round(score_pct)
                formatted_score = f"{int(score_val) if score_val == int(score_val) else score_val}/{total}"
                test_marks[assess.title] = formatted_score
            else:
                topic_mastery[assess.title] = 0
                test_marks[assess.title] = f"—/{total}"

        avg_score = round(sum(all_scores) / len(all_scores)) if all_scores else 0
        status_label = "excelling" if avg_score >= 80 else ("stable" if avg_score >= 60 else "needs_attention")
        primary_subject = distinct_subjects[0] if distinct_subjects else "General Curriculum"

        matrix_rows.append(PerformanceMatrixRow(
            student_id=s.id,
            student_name=s.name,
            subject=primary_subject,
            topic_mastery=topic_mastery,
            test_marks=test_marks,
            overall_avg=float(avg_score),
            status=status_label
        ))

    return matrix_rows
