from typing import Dict, Any, List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.models.quote import Quote
from app.models.assessment import Assessment
from app.api.deps import get_current_student
from app.services.pattern_analyzer import PatternAnalyzer

router = APIRouter()

SAMPLE_QUOTES = [
    {
        "quote_en": '"Education is the most powerful weapon which you can use to change the world"',
        "quote_ur": '”تعلیم وہ سب سے طاقتور ہتھیار ہے جسے آپ دنیا بدلنے کے لیے استعمال کر سکتے ہیں“',
        "author": "Nelson Mandela"
    },
    {
        "quote_en": '"Consistency and deliberate practice are the true keys to mastery."',
        "quote_ur": '”مستقل مزاجی اور مسلسل مشق ہی مہارت حاصل کرنے کی اصل کنجی ہیں۔“',
        "author": "Allama Iqbal"
    }
]

@router.get("/summary", response_model=Dict[str, Any])
def get_student_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_student)
):
    stats = PatternAnalyzer.get_student_dashboard_stats(db, current_user.id)

    # Get quote of the day
    quote_obj = db.query(Quote).first()
    quote = {
        "quote_en": quote_obj.quote_en if quote_obj else SAMPLE_QUOTES[0]["quote_en"],
        "quote_ur": quote_obj.quote_ur if quote_obj else SAMPLE_QUOTES[0]["quote_ur"],
        "author": quote_obj.author if quote_obj else SAMPLE_QUOTES[0]["author"]
    }

    return {
        "student_name": current_user.name,
        "streak_days": stats["streak_days"],
        "average_score": stats["average_score"],
        "completed_assessments": stats["completed_assessments"],
        "pending_this_week": stats["pending_this_week"],
        "current_status": stats["current_status"],
        "cohort_ranking": stats["cohort_ranking"],
        "subject_trends": stats["subject_trends"],
        "test_details": stats.get("test_details", []),
        "daily_quote": quote,
        "active_assessments": []
    }
