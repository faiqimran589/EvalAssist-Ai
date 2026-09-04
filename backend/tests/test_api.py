import pytest
import io
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_root_and_health():
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "operational"

    health = client.get("/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

def test_login_demo_teacher():
    res = client.post("/api/v1/auth/login", json={
        "email": "teacher@evalassist.ai",
        "password": "password123"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["role"] == "teacher"

def test_login_demo_student():
    res = client.post("/api/v1/auth/login", json={
        "email": "student@evalassist.ai",
        "password": "password123"
    })
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["role"] == "student"

def test_quick_join_resolve_unknown():
    # Demo tokens (EX-992 etc.) were removed; unknown tokens should resolve as invalid
    res = client.get("/api/v1/auth/quick-join/resolve?token=EX-992")
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is False

def test_quick_join_resolve_invalid():
    res = client.get("/api/v1/auth/quick-join/resolve?token=INVALID-TOKEN")
    assert res.status_code == 200
    data = res.json()
    assert data["valid"] is False

def test_student_dashboard_summary():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "student@evalassist.ai",
        "password": "password123"
    })
    token = login_res.json()["access_token"]

    res = client.get("/api/v1/student/dashboard/summary", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "streak_days" in data
    assert "daily_quote" in data
    assert "subject_trends" in data
    assert isinstance(data["subject_trends"], dict)

def test_student_learning_path():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "student@evalassist.ai",
        "password": "password123"
    })
    token = login_res.json()["access_token"]

    res = client.get("/api/v1/learning-path/diagnostic", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "ai_summary" in data
    assert "revision_plan" in data

    practice_res = client.get("/api/v1/learning-path/practice/mod-1", headers={"Authorization": f"Bearer {token}"})
    assert practice_res.status_code == 200
    pdata = practice_res.json()
    assert len(pdata["questions"]) > 0
    assert "explanation_ur" in pdata["questions"][0]

def test_teacher_performance_overview_and_matrix():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "teacher@evalassist.ai",
        "password": "password123"
    })
    token = login_res.json()["access_token"]

    res = client.get("/api/v1/performance/overview", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    data = res.json()
    assert "overall_class_score" in data
    assert "weak_concept_alerts" in data

    mat_res = client.get("/api/v1/performance/matrix", headers={"Authorization": f"Bearer {token}"})
    assert mat_res.status_code == 200
    mdata = mat_res.json()
    assert isinstance(mdata, list)

def test_ocr_extraction_endpoints():
    login_res = client.post("/api/v1/auth/login", json={
        "email": "teacher@evalassist.ai",
        "password": "password123"
    })
    token = login_res.json()["access_token"]

    # Minimal valid PNG image bytes
    valid_png_bytes = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
        b"\x00\x00\x00\rIDATx\x9cc\xf8\xff\xff?\x03\x00\x05\xfe\x02\xfe\xa7\x35\x81\x84\x00\x00\x00\x00IEND\aeB`"
    )

    # Test question extraction
    res = client.post(
        "/api/v1/assessments/extract-questions",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("questions.png", io.BytesIO(valid_png_bytes), "image/png")}
    )
    assert res.status_code == 200
    q_data = res.json()
    assert "questions" in q_data
    assert isinstance(q_data["questions"], list)

    # Test rubric generation endpoint
    res_gen = client.post(
        "/api/v1/assessments/generate-rubric",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "question_text": "State and explain Ohm's law with formula V=IR.",
            "marks": 5.0,
            "question_type": "short",
            "subject": "Physics"
        }
    )
    assert res_gen.status_code == 200
    gen_data = res_gen.json()
    assert "key_points" in gen_data
    assert len(gen_data["key_points"]) > 0

    # Test rubric extraction
    res_rubric = client.post(
        "/api/v1/assessments/extract-rubric",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": ("rubric.png", io.BytesIO(valid_png_bytes), "image/png")}
    )
    assert res_rubric.status_code in [200, 422]


def test_student_token_registration_flow_invalid_token():
    # EX-992 demo assessment no longer exists; registration with unknown token should fail
    reg_res = client.post("/api/v1/auth/register-student-token", json={
        "name": "Zain Malik",
        "email": "zain_malik@evalassist.ai",
        "password": "password123",
        "share_token": "EX-992"
    })
    # Expect 404 or 400 since the assessment token doesn't exist
    assert reg_res.status_code in [400, 404, 422]
