"""
OCR Service for EvalAssist student answer grading.

PRIMARY (Gemini Flash): Fast (2-5s), accurate for English, Urdu, Math, and
    bilingual content. Images are downscaled to minimize token usage and stay
    within Gemini's free tier. Uses the rotating-key system for resilience.

FALLBACK (EasyOCR): Local PyTorch engine (English/Math only). Used if Gemini
    OCR fails. The singleton reader is warm-loaded at startup and images are
    capped to 1600px, so typical pages OCR in a few seconds on CPU.

Grading itself is NOT handled here — see groq_service.py (Groq Cloud).
"""

import asyncio
import hashlib
import importlib.util
import io
import logging
import re
import threading
import time
from typing import Any, List, Optional

from app.core.config import settings

logger = logging.getLogger("evalassist.ocr")

# ---------------------------------------------------------------------------
# Throttling for Gemini OCR calls (EasyOCR is local and needs no throttling)
# ---------------------------------------------------------------------------
_gemini_semaphore = asyncio.Semaphore(2)
_last_request_time: float = 0.0
_last_request_lock = asyncio.Lock()

# Retry delays for transient Gemini errors (seconds)
RETRY_DELAYS = [2.0, 5.0, 10.0]

# Rate-limited keys are skipped for this many seconds (1 hour = typical free-tier reset)
RATE_LIMIT_COOLDOWN = 3600.0

_rate_limited_keys: dict[str, float] = {}

# Max image dimension sent to Gemini for Urdu/student-answer OCR (smaller = far fewer tokens)
GEMINI_IMAGE_MAX_DIM = 1024

# Question-paper extraction needs more pixels than handwriting OCR so small
# print, Urdu/Nastaliq, math, and tables stay readable. Still capped so a
# 4000–8000px scan or 300 DPI A4 PNG cannot blow the request payload.
QUESTION_EXTRACT_MAX_DIM = 2560
QUESTION_EXTRACT_MAX_BYTES = 4 * 1024 * 1024
QUESTION_EXTRACT_JPEG_QUALITY = 85
# Convert bulky PNGs (typical PDF page renders) to JPEG even when under max_bytes.
QUESTION_EXTRACT_PNG_JPEG_THRESHOLD = 512 * 1024

# Max image dimension fed to the local EasyOCR engine — capping oversized
# phone photos avoids paying CPU time for pixels handwriting OCR doesn't need.
EASYOCR_MAX_DIM = 1600

# EasyOCR is an optional local fallback; probe availability without importing.
_EASYOCR_AVAILABLE = importlib.util.find_spec("easyocr") is not None

# ---------------------------------------------------------------------------
# Result caches: the same answer-sheet image is OCR'd once per submission,
# not once per question. Keyed by sha256 of the file bytes.
# ---------------------------------------------------------------------------
_CACHE_MAX_ENTRIES = 32
_local_ocr_cache: dict[str, str] = {}
_urdu_ocr_cache: dict[str, str] = {}


class GeminiKeyError(Exception):
    """Raised when all Gemini API key attempts fail."""
    pass


# Backward-compatible alias used by gemini_vision.grade_answer()
OCRError = GeminiKeyError


def _contains_urdu(text: Optional[str]) -> bool:
    """Returns True if the text contains Arabic-script characters (Urdu range)."""
    if not text:
        return False
    return any('\u0600' <= c <= '\u06FF' for c in text)


# ---------------------------------------------------------------------------
# Key rotation helpers (shared by Urdu OCR and teacher-side extraction)
# ---------------------------------------------------------------------------

def _get_available_gemini_keys() -> list[str]:
    """
    Returns Gemini API keys that are NOT currently rate-limited.
    Falls back to ALL keys if every key is rate-limited (forces retry).
    """
    now = time.time()

    expired = [
        k for k, ts in _rate_limited_keys.items()
        if now - ts > RATE_LIMIT_COOLDOWN
    ]
    for k in expired:
        logger.info("Gemini: Rate-limit cooldown expired for a key, re-enabling")
        del _rate_limited_keys[k]

    all_keys = settings.get_all_gemini_keys()
    if not all_keys:
        return []

    available = [k for k in all_keys if k not in _rate_limited_keys]
    if not available:
        logger.warning(
            f"Gemini: All {len(all_keys)} key(s) are rate-limited. "
            "Returning all keys for final attempt."
        )
        return all_keys

    return available


def _mark_key_rate_limited(api_key: str) -> None:
    """Marks a Gemini API key as rate-limited so it's skipped in rotation."""
    _rate_limited_keys[api_key] = time.time()
    logger.warning(f"Gemini: Marked a key as rate-limited (cooldown {RATE_LIMIT_COOLDOWN:.0f}s)")


def _build_gemini_client(api_key: str):
    """Creates a Gemini client for a specific API key. Returns None on failure."""
    try:
        from google import genai
        return genai.Client(api_key=api_key)
    except Exception as e:
        logger.error(f"Gemini: Failed to create client for a key: {e}")
        return None


# ---------------------------------------------------------------------------
# General-purpose Gemini call with key rotation
# (used by teacher-side extraction AND by Urdu OCR below)
# ---------------------------------------------------------------------------

def _gemini_status_hint(exc: Exception, err_str: str) -> str:
    for attr in ("code", "status", "status_code"):
        val = getattr(exc, attr, None)
        if val is not None:
            return str(val)
    for tag in ("401", "403", "404", "429", "400", "500", "502", "503", "504"):
        if tag in err_str:
            return tag
    return "unknown"


def classify_gemini_error(err_str: str, status_hint: str = "") -> str:
    """Maps a Gemini exception string to a diagnostic category. Does not change retry policy."""
    combined = f"{status_hint} {err_str}"
    lower = combined.lower()
    if any(tag in combined for tag in ("401", "UNAUTHENTICATED", "API_KEY_INVALID")):
        return "auth"
    if "PERMISSION_DENIED" in combined or "403" in combined:
        return "permission"
    if any(tag in combined for tag in ("404", "NOT_FOUND")):
        return "model_not_found"
    if "429" in combined or "RESOURCE_EXHAUSTED" in combined:
        return "quota"
    payload_tags = (
        "payload size",
        "request payload",
        "too large",
        "larger than",
        "image exceeded",
        "request entity too large",
        "payloads",
    )
    if any(tag in lower for tag in payload_tags):
        return "payload_too_large"
    if "INVALID_ARGUMENT" in combined or "400" in combined:
        return "invalid_argument"
    if any(tag in combined for tag in ("500", "502", "503", "504", "INTERNAL")):
        return "server_error"
    if any(tag in lower for tag in ("timeout", "timed out", "deadline")):
        return "timeout"
    return "unexpected"


def _record_gemini_error(error_sink: Optional[dict], category: str, detail: str) -> None:
    if error_sink is None:
        return
    error_sink.clear()
    error_sink.update({
        "category": category,
        "detail": (detail or "")[:500],
    })


async def call_gemini_with_key_rotation(
    contents: List[Any],
    system_instruction: Optional[str] = None,
    response_mime_type: Optional[str] = None,
    temperature: float = 0.1,
    error_sink: Optional[dict] = None,
) -> Optional[str]:
    """
    Makes a Gemini API call with rotating keys, retry with backoff, and throttling.

    error_sink: optional dict that is overwritten with the last failure
    {category, detail} for callers that need a non-quota diagnosis.
    """
    from google.genai import types

    async with _gemini_semaphore:
        async with _last_request_lock:
            global _last_request_time
            now = time.time()
            elapsed = now - _last_request_time
            if elapsed < 1.0:
                wait_time = 1.0 - elapsed
                logger.debug(f"Gemini: Throttling — waiting {wait_time:.1f}s between requests")
                await asyncio.sleep(wait_time)
            _last_request_time = time.time()

        available_keys = _get_available_gemini_keys()
        if not available_keys:
            logger.error("Gemini: No API keys configured.")
            _record_gemini_error(error_sink, "no_keys", "No Gemini API keys configured.")
            return None

        model_name = settings.GEMINI_MODEL or "gemini-3.6-flash"
        last_category = "unexpected"

        config_kwargs = {"temperature": temperature}
        if system_instruction:
            config_kwargs["system_instruction"] = system_instruction
        if response_mime_type:
            config_kwargs["response_mime_type"] = response_mime_type
        config = types.GenerateContentConfig(**config_kwargs)

        for key_index, api_key in enumerate(available_keys):
            client = _build_gemini_client(api_key)
            if not client:
                last_category = "auth"
                logger.warning(
                    f"Gemini: Skipping key_index={key_index} "
                    f"(client init failed) model={model_name}"
                )
                _record_gemini_error(error_sink, "auth", "Gemini client init failed for this key.")
                continue

            for attempt_idx, delay in enumerate(RETRY_DELAYS):
                try:
                    response = await asyncio.to_thread(
                        client.models.generate_content,
                        model=model_name,
                        contents=contents,
                        config=config,
                    )
                    if response and response.text:
                        logger.info(
                            f"Gemini: key_index={key_index} succeeded "
                            f"({key_index + 1}/{len(available_keys)}) model={model_name}"
                        )
                        return response.text

                    last_category = "empty_response"
                    logger.warning(
                        f"Gemini failure: model={model_name} key_index={key_index} "
                        f"attempt={attempt_idx + 1}/{len(RETRY_DELAYS)} "
                        f"category=empty_response status=unknown "
                        f"error=empty or missing response.text"
                    )
                    _record_gemini_error(error_sink, "empty_response", "Gemini returned an empty response.")

                except Exception as e:
                    err_str = str(e)
                    status_hint = _gemini_status_hint(e, err_str)
                    category = classify_gemini_error(err_str, status_hint)
                    last_category = category
                    logger.error(
                        f"Gemini failure: model={model_name} key_index={key_index} "
                        f"attempt={attempt_idx + 1}/{len(RETRY_DELAYS)} "
                        f"category={category} status={status_hint} "
                        f"error={err_str[:500]}"
                    )
                    _record_gemini_error(error_sink, category, err_str)

                    # Retry policy unchanged from the previous implementation.
                    if any(tag in err_str for tag in (
                        "401", "UNAUTHENTICATED", "API_KEY_INVALID", "PERMISSION_DENIED"
                    )):
                        break

                    if any(tag in err_str for tag in ("404", "NOT_FOUND")):
                        return None

                    if any(tag in err_str for tag in ("429", "RESOURCE_EXHAUSTED", "503")):
                        if attempt_idx == len(RETRY_DELAYS) - 1:
                            _mark_key_rate_limited(api_key)
                            break
                        await asyncio.sleep(delay)
                        continue

                    if any(tag in err_str for tag in ("500", "502", "504", "INTERNAL")):
                        if attempt_idx < len(RETRY_DELAYS) - 1:
                            await asyncio.sleep(delay)
                            continue
                        break

                    break

        if last_category == "quota":
            logger.error(
                f"Gemini: All {len(available_keys)} key(s) exhausted. "
                f"Last failure category=quota. "
                f"Free tier limit is 20 requests/day per key."
            )
        else:
            logger.error(
                f"Gemini: All {len(available_keys)} key(s) exhausted. "
                f"Last failure category={last_category} (not assumed to be quota)."
            )
        return None


# ---------------------------------------------------------------------------
# STEP 1: Local EasyOCR (English + Math) — free, no API calls
# ---------------------------------------------------------------------------

_easyocr_reader = None
_easyocr_init_lock = threading.Lock()


def _get_easyocr_reader():
    """Lazily initializes the EasyOCR reader (English). Singleton — model loads once."""
    global _easyocr_reader
    if _easyocr_reader is None:
        with _easyocr_init_lock:
            if _easyocr_reader is None:
                import easyocr
                logger.info("OCR: Initializing EasyOCR reader (first use; downloads models once)...")
                _easyocr_reader = easyocr.Reader(['en'], gpu=False, verbose=False)
                logger.info("OCR: EasyOCR reader ready")
    return _easyocr_reader


def warm_up_easyocr() -> None:
    """
    Pre-loads the EasyOCR models in a background thread at server start so the
    first fallback OCR request doesn't pay the model-init cost. No-op when
    EasyOCR is not installed. Returns immediately (non-blocking).
    """
    if not _EASYOCR_AVAILABLE:
        logger.info("OCR: EasyOCR not installed — skipping warm-up")
        return
    threading.Thread(target=_get_easyocr_reader, name="easyocr-warmup", daemon=True).start()
    logger.info("OCR: EasyOCR warm-up started in background")


# Lightweight math cleanup: normalizes common OCR'd math symbols so the
# grader (DeepSeek-R1) receives clean equations.
_MATH_SUBSTITUTIONS = [
    (re.compile(r"\s*×\s*"), " * "),
    (re.compile(r"\s*·\s*"), " * "),
    (re.compile(r"\s*÷\s*"), " / "),
    (re.compile(r"−|–|—"), "-"),
    (re.compile(r"≈"), " ~= "),
    (re.compile(r"≤"), " <= "),
    (re.compile(r"≥"), " >= "),
    (re.compile(r"≠"), " != "),
    (re.compile(r"√"), "sqrt "),
    (re.compile(r"²"), "^2"),
    (re.compile(r"³"), "^3"),
    (re.compile(r"⁴"), "^4"),
    (re.compile(r"½"), "(1/2)"),
    (re.compile(r"¼"), "(1/4)"),
    # Remove stray spaces around operators
    (re.compile(r"\s*([=+\-*/^()])\s*"), r"\1"),
]

_SPACE_FIX_RE = re.compile(r"[ \t]{2,}")


def clean_math_text(text: str) -> str:
    """Cleans up OCR'd math expressions (symbols, superscripts, spacing)."""
    if not text:
        return text
    cleaned = text
    for pattern, replacement in _MATH_SUBSTITUTIONS:
        cleaned = pattern.sub(replacement, cleaned)
    cleaned = _SPACE_FIX_RE.sub(" ", cleaned)
    return cleaned.strip()


def _easyocr_read_bytes_sync(image_bytes: bytes) -> str:
    """Runs EasyOCR on a single image (bytes) synchronously. Called via to_thread."""
    import numpy as np
    from PIL import Image

    reader = _get_easyocr_reader()
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    # Cap resolution before OCR: oversized scans/photos are the main cause of
    # multi-minute CPU runs. 1600px keeps handwriting legible for the detector.
    w, h = img.size
    scale = EASYOCR_MAX_DIM / float(max(w, h))
    if scale < 1.0:
        img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
    img_array = np.array(img)

    # detail=1 gives boxes so we can sort into reading order (line by line);
    # batch_size groups recognition crops so the CPU processes them in batches.
    results = reader.readtext(img_array, detail=1, batch_size=8)
    if not results:
        return ""

    # Group detections into lines by vertical center, then sort left-to-right
    line_height = max(20, int(np.median([abs(box[2][1] - box[0][1]) for box, _, _ in results])))
    keyed = []
    for box, text, conf in results:
        top = min(pt[1] for pt in box)
        keyed.append((top, min(pt[0] for pt in box), text))
    keyed.sort(key=lambda t: (round(t[0] / max(line_height, 1)), t[1]))

    lines = []
    current_bucket = None
    current_parts = []
    for top, left, text in keyed:
        bucket = round(top / max(line_height, 1))
        if current_bucket is None or bucket == current_bucket:
            current_parts.append(text)
        else:
            lines.append(" ".join(current_parts))
            current_parts = [text]
        current_bucket = bucket
    if current_parts:
        lines.append(" ".join(current_parts))

    return "\n".join(lines)


# Timeout for local EasyOCR (seconds) — on CPU it can be slow; if it exceeds this
# we fall back to Gemini OCR rather than blocking the server.
EASYOCR_TIMEOUT_SECONDS = 120

# Local OCR is CPU-bound torch work. Serializing fallback jobs keeps thread
# pools from oversubscribing the CPU and duplicated model memory in check.
_easyocr_semaphore = asyncio.Semaphore(1)


async def extract_english_math_local(image_bytes: bytes) -> str:
    """
    STEP 1: Local OCR of English handwriting and math symbols via EasyOCR.
    Free, unlimited, no API calls. Returns cleaned math text.
    Times out after EASYOCR_TIMEOUT_SECONDS and falls back to Gemini.
    Raises GeminiKeyError only if EasyOCR is unavailable (dependency missing).
    """
    try:
        async with _easyocr_semaphore:
            text = await asyncio.wait_for(
                asyncio.to_thread(_easyocr_read_bytes_sync, image_bytes),
                timeout=EASYOCR_TIMEOUT_SECONDS,
            )
    except asyncio.TimeoutError:
        logger.warning(
            f"OCR: EasyOCR timed out after {EASYOCR_TIMEOUT_SECONDS}s on CPU. "
            "Falling back to Gemini OCR."
        )
        raise GeminiKeyError(
            f"Local OCR timed out ({EASYOCR_TIMEOUT_SECONDS}s). EasyOCR on CPU is too slow for this image."
        )
    except ImportError as e:
        logger.error(f"OCR: EasyOCR is not installed ({e}). Install with: pip install easyocr")
        raise GeminiKeyError("EasyOCR is not installed on the server. Run: pip install easyocr")
    except Exception as e:
        logger.error(f"OCR: EasyOCR failed: {e}")
        raise GeminiKeyError(f"Local OCR failed: {e}")

    cleaned = clean_math_text(text)
    logger.info(f"OCR: EasyOCR extracted {len(cleaned)} chars (English/Math) locally")
    return cleaned


def _image_has_ink(image_bytes: bytes) -> bool:
    """Heuristic: does the image contain visible handwriting/content?"""
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes)).convert("L")
        img.thumbnail((400, 400))
        pixels = list(img.getdata())
        dark = sum(1 for p in pixels if p < 128)
        return dark / max(len(pixels), 1) > 0.005  # >0.5% dark pixels
    except Exception:
        return True  # Assume content if we can't check


# ---------------------------------------------------------------------------
# STEP 2: Urdu OCR via targeted Gemini call (downscaled to save tokens)
# ---------------------------------------------------------------------------

def _encode_rgb_jpeg(img, quality: int) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def prepare_image_for_gemini(
    image_bytes: bytes,
    max_dim: int = GEMINI_IMAGE_MAX_DIM,
    max_bytes: Optional[int] = None,
    jpeg_quality: int = 85,
    png_jpeg_threshold: Optional[int] = None,
    log_prefix: str = "OCR",
    page_num: Optional[int] = None,
) -> tuple[bytes, str]:
    """
    Adaptively prepares an image for a Gemini vision request.

    Preserves aspect ratio (so 0–1000 normalized bounding boxes remain valid on
    the original/crop-source image). Small images are returned unchanged.

    Returns (payload_bytes, mime_type).
    """
    page_label = f" page={page_num}" if page_num is not None else ""
    try:
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes))
        img.load()
        w, h = img.size
        orig_len = len(image_bytes)
        orig_format = (img.format or "").upper()
        orig_mime = {
            "JPEG": "image/jpeg",
            "JPG": "image/jpeg",
            "PNG": "image/png",
            "WEBP": "image/webp",
        }.get(orig_format, "image/png")

        logger.info(
            f"{log_prefix}: original image{page_label} {w}x{h}px, "
            f"{orig_len} bytes, format={orig_format or 'unknown'}"
        )

        long_edge = max(w, h)
        scale = max_dim / float(long_edge) if long_edge else 1.0
        needs_resize = scale < 1.0
        needs_jpeg = False
        decisions: list[str] = []

        if needs_resize:
            decisions.append(f"downscale long_edge {long_edge}->{max_dim}")
        if max_bytes is not None and orig_len > max_bytes:
            needs_jpeg = True
            decisions.append(f"compress (bytes {orig_len} > max {max_bytes})")
        if (
            png_jpeg_threshold is not None
            and orig_format == "PNG"
            and orig_len > png_jpeg_threshold
        ):
            needs_jpeg = True
            decisions.append(f"png->jpeg (png {orig_len} > {png_jpeg_threshold})")

        if not needs_resize and not needs_jpeg:
            exceeds = max_bytes is not None and orig_len > max_bytes
            logger.info(
                f"{log_prefix}: preprocessing decision{page_label}=unchanged "
                f"(small/within limits) | original {w}x{h}px, {orig_len} bytes | "
                f"processed {w}x{h}px, {orig_len} bytes | "
                f"max_bytes={max_bytes} exceeds_max={exceeds}"
            )
            return image_bytes, orig_mime

        work = img.convert("RGB")
        if needs_resize:
            new_size = (max(1, int(w * scale)), max(1, int(h * scale)))
            work = work.resize(new_size, Image.Resampling.LANCZOS)
        out_w, out_h = work.size

        quality = jpeg_quality
        data = _encode_rgb_jpeg(work, quality)
        min_long_edge = max(1280, min(max_dim, 1280))

        while max_bytes is not None and len(data) > max_bytes and quality > 65:
            quality -= 10
            data = _encode_rgb_jpeg(work, quality)
            decisions.append(f"jpeg_quality->{quality}")

        while (
            max_bytes is not None
            and len(data) > max_bytes
            and max(work.size) > min_long_edge
        ):
            shrink = 0.85
            next_size = (
                max(1, int(work.size[0] * shrink)),
                max(1, int(work.size[1] * shrink)),
            )
            if max(next_size) < min_long_edge or next_size == work.size:
                break
            work = work.resize(next_size, Image.Resampling.LANCZOS)
            out_w, out_h = work.size
            data = _encode_rgb_jpeg(work, quality)
            decisions.append(f"further_resize {out_w}x{out_h}")

        exceeds = max_bytes is not None and len(data) > max_bytes
        logger.info(
            f"{log_prefix}: preprocessing decision{page_label}="
            f"{'; '.join(decisions) or 'jpeg_encode'} | "
            f"original {w}x{h}px, {orig_len} bytes | "
            f"processed {out_w}x{out_h}px, {len(data)} bytes | "
            f"max_bytes={max_bytes} exceeds_max={exceeds}"
        )
        return data, "image/jpeg"
    except Exception as e:
        exceeds = max_bytes is not None and len(image_bytes) > max_bytes
        logger.warning(
            f"{log_prefix}: preprocessing failed{page_label}, sending original: {e} | "
            f"original_bytes={len(image_bytes)} processed_bytes={len(image_bytes)} "
            f"max_bytes={max_bytes} exceeds_max={exceeds}"
        )
        return image_bytes, "image/png"


def _downscale_image_for_gemini(image_bytes: bytes, max_dim: int = GEMINI_IMAGE_MAX_DIM) -> bytes:
    """Downscales an image so its largest dimension <= max_dim (cuts tokens ~90%)."""
    data, _mime = prepare_image_for_gemini(
        image_bytes,
        max_dim=max_dim,
        max_bytes=None,
        jpeg_quality=85,
        png_jpeg_threshold=None,
        log_prefix="OCR",
    )
    return data


URDU_OCR_PROMPT = (
    "This image contains handwritten Urdu script (Nastaliq), possibly mixed with "
    "numbers or math. Transcribe the Urdu text exactly as written. "
    "Do NOT translate it to English. Write math expressions in plain notation "
    "(use x, +, -, =, / symbols). "
    "Output ONLY the transcribed Urdu text — no explanations."
)


async def extract_urdu_via_gemini(image_bytes: bytes, mime_type: str) -> str:
    """
    STEP 2: Urdu handwriting OCR via Gemini Flash (rotating keys).
    Images are downscaled first to minimize free-tier token usage.
    PDFs are sent as-is (Gemini prices PDFs per page — already cheap).
    """
    from google.genai import types

    if mime_type == "application/pdf":
        part_image = types.Part.from_bytes(data=image_bytes, mime_type="application/pdf")
    else:
        small_bytes = _downscale_image_for_gemini(image_bytes)
        part_image = types.Part.from_bytes(data=small_bytes, mime_type="image/jpeg")

    part_text = types.Part.from_text(text=URDU_OCR_PROMPT)

    result = await call_gemini_with_key_rotation(
        contents=[part_text, part_image],
        system_instruction="You are a precise Urdu (Nastaliq) transcription engine. Output only the transcription.",
    )

    if not result or not result.strip():
        raise GeminiKeyError("Gemini Urdu OCR returned empty text.")

    logger.info(f"OCR: Gemini Urdu OCR extracted {len(result.strip())} chars (downscaled image)")
    return result.strip()


# ---------------------------------------------------------------------------
# Generic Gemini OCR (fallback when EasyOCR is unavailable)
# ---------------------------------------------------------------------------

async def extract_text_from_image(
    image_bytes: bytes,
    mime_type: str = "image/png",
) -> str:
    """
    Full Gemini OCR of an image (any language). Used as the primary OCR engine.
    Downscaled images to minimize token usage. Rotating keys + throttling.
    """
    if not image_bytes or len(image_bytes) == 0:
        raise GeminiKeyError("No image data provided for OCR extraction.")

    from google.genai import types

    prompt_text = (
        "Extract all text from this image accurately. "
        "Preserve the original structure, paragraphs, and formatting. "
        "For mathematical expressions, use LaTeX notation where possible. "
        "For Urdu text, preserve the original Urdu script exactly. "
        "Return ONLY the extracted text — no explanations, no commentary, no preamble."
    )

    part_text = types.Part.from_text(text=prompt_text)

    # Downscale images to reduce token usage (~90% savings)
    if mime_type != "application/pdf":
        small_bytes = _downscale_image_for_gemini(image_bytes)
        part_image = types.Part.from_bytes(data=small_bytes, mime_type="image/jpeg")
    else:
        part_image = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)

    result = await call_gemini_with_key_rotation(
        contents=[part_text, part_image],
        system_instruction=(
            "You are a precise OCR engine. Extract text from images accurately. "
            "Output only the extracted text."
        ),
    )

    if not result or not result.strip():
        raise GeminiKeyError("OCR extraction returned empty text from all keys.")

    return result.strip()


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def _cache_key(image_bytes: bytes) -> str:
    return hashlib.sha256(image_bytes).hexdigest()


def _cache_get(cache: dict, key: str) -> Optional[str]:
    return cache.get(key)


def _cache_set(cache: dict, key: str, value: str) -> None:
    if len(cache) >= _CACHE_MAX_ENTRIES:
        # Drop the oldest entry (insertion order)
        oldest = next(iter(cache))
        del cache[oldest]
    cache[key] = value


# ---------------------------------------------------------------------------
# MAIN ENTRY POINT: two-step routed OCR for student answers
# ---------------------------------------------------------------------------

async def extract_student_answer_text(
    image_bytes: bytes,
    mime_type: str = "image/png",
    question_text: Optional[str] = None,
    expected_answer: Optional[str] = None,
) -> str:
    """
    OCR pipeline for a student's handwritten answer.

    PRIMARY: Gemini Flash OCR (fast 2-5s, accurate for English + Urdu + Math,
             downscaled images stay within free tier).
    FALLBACK: EasyOCR (slow 60-120s, poor handwriting quality, local only).

    For text/plain files the text is decoded directly (no OCR needed).
    """
    if not image_bytes or len(image_bytes) == 0:
        raise GeminiKeyError("No image data provided for OCR extraction.")

    # ---- Plain text files: read directly, no OCR ----
    if mime_type == "text/plain":
        return image_bytes.decode("utf-8", errors="ignore").strip()

    # ---- Check cache ----
    key = _cache_key(image_bytes)
    cached = _cache_get(_urdu_ocr_cache, key)
    if cached:
        logger.info(f"OCR: Cache hit ({len(cached)} chars)")
        return cached

    # ---- PRIMARY: Gemini OCR (fast, accurate, all languages) ----
    try:
        text = await extract_text_from_image(image_bytes, mime_type)
        if text and len(text.strip()) > 0:
            logger.info(f"OCR: Gemini primary extracted {len(text)} chars")
            _cache_set(_urdu_ocr_cache, key, text)
            return text
    except Exception as e:
        logger.warning(f"OCR: Gemini primary failed: {e}")

    # ---- FALLBACK: EasyOCR (slow, local, poor quality) ----
    if _EASYOCR_AVAILABLE:
        logger.info("OCR: Falling back to EasyOCR (slow, local)...")
        try:
            local_text = await extract_english_math_local(image_bytes)
            if local_text and len(local_text.strip()) > 0:
                logger.info(f"OCR: EasyOCR fallback extracted {len(local_text)} chars")
                _cache_set(_urdu_ocr_cache, key, local_text)
                return local_text
        except Exception as e:
            logger.warning(f"OCR: EasyOCR fallback failed: {e}")

    raise GeminiKeyError(
        "All OCR methods failed. The handwriting may be illegible or the image blank. "
        "Please upload a clearer image or type your answer."
    )
