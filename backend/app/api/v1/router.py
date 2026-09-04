from fastapi import APIRouter
from app.api.v1.endpoints import (
    auth, assessments, assessment_session, submissions,
    student_dashboard, student_submissions, performance, growth_plans, learning_path
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(assessments.router, prefix="/assessments", tags=["assessments"])
api_router.include_router(assessment_session.router, prefix="/session", tags=["assessment_session"])
api_router.include_router(submissions.router, prefix="/submissions", tags=["submissions"])
api_router.include_router(student_dashboard.router, prefix="/student/dashboard", tags=["student_dashboard"])
api_router.include_router(student_submissions.router, prefix="/student/submissions", tags=["student_submissions"])
api_router.include_router(performance.router, prefix="/performance", tags=["performance"])
api_router.include_router(growth_plans.router, prefix="/growth-plans", tags=["growth_plans"])
api_router.include_router(learning_path.router, prefix="/learning-path", tags=["learning_path"])
