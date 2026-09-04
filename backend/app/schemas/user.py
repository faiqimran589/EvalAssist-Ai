from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, ConfigDict

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role: str

class UserResponse(UserBase):
    id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class TeacherStudentLinkResponse(BaseModel):
    id: str
    teacher_id: str
    student_id: str
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
