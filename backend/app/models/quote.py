import uuid
from sqlalchemy import Column, String, Text
from app.core.database import Base

class Quote(Base):
    __tablename__ = "quotes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    quote_en = Column(Text, nullable=False)
    quote_ur = Column(Text, nullable=False)
    author = Column(String(255), nullable=True)
    category = Column(String(100), nullable=True, default="motivation")
