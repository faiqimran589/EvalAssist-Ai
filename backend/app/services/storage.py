import os
import uuid
import aiofiles
from pathlib import Path
from fastapi import UploadFile, HTTPException
from app.core.config import settings

UPLOAD_ROOT = Path(settings.UPLOAD_DIR).resolve()
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp"}

async def save_upload(file: UploadFile, subfolder: str = "submissions") -> str:
    """
    Saves an uploaded file to the local storage directory and returns its relative or absolute path.
    Enforces format and size limits.
    """
    target_dir = UPLOAD_ROOT / subfolder
    target_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "upload.png").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    file_id = str(uuid.uuid4())
    filename = f"{file_id}{ext}"
    dest_path = target_dir / filename

    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds maximum allowed size of {settings.MAX_UPLOAD_MB}MB"
        )

    async with aiofiles.open(dest_path, "wb") as f:
        await f.write(content)

    # Return normalized relative path with forward slashes for cross-platform portability
    rel_path = f"uploads/{subfolder}/{filename}"
    return rel_path

def get_full_path(rel_path: str) -> Path:
    if rel_path.startswith("uploads/"):
        return UPLOAD_ROOT.parent / rel_path
    return Path(rel_path)
