from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.submission import Submission
from app.models.assessment import Assessment
from app.schemas.grading import SubmissionDetailResponse
from app.api.deps import get_current_student, get_current_user
from app.api.v1.endpoints.submissions import serialize_submission

router = APIRouter()

@router.get("", response_model=Dict[str, Any])
def list_student_submissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student)
):
    submissions = db.query(Submission).filter(
        Submission.student_id == current_user.id
    ).order_by(Submission.graded_at.desc()).all()

    scores = []
    submissions_list = []
    for s in submissions:
        data = serialize_submission(s, db)
        is_published = (s.status == "published")

        score_pct = 0
        overall_score = 0.0
        confidence_label = "Under Teacher Review"
        key_takeaway = "Your submission is awaiting teacher review."
        ai_summary_en = "Your submission has been received and evaluated. Results will be visible once reviewed and finalized by your teacher."
        ai_summary_ur = "آپ کا ٹیسٹ موصول ہو چکا ہے۔ استاد کے جائزے کے بعد نتائج جاری کیے جائیں گے۔"

        if is_published:
            final_val = s.final_score if s.final_score is not None else s.overall_score
            overall_score = final_val
            total_m = data["total_marks"] if data["total_marks"] > 0 else 100
            score_pct = round((final_val / total_m) * 100)
            scores.append(score_pct)

            # Confidence derived strictly from actual finalized performance
            if score_pct >= 80:
                confidence_label = "High Confidence"
            elif score_pct >= 60:
                confidence_label = "Moderate Confidence"
            else:
                confidence_label = "Low Confidence"

            if data["question_grades"] and data["question_grades"][0].improvement_tip:
                key_takeaway = data["question_grades"][0].improvement_tip
            else:
                key_takeaway = "Assessment evaluated and finalized."

            ai_summary_en = data["ai_summary_en"]
            ai_summary_ur = data["ai_summary_ur"]

        submissions_list.append({
            "id": data["id"],
            "assessment_id": data["assessment_id"],
            "title": data["assessment_title"],
            "subject": data["subject"],
            "date": data["graded_at"].strftime("%b %d, %Y") if data["graded_at"] else "Recently",
            "score_pct": score_pct if is_published else 0,
            "overall_score": overall_score if is_published else 0.0,
            "total_marks": data["total_marks"],
            "status": "published" if is_published else "under_review",
            "confidence": confidence_label,
            "key_takeaway": key_takeaway,
            "ai_summary_en": ai_summary_en,
            "ai_summary_ur": ai_summary_ur
        })

    avg_score = round(sum(scores) / len(scores)) if scores else 0
    strength_summary = (
        f"Average finalized score across your assessments is {avg_score}%."
        if scores
        else "Complete assessments to view your performance summary."
    )

    return {
        "overview": {
            "ai_strength_summary": strength_summary,
            "total_assessments": len(submissions),
            "average_score": avg_score
        },
        "submissions": submissions_list
    }

@router.get("/{submission_id}", response_model=SubmissionDetailResponse)
def get_student_submission_detail(
    submission_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    submission = db.query(Submission).filter(
        Submission.id == submission_id,
        Submission.student_id == current_user.id
    ).first()

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found")

    serialized = serialize_submission(submission, db)

    # Hide preliminary marks from student if teacher has not finalized
    if submission.status != "published":
        serialized["overall_score"] = 0.0
        serialized["preliminary_score"] = 0.0
        serialized["revised_score"] = None
        serialized["final_score"] = None
        serialized["status"] = "under_review"
        serialized["ai_summary_en"] = "Your submission is currently under teacher review. Official grades will be posted upon approval."
        serialized["ai_summary_ur"] = "آپ کا ٹیسٹ فی الوقت استاد کے زیر جائزہ ہے۔ حتمی نتائج منظوری کے بعد شائع کیے جائیں گے۔"
        # Hide detailed question grade marks and deductions
        sanitized_grades = []
        for qg in serialized["question_grades"]:
            sanitized_grades.append(qg.model_copy(update={
                "marks_awarded": 0.0,
                "preliminary_marks_awarded": 0.0,
                "revised_marks_awarded": None,
                "final_marks_awarded": None,
                "correct_points": [],
                "deducted_points": [],
                "improvement_tip": "Pending teacher approval."
            }))
        serialized["question_grades"] = sanitized_grades

    return serialized
