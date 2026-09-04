from typing import Optional
from pydantic import BaseModel, EmailStr

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "teacher"  # Default for open signup is teacher

class StudentTokenRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    share_token: str  # Token linking student to teacher & assessment

class UserLogin(BaseModel):
    email: str  # Supports email or identifier
    password: str
    expected_role: Optional[str] = None  # Portal panel selected: 'teacher' or 'student'

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    name: str
    email: str
    role: str

class TokenPayload(BaseModel):
    sub: Optional[str] = None
    role: Optional[str] = None

class QuickJoinResolveRequest(BaseModel):
    token: str

class QuickJoinResolveResponse(BaseModel):
    valid: bool
    assessment_id: Optional[str] = None
    assessment_title: Optional[str] = None
    subject: Optional[str] = None
    teacher_name: Optional[str] = None
    teacher_id: Optional[str] = None
    duration_minutes: Optional[int] = None
    total_marks: Optional[int] = None
    is_enrolled: Optional[bool] = False
    message: Optional[str] = None
