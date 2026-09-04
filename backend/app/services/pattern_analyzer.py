import json
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.submission import Submission
from app.models.question_grade import QuestionGrade
from app.models.assessment import Assessment
from app.models.user import User


class PatternAnalyzer:
    @staticmethod
    def get_teacher_overview_stats(db: Session, teacher_id: str) -> Dict[str, Any]:
        """
        Calculates Overview statistics for teacher dashboard from real finalized submission data:
        - Overall Class Score (%)
        - AI Feedback Accuracy (%)
        - Student Growth (%)
        - Performance Trends (weekly & monthly points)
        - Weak Concept Alerts
        Returns clean zero/empty state when no data exists.
        """
        assessments = db.query(Assessment).filter(Assessment.teacher_id == teacher_id).all()
        assessment_ids = [a.id for a in assessments]

        # Query published/finalized submissions
        submissions = (
            db.query(Submission).filter(
                Submission.assessment_id.in_(assessment_ids),
                Submission.status == "published"
            ).order_by(Submission.graded_at.asc()).all()
            if assessment_ids else []
        )

        all_submissions_count = (
            db.query(Submission).filter(Submission.assessment_id.in_(assessment_ids)).count()
            if assessment_ids else 0
        )

        from app.models.teacher_student_link import TeacherStudentLink
        from app.models.assessment_attempt import AssessmentAttempt

        # Query all students linked or taking teacher's assessments
        links = db.query(TeacherStudentLink).filter(TeacherStudentLink.teacher_id == teacher_id).all()
        linked_student_ids = [l.student_id for l in links]
        attempts = db.query(AssessmentAttempt).filter(AssessmentAttempt.assessment_id.in_(assessment_ids)).all() if assessment_ids else []
        attempt_student_ids = [att.student_id for att in attempts]
        all_student_ids = list(dict.fromkeys(linked_student_ids + attempt_student_ids))
        enrolled_students = []

        if all_student_ids:
            student_users = db.query(User).filter(User.id.in_(all_student_ids)).all()
            for s in student_users:
                s_attempts = [att for att in attempts if att.student_id == s.id]
                first_att = sorted(s_attempts, key=lambda x: x.started_at)[0] if s_attempts else None
                first_assess_title = "—"
                if first_att:
                    first_a = next((a for a in assessments if a.id == first_att.assessment_id), None)
                    first_assess_title = first_a.title if first_a else "Assessment"
                elif assessments:
                    first_assess_title = assessments[0].title

                s_subs_count = sum(1 for sub in submissions if sub.student_id == s.id)
                enrolled_students.append({
                    "id": s.id,
                    "name": s.name,
                    "email": s.email,
                    "plain_password": s.plain_password or None,  # None = registered before this feature
                    "first_assessment": first_assess_title,
                    "submissions_count": s_subs_count,
                    "created_at": s.created_at.strftime("%b %d, %Y") if s.created_at else "Recently"
                })

        if not submissions:
            return {
                "overall_class_score": 0,
                "ai_feedback_accuracy": 0,
                "student_growth_pct": 0,
                "total_assessments": len(assessments),
                "total_submissions": all_submissions_count,
                "weekly_trends": [],
                "monthly_trends": [],
                "weak_concept_alerts": [],
                "enrolled_students": enrolled_students
            }

        # Calculate from actual finalized submissions
        scores = []
        accuracies = []
        weak_counts: Dict[str, int] = {}
        assessment_grouped_scores: Dict[str, Dict[str, Any]] = {}

        for sub in submissions:
            assess = next((a for a in assessments if a.id == sub.assessment_id), None)
            total = assess.total_marks if assess and assess.total_marks > 0 else 100
            score_val = sub.final_score if sub.final_score is not None else sub.overall_score
            score_pct = round((score_val / total) * 100)
            scores.append(score_pct)
            accuracies.append(sub.avg_confidence * 100)

            # Group by assessment for timeline trends
            a_id = sub.assessment_id
            if a_id not in assessment_grouped_scores:
                assessment_grouped_scores[a_id] = {
                    "title": assess.title if assess else "Assessment",
                    "subject": assess.subject if assess else "General",
                    "scores": [],
                    "date": sub.graded_at
                }
            assessment_grouped_scores[a_id]["scores"].append(score_pct)

            # Tally weak concepts from question grade deductions
            for qg in sub.question_grades:
                if qg.deducted_points:
                    try:
                        deductions = json.loads(qg.deducted_points)
                        for d in deductions:
                            concept = d.get("concept", "General") if isinstance(d, dict) else str(d)
                            weak_counts[concept] = weak_counts.get(concept, 0) + 1
                    except Exception:
                        pass

        overall_score = round(sum(scores) / len(scores)) if scores else 0
        avg_acc = round(sum(accuracies) / len(accuracies)) if accuracies else 0

        # Compute dynamic trend data points from actual assessment averages
        trend_items = []
        for idx, (a_id, data) in enumerate(assessment_grouped_scores.items(), start=1):
            avg_a_score = round(sum(data["scores"]) / len(data["scores"])) if data["scores"] else 0
            trend_items.append({
                "label": data["title"],
                "subject": data["subject"],
                "score": avg_a_score
            })

        # Calculate student growth % dynamically by comparing first assessment group to latest
        growth_pct = 0
        if len(trend_items) >= 2:
            first_score = trend_items[0]["score"]
            last_score = trend_items[-1]["score"]
            if first_score > 0:
                growth_pct = max(0, round(((last_score - first_score) / first_score) * 100))

        # Build alerts from real deduction data
        alerts = []
        total_subs = max(1, len(submissions))
        for concept, count in sorted(weak_counts.items(), key=lambda x: x[1], reverse=True)[:5]:
            pct = round((count / total_subs) * 100)
            alerts.append({
                "concept": concept.split(">")[-1].strip(),
                "subject": concept.split(">")[0].strip() if ">" in concept else "General",
                "affected_students_count": count,
                "affected_students_pct": pct,
                "description": f"{pct}% of student submissions flagged this concept.",
                "severity": "urgent" if pct > 35 else "review_needed",
                "tag": "CLASS DIAGNOSTIC"
            })

        return {
            "overall_class_score": overall_score,
            "ai_feedback_accuracy": avg_acc,
            "student_growth_pct": growth_pct,
            "total_assessments": len(assessments),
            "total_submissions": len(submissions),
            "weekly_trends": trend_items,
            "monthly_trends": trend_items,
            "weak_concept_alerts": alerts,
            "enrolled_students": enrolled_students
        }

    @staticmethod
    def get_student_dashboard_stats(db: Session, student_id: str) -> Dict[str, Any]:
        """
        Calculates Student Dashboard stats from real published submission data.
        Returns clean zero state when no published submissions exist.
        """
        submissions = db.query(Submission).filter(
            Submission.student_id == student_id,
            Submission.status == "published"
        ).order_by(Submission.graded_at.asc()).all()

        if not submissions:
            return {
                "average_score": 0,
                "completed_assessments": 0,
                "pending_this_week": 0,
                "current_status": "No finalized assessments yet",
                "cohort_ranking": "Complete your assessments to see your standing.",
                "streak_days": 0,
                "subject_trends": {}
            }

        scores = []
        subject_scores: Dict[str, List[float]] = {}
        test_details: List[Dict[str, Any]] = []  # Detailed trend data for tooltip
        for sub in submissions:
            assess = db.query(Assessment).filter(Assessment.id == sub.assessment_id).first()
            total = assess.total_marks if assess and assess.total_marks > 0 else 100
            score_val = sub.final_score if sub.final_score is not None else sub.overall_score
            score_pct = (score_val / total) * 100
            scores.append(score_pct)
            subj = assess.subject if assess and assess.subject else "General"
            if subj not in subject_scores:
                subject_scores[subj] = []
            subject_scores[subj].append(score_pct)
            # Store detailed test info for tooltip
            test_details.append({
                "label": assess.title if assess else "Assessment",
                "subject": subj,
                "score": round(score_pct)
            })

        avg_score = round(sum(scores) / len(scores)) if scores else 0
        status = "Excelling" if avg_score >= 80 else ("Stable" if avg_score >= 60 else "Needs Attention")

        subject_trends = {
            subj: [round(s_val) for s_val in s_list]
            for subj, s_list in subject_scores.items()
        }
        subject_trends["All"] = [round(s) for s in scores]

        return {
            "average_score": avg_score,
            "completed_assessments": len(submissions),
            "pending_this_week": 0,
            "current_status": status,
            "cohort_ranking": (
                "Top performer! Excellent work."
                if avg_score >= 80
                else "Consistent performance. Keep practising."
            ),
            "streak_days": 1 if len(submissions) > 0 else 0,
            "subject_trends": subject_trends,
            "test_details": test_details
        }
