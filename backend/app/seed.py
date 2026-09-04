import sys
from pathlib import Path

# Automatically ensure 'backend' directory is on sys.path
CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.user import User
from app.models.quote import Quote
from app.models.assessment import Assessment
from app.models.question import Question
from app.models.assessment_attempt import AssessmentAttempt
from app.models.submission import Submission
from app.models.teacher_student_link import TeacherStudentLink


def init_db_and_seed():
    Base.metadata.create_all(bind=engine)
    
    # Safe schema migration for SQLite
    try:
        with engine.begin() as conn:
            for col_sql in [
                "ALTER TABLE questions ADD COLUMN question_type VARCHAR(50) DEFAULT 'short'",
                "ALTER TABLE questions ADD COLUMN answer_lines INTEGER DEFAULT 4",
                "ALTER TABLE questions ADD COLUMN options TEXT DEFAULT '[]'",
                "ALTER TABLE questions ADD COLUMN correct_answer TEXT DEFAULT NULL",
                "ALTER TABLE users ADD COLUMN plain_password VARCHAR(255) DEFAULT NULL",
                # Level-based marking, diagram extraction, mandatory keyword columns
                "ALTER TABLE questions ADD COLUMN marking_scheme VARCHAR(30) DEFAULT NULL",
                "ALTER TABLE questions ADD COLUMN level_bands JSON DEFAULT NULL",
                "ALTER TABLE questions ADD COLUMN diagram_image_url TEXT DEFAULT NULL",
                "ALTER TABLE rubric_key_points ADD COLUMN is_mandatory_keyword BOOLEAN DEFAULT 0",
                "ALTER TABLE rubric_key_points ADD COLUMN formatting JSON DEFAULT NULL",
            ]:
                try:
                    conn.execute(text(col_sql))
                except Exception:
                    pass
    except Exception:
        pass

    db: Session = SessionLocal()

    try:
        # Check if teacher exists
        teacher1 = db.query(User).filter(User.id == "t-prof-1").first()
        if not teacher1:
            print("Seeding EvalAssist AI initial user accounts...")
            teacher1 = User(
                id="t-prof-1",
                name="Professor",
                email="teacher@evalassist.ai",
                password_hash=get_password_hash("password123"),
                plain_password="password123",
                role="teacher"
            )
            db.add(teacher1)

        student1 = db.query(User).filter(User.id == "s-student-1").first()
        if not student1:
            student1 = User(
                id="s-student-1",
                name="Student",
                email="student@evalassist.ai",
                password_hash=get_password_hash("password123"),
                plain_password="password123",
                role="student"
            )
            db.add(student1)
        elif not student1.plain_password:
            student1.plain_password = "password123"

        db.flush()

        # Seed quotes if empty
        if not db.query(Quote).first():
            quote1 = Quote(
                quote_en='"Education is the most powerful weapon which you can use to change the world"',
                quote_ur='"تعلیم وہ سب سے طاقتور ہتھیار ہے جسے آپ دنیا بدلنے کے لیے استعمال کر سکتے ہیں"',
                author="Nelson Mandela"
            )
            quote2 = Quote(
                quote_en='"Self-reflection and continuous improvement are the hallmark of true scholars."',
                quote_ur='"خود احتسابی اور مسلسل بہتری ہی حقیقی علم کے متلاشیوں کا خاصہ ہے۔"',
                author="Allama Iqbal"
            )
            db.add_all([quote1, quote2])

        db.commit()
        print("Clean database initialization completed.")
        print("  Teacher login: teacher@evalassist.ai / password123")
        print("  Student login: student@evalassist.ai / password123")
    except Exception as e:
        print(f"Error initializing database: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    init_db_and_seed()
