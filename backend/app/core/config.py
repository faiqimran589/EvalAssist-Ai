from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path
from typing import List
import os

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    PROJECT_NAME: str = "EvalAssist AI"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    DATABASE_URL: str = "sqlite:///./evalassist.db"
    
    # SECURITY: never hardcode this value. Set JWT_SECRET_KEY via the
    # environment or backend/.env (see backend/.env.example). Generate a
    # strong random secret with:
    #   python -c "import secrets; print(secrets.token_hex(32))"
    JWT_SECRET_KEY: str = ""
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440  # 24 hours
    
    # Primary Gemini key (always required)
    # SECURITY: never hardcode this value. Set GEMINI_API_KEY via the
    # environment or backend/.env (see backend/.env.example).
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.6-flash"
    
    # Rotating Gemini API keys (optional, improves free-tier reliability)
    # Each key gets its own 20 req/day quota. Add up to GEMINI_API_KEY_5.
    GEMINI_API_KEY_2: str = ""
    GEMINI_API_KEY_3: str = ""
    GEMINI_API_KEY_4: str = ""
    GEMINI_API_KEY_5: str = ""
    
    # Groq Cloud grading — free tier, thousands of requests/day (https://console.groq.com/keys)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-120b"
    
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_MB: int = 15
    CONFIDENCE_THRESHOLD: float = 0.75

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def get_all_gemini_keys(self) -> List[str]:
        """Returns all configured Gemini API keys (primary + rotating), skipping empty ones."""
        keys = []
        if self.GEMINI_API_KEY:
            keys.append(self.GEMINI_API_KEY)
        for key in [self.GEMINI_API_KEY_2, self.GEMINI_API_KEY_3,
                    self.GEMINI_API_KEY_4, self.GEMINI_API_KEY_5]:
            if key:
                keys.append(key)
        return keys

settings = Settings()

# Ensure uploads directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
