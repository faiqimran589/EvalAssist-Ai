import json
import re
import asyncio
import logging
import io
import uuid
from typing import Dict, Any, List, Optional, Tuple
from app.core.config import settings
from app.prompts.extraction_prompts import QUESTION_EXTRACTION_PROMPT, RUBRIC_EXTRACTION_PROMPT, RUBRIC_GENERATION_PROMPT, BULK_ANSWER_KEY_EXTRACTION_PROMPT
from app.prompts.urdu_grading_prompts import GRADING_PROMPT_TEMPLATE, LEVEL_BASED_GRADING_PROMPT_TEMPLATE
from app.prompts.growth_plan_prompts import GROWTH_PLAN_PROMPT
from app.prompts.practice_prompts import PRACTICE_GENERATION_PROMPT
from app.services.semantic_evaluator import SemanticEvaluator
from app.services.ocr_service import (
    extract_student_answer_text,
    OCRError,
    call_gemini_with_key_rotation,
    prepare_image_for_gemini,
    QUESTION_EXTRACT_MAX_DIM,
    QUESTION_EXTRACT_MAX_BYTES,
    QUESTION_EXTRACT_JPEG_QUALITY,
    QUESTION_EXTRACT_PNG_JPEG_THRESHOLD,
)
from app.services.groq_service import call_groq_grading

logger = logging.getLogger("evalassist.gemini")

def get_gemini_client():
    if not settings.GEMINI_API_KEY:
        logger.warning("No GEMINI_API_KEY configured.")
        return None
    try:
        from google import genai
        return genai.Client(api_key=settings.GEMINI_API_KEY)
    except Exception as e:
        logger.warning(f"Could not initialize Google GenAI client: {e}")
        return None

def detect_mime_type(data_bytes: bytes, fallback: str = "image/png") -> str:
    """Detects MIME type from file magic headers for PDF and images."""
    if not data_bytes:
        return fallback
    if data_bytes.startswith(b"%PDF"):
        return "application/pdf"
    if data_bytes.startswith(b"\x89PNG"):
        return "image/png"
    if data_bytes.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data_bytes.startswith(b"RIFF") and b"WEBP" in data_bytes[:16]:
        return "image/webp"
    return fallback

async def call_gemini_with_retry(
    contents: List[Any],
    system_instruction: Optional[str] = None,
    max_retries: int = 5,
    initial_delay: float = 15.0
) -> Optional[str]:
    """
    Executes a Gemini API call using ONLY Gemini 3.6 (configured model).
    No fallback to alternative models. Retries on the same model for transient errors.
    Handles free-tier quota limits (20 req/day) by parsing retry-after from error messages.
    """
    client = get_gemini_client()
    if not client:
        return None

    from google.genai import types

    # Use ONLY Gemini 3.6 - no fallback models
    model_name = settings.GEMINI_MODEL or "gemini-3.6-flash"
    logger.info(f"Using Gemini model: {model_name} (no fallback)")

    config = types.GenerateContentConfig(
        temperature=0.1,  # Lower temperature for more deterministic OCR output
        system_instruction=system_instruction,
        response_mime_type="application/json"
    )

    delay = initial_delay
    for attempt in range(max_retries):
        try:
            response = await asyncio.to_thread(
                client.models.generate_content,
                model=model_name,
                contents=contents,
                config=config
            )
            if response and response.text:
                logger.info(f"Successfully generated response using model '{model_name}'.")
                return response.text
        except Exception as e:
            err_str = str(e)
            logger.warning(f"Gemini model '{model_name}' attempt {attempt + 1}/{max_retries} failed: {err_str[:200]}")

            # Auth errors: no retry
            if "401" in err_str or "UNAUTHENTICATED" in err_str or "API_KEY_INVALID" in err_str:
                logger.warning("Gemini API key is invalid/unauthenticated.")
                return None

            # Model not found: no retry
            if "404" in err_str or "NOT_FOUND" in err_str or "invalid model" in err_str.lower():
                logger.error(f"Model '{model_name}' not available. Please check GEMINI_MODEL configuration.")
                return None

            # Rate limit / quota exhausted: retry with smart delay
            if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "503" in err_str:
                # Parse retry-after from error message (e.g., "Please retry in 12.67863983s")
                retry_after_match = re.search(r"(?:retry in|Retry after)\s+([\d.]+)s", err_str)
                if retry_after_match:
                    parsed_delay = float(retry_after_match.group(1)) + 2.0  # Add 2s safety margin
                    wait_time = max(parsed_delay, delay)
                    logger.info(f"Quota rate-limited. Server suggests waiting {parsed_delay:.1f}s, using {wait_time:.1f}s")
                else:
                    wait_time = delay

                if attempt < max_retries - 1:
                    logger.info(f"Waiting {wait_time:.1f}s before retry (attempt {attempt + 2}/{max_retries})...")
                    await asyncio.sleep(wait_time)
                    delay = min(delay * 1.5, 60.0)  # Cap at 60s
                else:
                    logger.error(
                        f"Rate limit/quota exceeded after {max_retries} attempts. "
                        f"Free tier limit is 20 requests/day. "
                        f"Please wait for quota reset or upgrade your Gemini API plan."
                    )
                    return None
            else:
                logger.error(f"Unexpected error with model '{model_name}': {err_str[:300]}")
                return None

    logger.error(f"All {max_retries} attempts failed for model '{model_name}'.")
    return None

def clean_json_response(raw_text: str) -> Dict[str, Any]:
    """Cleans markdown JSON fences and extracts pure JSON dict."""
    if not raw_text:
        return {}
    cleaned = raw_text.strip()
    cleaned = re.sub(r"^```json\s*", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^```\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    try:
        return json.loads(cleaned.strip())
    except Exception as e:
        logger.error(f"JSON decode failed on: {cleaned[:1000]}... Error: {e}")
        # Try to locate first '{' and last '}'
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start != -1 and end != -1:
            try:
                return json.loads(cleaned[start:end+1])
            except Exception:
                pass
        return {}


def _pdf_page_extraction_error_message(page_outcomes: List[Dict[str, Any]]) -> str:
    """User-facing PDF extraction error that does not assume quota failure."""
    cats = [str(o.get("category") or "") for o in page_outcomes if o.get("category")]
    unique = set(cats)
    if not cats:
        return "PDF extraction failed. See server logs for page-level failure details."
    if unique == {"quota"}:
        return "Gemini quota/rate limit prevented PDF extraction."
    if unique == {"payload_too_large"}:
        return "Gemini rejected the processed PDF page payload as too large."
    if unique == {"invalid_json"}:
        return "Gemini returned an invalid extraction response."
    if unique == {"zero_questions"}:
        return "Gemini processed the PDF pages but did not identify any questions."
    if unique == {"empty_response"}:
        return "Gemini returned an empty extraction response."
    if unique == {"auth"}:
        return "Gemini authentication failed during PDF extraction."
    if unique == {"permission"}:
        return "Gemini permission was denied during PDF extraction."
    if unique == {"model_not_found"}:
        return "Configured Gemini model was not found."
    if unique == {"invalid_argument"}:
        return "Gemini rejected the PDF page request (invalid argument)."
    if unique == {"server_error"}:
        return "Gemini server error prevented PDF extraction."
    if unique == {"timeout"}:
        return "Gemini timed out during PDF extraction."
    if unique == {"no_keys"}:
        return "Gemini API keys are not configured."
    return "PDF extraction failed. See server logs for page-level failure details."

# Adaptive PDF render for question extraction: enough for small print / Urdu / math,
# without emitting 300 DPI multi-megabyte PNGs per page.
PDF_EXTRACT_TARGET_LONG_EDGE = 2200
PDF_EXTRACT_MIN_DPI = 130
PDF_EXTRACT_MAX_DPI = 200


def render_pdf_pages_as_images(
    pdf_bytes: bytes,
    dpi: int = 300,
    *,
    target_long_edge: Optional[int] = None,
    min_dpi: int = PDF_EXTRACT_MIN_DPI,
    max_dpi: int = PDF_EXTRACT_MAX_DPI,
) -> List[bytes]:
    """
    Renders PDF pages as PNG images using PyMuPDF (fitz).
    Handles both text-based and scanned PDFs.

    When target_long_edge is set, DPI is computed per page so the longest
    rendered edge is near that pixel count (clamped to min_dpi/max_dpi).
    Existing callers that pass only dpi keep the previous 300 DPI behavior.
    """
    try:
        import pymupdf  # PyMuPDF
        if target_long_edge:
            logger.info(
                f"Rendering PDF pages as images with adaptive DPI "
                f"(target_long_edge={target_long_edge}px, dpi clamp {min_dpi}-{max_dpi})"
            )
        else:
            logger.info(f"Rendering PDF pages as images with DPI={dpi}")

        pdf_document = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        page_images = []
        page_count = len(pdf_document)

        for page_num in range(page_count):
            page = pdf_document[page_num]
            if target_long_edge:
                long_pts = max(page.rect.width, page.rect.height) or 1.0
                computed_dpi = (target_long_edge * 72.0) / long_pts
                page_dpi = max(float(min_dpi), min(float(max_dpi), computed_dpi))
            else:
                page_dpi = float(dpi)

            zoom = page_dpi / 72.0  # PDF default is 72 DPI
            mat = pymupdf.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            img_bytes = pix.tobytes("png")
            page_images.append(img_bytes)
            logger.info(
                f"Rendered PDF page {page_num + 1}/{page_count}: "
                f"{page.rect.width:.1f}x{page.rect.height:.1f} pts, "
                f"dpi={page_dpi:.1f}, {pix.width}x{pix.height}px, {len(img_bytes)} bytes"
            )

        pdf_document.close()
        logger.info(f"Successfully rendered {len(page_images)} PDF pages as images")
        return page_images

    except Exception as e:
        logger.error(f"Failed to render PDF pages as images: {e}")
        return []

def is_pdf_text_corrupted(text: str) -> bool:
    """Detects if PDF text extraction resulted in corrupted/garbled output."""
    if not text or len(text.strip()) < 10:
        return True

    # Count printable characters vs total
    printable_chars = sum(1 for c in text if c.isprintable() or c in '\n\r\t')
    printable_ratio = printable_chars / len(text) if text else 0

    # Check for excessive control characters or binary data
    if printable_ratio < 0.7:  # Less than 70% printable
        logger.warning(f"PDF text has low printable ratio: {printable_ratio:.2%}")
        return True

    # Check for random binary-like patterns
    non_ascii_count = sum(1 for c in text if ord(c) > 127)
    non_ascii_ratio = non_ascii_count / len(text) if text else 0

    # Urdu Unicode range: \u0600-\u06FF
    urdu_chars = sum(1 for c in text if '\u0600' <= c <= '\u06FF')
    if non_ascii_ratio > 0.5 and urdu_chars < non_ascii_count * 0.3:
        logger.warning(f"PDF text has suspicious non-ASCII ratio: {non_ascii_ratio:.2%} (Urdu chars: {urdu_chars})")
        return True

    # Check for lack of actual words
    words = re.findall(r'[a-zA-Z]+|[\u0600-\u06FF]+', text)
    if len(words) < 3:
        logger.warning(f"PDF text has very few words: {len(words)}")
        return True

    return False

def _sanitize_questions(questions_raw: list) -> list:
    """Sanitize and normalize a list of raw question dicts from Gemini OCR output."""
    sanitized = []
    for q in questions_raw:
        q_text = str(q.get("text", "")).strip()
        if not q_text or q_text.lower() in ["question 1", "question", "q1", "q"]:
            continue

        raw_type = str(q.get("question_type", "")).lower()
        raw_opts = q.get("options", [])
        if not isinstance(raw_opts, list):
            raw_opts = []

        clean_opts = []
        for opt in raw_opts:
            if isinstance(opt, str) and opt.strip():
                clean_opts.append(opt.strip())
            elif isinstance(opt, dict):
                opt_val = opt.get("text") or opt.get("label") or str(opt)
                if str(opt_val).strip():
                    clean_opts.append(str(opt_val).strip())

        if "mcq" in raw_type or "choice" in raw_type or len(clean_opts) > 0:
            q_type = "mcq"
        elif "long" in raw_type or "essay" in raw_type or "descrip" in raw_type:
            q_type = "long"
        else:
            q_type = "short"

        marks_val = float(q.get("marks") or (2.0 if q_type == "mcq" else (10.0 if q_type == "long" else 5.0)))
        if q_type != "mcq" and marks_val >= 8.0:
            q_type = "long"

        lines = int(q.get("answer_lines") or (0 if q_type == "mcq" else (8 if q_type == "long" else 4)))

        # Preserve diagram/table detection fields from Gemini Vision
        has_diagram = bool(q.get("has_diagram_or_table", False))
        bbox_raw = q.get("bounding_box", None)
        bounding_box = None
        if has_diagram and isinstance(bbox_raw, list) and len(bbox_raw) == 4:
            try:
                bounding_box = [float(v) for v in bbox_raw]
                # Validate all values are in 0-1000 range
                if all(0 <= v <= 1000 for v in bounding_box):
                    pass
                else:
                    bounding_box = None
            except (ValueError, TypeError):
                bounding_box = None

        # Table-based MCQ cleanup (Cambridge-style questions): when the cropped
        # table image already displays the option rows, Gemini may still echo the
        # row text into the options array. Reduce "Row A: <duplicated text>"
        # echoes to clean labels so the table image stays the sole visual
        # reference. Only applies when a diagram/table is attached — without the
        # image the option text would be the student's only reference.
        if has_diagram and q_type == "mcq" and len(clean_opts) >= 2:
            row_echo_matches = [
                re.match(r"^(Row\s+[A-Ha-h])\b", o, re.IGNORECASE) for o in clean_opts
            ]
            if all(row_echo_matches):
                clean_opts = [m.group(1).title() for m in row_echo_matches]

        sanitized.append({
            "order_index": len(sanitized) + 1,
            "text": q_text,
            "marks": marks_val,
            "question_type": q_type,
            "answer_lines": lines,
            "options": clean_opts,
            "correct_answer": q.get("correct_answer", None),
            "has_diagram_or_table": has_diagram,
            "bounding_box": bounding_box,
        })
    return sanitized


class GeminiVisionService:
    @staticmethod
    async def _crop_question_diagrams(
        questions: List[Dict[str, Any]],
        get_page_image,
    ) -> None:
        """
        Crops diagram/table regions for questions that have Gemini-detected bounding boxes.

        Args:
            questions: List of sanitized question dicts (mutated in place — sets diagram_image_url).
            get_page_image: Callable(q_idx) -> Optional[bytes] returning the page image
                            bytes the question was extracted from.
        """
        from app.services.diagram_extractor import crop_mcq_asset

        crop_count = 0
        for q_idx, q in enumerate(questions):
            if not q.get("has_diagram_or_table") or not q.get("bounding_box"):
                continue

            try:
                page_img_bytes = get_page_image(q_idx)
            except Exception as e:
                logger.warning(f"_crop_question_diagrams: failed to resolve page image for q_idx={q_idx}: {e}")
                continue

            if not page_img_bytes:
                continue

            # Unique asset id: session-scoped to avoid collisions across uploads
            mcq_id = f"mcq_{uuid.uuid4().hex[:12]}_q{q.get('order_index', q_idx + 1)}"
            diagram_url = crop_mcq_asset(page_img_bytes, q["bounding_box"], mcq_id)
            if diagram_url:
                q["diagram_image_url"] = diagram_url
                crop_count += 1
                logger.info(
                    f"_crop_question_diagrams: linked {diagram_url} to question "
                    f"{q.get('order_index', q_idx + 1)} (bbox={q['bounding_box']})"
                )

        if crop_count > 0:
            logger.info(f"_crop_question_diagrams: cropped and linked {crop_count} diagram asset(s)")

    @staticmethod
    def _extract_document_questions_fallback(image_bytes: bytes, mime_type: str) -> List[Dict[str, Any]]:
        """Extracts structured questions from text-based document bytes only if genuine questions exist."""
        text_content = ""
        try:
            if mime_type == "text/plain" or not mime_type.startswith("image/"):
                text_content = image_bytes.decode("utf-8", errors="ignore")
        except Exception:
            pass

        extracted = []
        if text_content and ("1." in text_content or "Q" in text_content or "Question" in text_content):
            lines = [l.strip() for l in text_content.splitlines() if l.strip()]
            curr_q = ""
            for line in lines:
                if re.match(r"^(?:Question|\(?\d+\)?|[Qq]\d+)[\.\:\)]\s*", line):
                    if curr_q:
                        extracted.append(curr_q)
                    curr_q = line
                elif curr_q:
                    curr_q += " " + line
            if curr_q:
                extracted.append(curr_q)

        if extracted:
            return [
                {
                    "order_index": i + 1,
                    "text": q,
                    "marks": 5.0 if len(q) < 120 else 10.0,
                    "question_type": "short" if len(q) < 120 else "long",
                    "answer_lines": 4 if len(q) < 120 else 8,
                    "options": [],
                    "correct_answer": None
                }
                for i, q in enumerate(extracted[:15])
            ]

        return []

    @staticmethod
    async def extract_questions(image_bytes: bytes, mime_type: str = "image/png") -> Dict[str, Any]:
        """
        Extracts actual questions from an uploaded question paper image or PDF.
        For PDFs: Renders pages adaptively and processes each page through Gemini.
        For Images: Preprocesses oversized scans, then processes through Gemini.
        Uses multilingual support (English, Urdu, mixed).
        Never generates artificial/dummy questions.
        """
        detected_mime = detect_mime_type(image_bytes, fallback=mime_type)
        logger.info(f"extract_questions: detected_mime={detected_mime}, bytes={len(image_bytes)}")

        client = get_gemini_client()
        if not client:
            logger.error(
                "extract_questions: Gemini client unavailable "
                "(missing GEMINI_API_KEY or client init failed). Not a quota error."
            )
        if client:
            try:
                from google.genai import types

                # System instruction for multilingual OCR
                system_instruction = """You are a multilingual OCR expert specializing in educational documents.
CRITICAL: Detect the document language FIRST (English, Urdu, or mixed), then extract ALL text in its ORIGINAL language.
NEVER translate, transliterate, or convert between languages. Preserve Urdu script (اردو) and English text exactly as written.
For Urdu text, maintain RTL direction. For English text, maintain LTR direction. Output only in the detected source language."""

                # ---- Handle PDF files: render pages as images ----
                if detected_mime == "application/pdf":
                    logger.info(
                        "Processing PDF file — adaptive page render, then per-page Gemini extraction"
                    )
                    page_images = render_pdf_pages_as_images(
                        image_bytes,
                        target_long_edge=PDF_EXTRACT_TARGET_LONG_EDGE,
                        min_dpi=PDF_EXTRACT_MIN_DPI,
                        max_dpi=PDF_EXTRACT_MAX_DPI,
                    )

                    if not page_images:
                        logger.error("Failed to render PDF pages as images")
                        return {
                            "questions": [],
                            "raw_ocr": "",
                            "detected_language": "unknown",
                            "error": "Failed to process PDF. The file may be corrupted or password-protected."
                        }

                    logger.info(f"Rendered {len(page_images)} PDF pages, processing each with Gemini 3.6")

                    # Process each page and combine results
                    all_questions = []
                    combined_raw_ocr = []
                    detected_lang = "unknown"
                    # Track which page each question originated from (for diagram cropping)
                    question_page_map: List[int] = []
                    page_outcomes: List[Dict[str, Any]] = []

                    for page_num, page_img_bytes in enumerate(page_images, start=1):
                        logger.info(f"Processing PDF page {page_num}/{len(page_images)}")

                        # Crop from the rendered page (same aspect ratio as the Gemini payload).
                        # Normalized 0-1000 boxes from Gemini therefore stay valid.
                        gemini_bytes, gemini_mime = prepare_image_for_gemini(
                            page_img_bytes,
                            max_dim=QUESTION_EXTRACT_MAX_DIM,
                            max_bytes=QUESTION_EXTRACT_MAX_BYTES,
                            jpeg_quality=QUESTION_EXTRACT_JPEG_QUALITY,
                            png_jpeg_threshold=QUESTION_EXTRACT_PNG_JPEG_THRESHOLD,
                            log_prefix="extract_questions",
                            page_num=page_num,
                        )
                        gemini_error: Dict[str, Any] = {}
                        part = types.Part.from_bytes(data=gemini_bytes, mime_type=gemini_mime)
                        response_text = await call_gemini_with_key_rotation(
                            contents=[QUESTION_EXTRACTION_PROMPT, part],
                            system_instruction=system_instruction,
                            error_sink=gemini_error,
                        )

                        outcome = {
                            "page": page_num,
                            "bytes": len(gemini_bytes),
                            "mime": gemini_mime,
                            "had_response": bool(response_text),
                            "category": None,
                        }

                        if not response_text:
                            category = gemini_error.get("category") or "empty_response"
                            detail = gemini_error.get("detail") or "no response"
                            outcome["category"] = category
                            logger.warning(
                                f"PDF page {page_num}/{len(page_images)}: Gemini request failed: "
                                f"{category} sent_bytes={len(gemini_bytes)} mime={gemini_mime} "
                                f"detail={str(detail)[:500]}"
                            )
                            page_outcomes.append(outcome)
                            continue

                        parsed = clean_json_response(response_text)
                        if not parsed:
                            outcome["category"] = "invalid_json"
                            logger.error(
                                f"PDF page {page_num}/{len(page_images)}: Gemini returned response "
                                f"but JSON parsing failed. raw[:1000]={response_text[:1000]}"
                            )
                            page_outcomes.append(outcome)
                            continue

                        page_questions = parsed.get("questions", [])
                        page_lang = parsed.get("detected_language", "unknown")
                        page_ocr = parsed.get("raw_ocr", "")

                        # Update detected language (use first non-unknown)
                        if detected_lang == "unknown" and page_lang != "unknown":
                            detected_lang = page_lang

                        # Add raw OCR text
                        if page_ocr:
                            combined_raw_ocr.append(f"=== Page {page_num} ===\n{page_ocr}")

                        # Sanitize questions from this page
                        if isinstance(page_questions, list) and len(page_questions) > 0:
                            sanitized = _sanitize_questions(page_questions)
                            if sanitized:
                                for _ in sanitized:
                                    question_page_map.append(page_num)
                                all_questions.extend(sanitized)
                                outcome["category"] = "ok"
                                logger.info(
                                    f"PDF page {page_num}/{len(page_images)}: extracted "
                                    f"{len(sanitized)} question(s) sent_bytes={len(gemini_bytes)} "
                                    f"mime={gemini_mime}"
                                )
                            else:
                                outcome["category"] = "zero_questions"
                                logger.info(
                                    f"PDF page {page_num}/{len(page_images)}: Gemini returned "
                                    f"response but extracted 0 questions after sanitization "
                                    f"(raw_count={len(page_questions)})"
                                )
                        else:
                            outcome["category"] = "zero_questions"
                            logger.info(
                                f"PDF page {page_num}/{len(page_images)}: Gemini returned "
                                f"response but extracted 0 questions"
                            )
                        page_outcomes.append(outcome)

                    logger.info(
                        "extract_questions PDF page outcomes: "
                        + "; ".join(
                            f"p{o['page']} cat={o.get('category')} bytes={o.get('bytes')} "
                            f"mime={o.get('mime')} response={o.get('had_response')}"
                            for o in page_outcomes
                        )
                    )

                    # Re-number questions sequentially across all pages
                    for idx, q in enumerate(all_questions, start=1):
                        q["order_index"] = idx

                    # Crop detected diagram/table regions from their source pages
                    await GeminiVisionService._crop_question_diagrams(
                        all_questions,
                        lambda q_idx: page_images[question_page_map[q_idx] - 1] if 0 <= q_idx < len(question_page_map) else None,
                    )

                    if all_questions:
                        logger.info(f"extract_questions: extracted {len(all_questions)} questions from {len(page_images)} PDF pages (language: {detected_lang})")
                        return {
                            "questions": all_questions,
                            "raw_ocr": "\n\n".join(combined_raw_ocr) or "PDF OCR extraction completed successfully.",
                            "detected_language": detected_lang,
                            "error": None
                        }
                    else:
                        error_msg = _pdf_page_extraction_error_message(page_outcomes)
                        logger.error(f"extract_questions: PDF extraction produced 0 questions. {error_msg}")
                        return {
                            "questions": [],
                            "raw_ocr": "\n\n".join(combined_raw_ocr),
                            "detected_language": detected_lang,
                            "error": error_msg
                        }

                # ---- Handle image files (preprocess oversized scans; leave small images intact) ----
                else:
                    gemini_bytes, gemini_mime = prepare_image_for_gemini(
                        image_bytes,
                        max_dim=QUESTION_EXTRACT_MAX_DIM,
                        max_bytes=QUESTION_EXTRACT_MAX_BYTES,
                        jpeg_quality=QUESTION_EXTRACT_JPEG_QUALITY,
                        png_jpeg_threshold=QUESTION_EXTRACT_PNG_JPEG_THRESHOLD,
                        log_prefix="extract_questions",
                    )
                    gemini_error: Dict[str, Any] = {}
                    part = types.Part.from_bytes(data=gemini_bytes, mime_type=gemini_mime)
                    response_text = await call_gemini_with_key_rotation(
                        contents=[QUESTION_EXTRACTION_PROMPT, part],
                        system_instruction=system_instruction,
                        error_sink=gemini_error,
                    )
                    if not response_text:
                        logger.warning(
                            f"extract_questions: Gemini returned no text for image "
                            f"(original {len(image_bytes)} bytes, sent {len(gemini_bytes)} bytes, "
                            f"mime={gemini_mime} category={gemini_error.get('category')} "
                            f"detail={str(gemini_error.get('detail', ''))[:500]})"
                        )
                    if response_text:
                        parsed = clean_json_response(response_text)
                        if not parsed:
                            logger.error(
                                "extract_questions: Gemini returned response but JSON parsing "
                                f"failed. raw[:1000]={response_text[:1000]}"
                            )
                        questions_raw = parsed.get("questions", [])
                        detected_lang = parsed.get("detected_language", "unknown")
                        logger.info(f"extract_questions: detected_language={detected_lang}")

                        if isinstance(questions_raw, list) and len(questions_raw) > 0:
                            sanitized = _sanitize_questions(questions_raw)

                            if sanitized:
                                # Crop detected diagram/table regions from the single source image
                                await GeminiVisionService._crop_question_diagrams(
                                    sanitized,
                                    lambda q_idx: image_bytes,
                                )

                                logger.info(f"extract_questions: extracted {len(sanitized)} questions via Gemini (language: {detected_lang}).")
                                return {
                                    "questions": sanitized,
                                    "raw_ocr": parsed.get("raw_ocr", "OCR extraction completed successfully."),
                                    "detected_language": detected_lang,
                                    "error": None
                                }
            except Exception as e:
                logger.warning(f"extract_questions Gemini exception: {e}")

        # Text document extraction fallback (only for genuine text files, NOT PDFs or images)
        if detected_mime not in ("application/pdf", "image/png", "image/jpeg", "image/webp"):
            fallback_qs = GeminiVisionService._extract_document_questions_fallback(image_bytes, detected_mime)
            if fallback_qs:
                return {
                    "questions": fallback_qs,
                    "raw_ocr": "Document text parsed.",
                    "detected_language": "unknown",
                    "error": None
                }

        # If OCR fails or document has no questions, return clear error and empty list (NO FAKE QUESTIONS)
        return {
            "questions": [],
            "raw_ocr": "",
            "detected_language": "unknown",
            "error": "Could not extract questions from the uploaded document. "
                     "See server logs for the actual Gemini/extraction failure reason."
        }

    @staticmethod
    async def generate_rubric_for_question(
        question_text: str,
        marks_total: float,
        question_type: str = "short",
        subject: str = "General",
        options: Optional[List[str]] = None,
        correct_answer: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generates a question-specific marking rubric (key_points and deductions)
        tailored to the exact question text, type, subject, and marks.
        """
        client = get_gemini_client()
        options_section = ""
        if question_type == "mcq" and options:
            opts_str = "\n".join([f"Option {chr(65+i)}: {opt}" for i, opt in enumerate(options)])
            options_section = f"MCQ Options:\n{opts_str}\nCorrect Answer: {correct_answer or 'Not specified'}"

        prompt = RUBRIC_GENERATION_PROMPT.format(
            question_text=question_text,
            marks_total=marks_total,
            question_type=question_type,
            subject=subject,
            options_section=options_section
        )

        if client:
            try:
                response_text = await call_gemini_with_retry(contents=[prompt])
                if response_text:
                    parsed = clean_json_response(response_text)
                    key_points = parsed.get("key_points", [])
                    deductions = parsed.get("deductions", [])

                    validated_kps = []
                    for kp in key_points:
                        txt = str(kp.get("text", "")).strip()
                        pts = float(kp.get("points", 1.0) or 1.0)
                        if txt:
                            validated_kps.append({"text": txt, "points": max(0.5, pts)})

                    validated_deds = []
                    for d in deductions:
                        cond = str(d.get("error_condition", "")).strip()
                        pen = float(d.get("penalty", -1.0) or -1.0)
                        if cond:
                            validated_deds.append({"error_condition": cond, "penalty": -abs(pen)})

                    if validated_kps:
                        return {
                            "expected_answer_summary": parsed.get("expected_answer_summary", ""),
                            "key_points": validated_kps,
                            "deductions": validated_deds
                        }
            except Exception as e:
                logger.warning(f"Gemini rubric generation error: {e}")

        # Intelligent structured rubric tailored to question marks and type
        half_marks = round(marks_total / 2.0, 1)
        other_half = round(marks_total - half_marks, 1)
        return {
            "expected_answer_summary": f"Comprehensive answer covering core concepts of: {question_text[:80]}",
            "key_points": [
                {"text": f"Accurate definition and core principles for {question_text[:50]}", "points": half_marks},
                {"text": "Correct step-by-step derivation, calculation, or detailed supporting explanation", "points": other_half}
            ],
            "deductions": [
                {"error_condition": "Missing units or calculation/sign mistake", "penalty": -1.0},
                {"error_condition": "Incomplete answer or omission of required terms", "penalty": -half_marks}
            ]
        }

    @staticmethod
    async def extract_rubric(image_bytes: bytes, mime_type: str = "image/png") -> Dict[str, Any]:
        """
        Extracts expected key points and deduction rules from a marking scheme / answer key image.
        Uses Gemini Vision with multilingual support and automatic language detection.
        """
        detected_mime = detect_mime_type(image_bytes, fallback=mime_type)
        logger.info(f"extract_rubric: detected_mime={detected_mime}, bytes={len(image_bytes)}")

        client = get_gemini_client()
        if client:
            try:
                from google.genai import types

                # System instruction for multilingual OCR
                system_instruction = """You are a multilingual OCR expert specializing in academic marking schemes.
CRITICAL: Detect the document language FIRST (English, Urdu, or mixed), then extract ALL text in its ORIGINAL language.
NEVER translate, transliterate, or convert between languages. Preserve Urdu script (اردو) and English text exactly as written.
For Urdu text, maintain RTL direction. For English text, maintain LTR direction. Output only in the detected source language."""

                # ---- Handle PDF files: render pages as images ----
                if detected_mime == "application/pdf":
                    logger.info("extract_rubric: Processing PDF - rendering pages as images")
                    page_images = render_pdf_pages_as_images(image_bytes, dpi=300)
                    if not page_images:
                        logger.error("extract_rubric: Failed to render PDF pages")
                        return {
                            "question_text": "PDF Processing Failed",
                            "key_points": [],
                            "deductions": [],
                            "detected_language": "unknown"
                        }
                    # Use first page for rubric extraction (marking schemes are typically single-page)
                    part = types.Part.from_bytes(data=page_images[0], mime_type="image/png")
                else:
                    part = types.Part.from_bytes(data=image_bytes, mime_type=detected_mime)

                response_text = await call_gemini_with_key_rotation(
                    contents=[RUBRIC_EXTRACTION_PROMPT, part],
                    system_instruction=system_instruction
                )
                if response_text:
                    parsed = clean_json_response(response_text)
                    detected_lang = parsed.get("detected_language", "unknown")
                    logger.info(f"extract_rubric: successfully parsed rubric (language: {detected_lang}).")
                    return {
                        "question_text": parsed.get("question_text", ""),
                        "key_points": parsed.get("key_points", []),
                        "deductions": parsed.get("deductions", []),
                        "detected_language": detected_lang
                    }
            except Exception as e:
                logger.warning(f"extract_rubric Gemini error: {e}")

        return {
            "question_text": "Extracted Marking Scheme",
            "key_points": [
                {"text": "Core definition, governing formula, and key terminology", "points": 2.5},
                {"text": "Step-by-step substitution and correct final derivation/answer", "points": 2.5}
            ],
            "deductions": [
                {"error_condition": "Missing SI units in final step", "penalty": -1.0},
                {"error_condition": "Calculation or sign error", "penalty": -1.5}
            ],
            "detected_language": "unknown"
        }

    @staticmethod
    async def extract_bulk_answer_key(
        image_bytes: bytes,
        questions: List[Dict[str, Any]],
        mime_type: str = "image/png"
    ) -> Dict[str, Any]:
        """
        Extracts rubrics (key_points and deductions) for ALL questions from a single answer key document.
        Uses Gemini Vision with multilingual support to match answer key content to each question.
        """
        detected_mime = detect_mime_type(image_bytes, fallback=mime_type)
        logger.info(f"extract_bulk_answer_key: detected_mime={detected_mime}, bytes={len(image_bytes)}, questions={len(questions)}")

        # Build questions summary for the prompt
        questions_summary = []
        for q in questions:
            questions_summary.append({
                "order_index": q.get("order_index", 1),
                "text": q.get("text", ""),
                "marks": q.get("marks", 5),
                "question_type": q.get("question_type", "short"),
                "options": q.get("options", [])
            })

        questions_json = json.dumps(questions_summary, indent=2, ensure_ascii=False)
        prompt = BULK_ANSWER_KEY_EXTRACTION_PROMPT.format(
            questions_json=questions_json,
            question_count=len(questions)
        )

        client = get_gemini_client()
        if client:
            try:
                from google.genai import types

                # System instruction for multilingual OCR
                system_instruction = """You are a multilingual OCR expert specializing in academic answer keys and marking schemes.
CRITICAL: Detect the document language FIRST (English, Urdu, or mixed), then extract ALL text in its ORIGINAL language.
NEVER translate, transliterate, or convert between languages. Preserve Urdu script (اردو) and English text exactly as written.
For Urdu text, maintain RTL direction. For English text, maintain LTR direction. Output only in the detected source language."""

                # ---- Handle PDF files: render pages as images ----
                if detected_mime == "application/pdf":
                    logger.info("extract_bulk_answer_key: Processing PDF - rendering pages as images")
                    page_images = render_pdf_pages_as_images(image_bytes, dpi=300)
                    if not page_images:
                        logger.error("extract_bulk_answer_key: Failed to render PDF pages")
                        return {
                            "success": False,
                            "rubrics": {},
                            "error": "Failed to process PDF. The file may be corrupted or password-protected."
                        }
                    # Build contents with prompt + all page images
                    contents = [prompt]
                    for page_img in page_images:
                        contents.append(types.Part.from_bytes(data=page_img, mime_type="image/png"))
                else:
                    part = types.Part.from_bytes(data=image_bytes, mime_type=detected_mime)
                    contents = [prompt, part]

                response_text = await call_gemini_with_key_rotation(
                    contents=contents,
                    system_instruction=system_instruction
                )
                if response_text:
                    parsed = clean_json_response(response_text)
                    # Handle both array response and wrapped response
                    rubrics_list = parsed if isinstance(parsed, list) else parsed.get("rubrics", parsed.get("questions", []))

                    if isinstance(rubrics_list, list) and len(rubrics_list) > 0:
                        # Build a map of order_index -> rubric
                        rubric_map = {}
                        for item in rubrics_list:
                            idx = item.get("order_index", 0)
                            key_points = []
                            for kp in item.get("key_points", []):
                                txt = str(kp.get("text", "")).strip()
                                pts = float(kp.get("points", 1.0) or 1.0)
                                if txt:
                                    key_points.append({"text": txt, "points": max(0.5, pts)})

                            deductions = []
                            for d in item.get("deductions", []):
                                cond = str(d.get("error_condition", "")).strip()
                                pen = float(d.get("penalty", -1.0) or -1.0)
                                if cond:
                                    deductions.append({"error_condition": cond, "penalty": -abs(pen)})

                            rubric_map[idx] = {
                                "matched": item.get("matched", True),
                                "key_points": key_points,
                                "deductions": deductions
                            }

                        logger.info(f"extract_bulk_answer_key: successfully extracted rubrics for {len(rubric_map)} questions.")
                        return {
                            "success": True,
                            "rubrics": rubric_map,
                            "error": None
                        }
            except Exception as e:
                logger.warning(f"extract_bulk_answer_key Gemini error: {e}")

        return {
            "success": False,
            "rubrics": {},
            "error": "Failed to extract answer key. Please ensure the document is clearly legible and contains answer/marking scheme content."
        }

    @staticmethod
    async def grade_answer(
        question_id: str,
        question_text: str,
        marks_total: float,
        subject: str,
        key_points: List[Dict[str, Any]],
        deductions: List[Dict[str, Any]],
        image_bytes: Optional[bytes] = None,
        mime_type: str = "image/png",
        typed_answer_text: Optional[str] = None,
        expected_answer_summary: Optional[str] = None,
        correct_answer: Optional[str] = None,
        question_number: Optional[int] = None,
        total_questions: Optional[int] = None,
        marking_scheme: Optional[str] = None,
        level_bands: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Grades an individual answer (typed text on portal, handwritten image, or both)
        against its rubric and expected answer with semantic understanding and Urdu awareness.

        question_number: 1-based index of this question in the assessment (for multi-Q sheets).
        total_questions: Total number of questions in the assessment.
        """
        # Strict pre-check: If student submitted neither typed text nor an image, score is 0.0
        has_text = bool(typed_answer_text and typed_answer_text.strip())
        has_image = bool(image_bytes and len(image_bytes) > 0)
        if not has_text and not has_image:
            return {
                "question_id": question_id,
                "marks_awarded": 0.0,
                "marks_total": marks_total,
                "confidence_score": 1.0,
                "correct_points": [],
                "deducted_points": [{
                    "issue": "No Answer Provided",
                    "reason": "Student left the question completely blank.",
                    "concept": f"{subject} > General",
                    "penalty": -marks_total
                }],
                "annotations": [],
                "improvement_tip": "Make sure to attempt this question. Even partial steps can earn method marks.",
                "extracted_answer_text": "[Blank / No Answer]",
                "ai_summary_en": "No answer was provided for this question. Zero marks awarded.",
                "ai_summary_ur": "اس سوال کا کوئی جواب جمع نہیں کرایا گیا۔ صفر نمبر دیے گئے۔"
            }

        # --- Build key points formatted text with mandatory keyword markers ---
        key_points_lines = []
        for kp in key_points:
            kp_text = kp.get('text', '')
            kp_pts = kp.get('points', 1.0)
            is_mandatory = kp.get('is_mandatory_keyword', False)
            if is_mandatory:
                key_points_lines.append(f"- [MANDATORY KEYWORD] {kp_text} (+{kp_pts} marks) — Student MUST use this exact term.")
            else:
                key_points_lines.append(f"- {kp_text} (+{kp_pts} marks)")
        key_points_formatted = "\n".join(key_points_lines) or f"- Demonstrates accurate understanding of {question_text[:50]} (+{marks_total} marks)"

        deductions_formatted = "\n".join([
            f"- {d.get('error_condition', '')} ({d.get('penalty', -1.0)} penalty)" for d in deductions
        ]) or "- Major factual error or contradiction (-100% of question marks)"

        expected_summary = expected_answer_summary or (f"Correct answer: {correct_answer}" if correct_answer else "Standard academic response addressing all parts of the question.")

        # --- Choose prompt template based on marking scheme ---
        use_level_based = marking_scheme == 'level_based' and level_bands and len(level_bands) > 0

        if use_level_based:
            level_bands_text = "\n".join([
                f"Level {lb.get('level', i+1)}: {lb.get('min_marks', 0)}-{lb.get('max_marks', marks_total)} marks — {lb.get('descriptor', 'No descriptor')}"
                for i, lb in enumerate(level_bands)
            ])
            prompt = LEVEL_BASED_GRADING_PROMPT_TEMPLATE.format(
                question_id=question_id,
                question_text=question_text,
                marks_total=marks_total,
                subject=subject,
                expected_answer_summary=expected_summary,
                level_bands_text=level_bands_text
            )
        else:
            prompt = GRADING_PROMPT_TEMPLATE.format(
                question_id=question_id,
                question_text=question_text,
                marks_total=marks_total,
                subject=subject,
                expected_answer_summary=expected_summary,
                key_points_text=key_points_formatted,
                deductions_text=deductions_formatted
            )

        if typed_answer_text:
            # Build context-aware prompt for multi-question answer sheets
            if question_number and total_questions and total_questions > 1:
                prompt += (
                    f"\n\nSTUDENT'S SUBMITTED ANSWER (for Question {question_number} of {total_questions}):\n"
                    f'\"\"\"\n{typed_answer_text.strip()}\n\"\"\"\n\n'
                    f"IMPORTANT: The text above may contain answers to MULTIPLE questions from the "
                    f"student's answer sheet. You must identify and evaluate ONLY the answer that "
                    f"corresponds to THIS SPECIFIC question (Question {question_number}). "
                    f"Look for question numbers, headings, or contextual clues to find the right answer. "
                    f"If you cannot find an answer for this specific question in the text, "
                    f"award 0 marks with a note explaining the answer was not found. "
                    f"Do NOT award marks for content that answers OTHER questions."
                )
            else:
                prompt += f"\n\nSTUDENT'S SUBMITTED ANSWER:\n\"\"\"\n{typed_answer_text.strip()}\n\"\"\"\nEvaluate this submitted answer strictly according to the rubric criteria. Judge the meaning and correctness, not exact wording match."

        # ---- OCR: Two-step pipeline ----
        # Step 1: English/Math via local EasyOCR (free, no API calls).
        # Step 2: Urdu via targeted Gemini Flash on a downscaled image.
        ocr_extracted_text = ""
        if has_image:
            try:
                detected_mime = detect_mime_type(image_bytes, fallback=mime_type)
                ocr_extracted_text = await extract_student_answer_text(
                    image_bytes,
                    detected_mime,
                    question_text=question_text,
                    expected_answer=expected_summary,
                )
                if ocr_extracted_text:
                    if question_number and total_questions and total_questions > 1:
                        prompt += (
                            f"\n\nSTUDENT'S HANDWRITTEN ANSWER (extracted via OCR for Question {question_number} of {total_questions}):\n"
                            f'\"\"\"\n{ocr_extracted_text.strip()}\n\"\"\"\n\n'
                            f"IMPORTANT: The OCR text above may contain answers to MULTIPLE questions from "
                            f"the student's answer sheet. Identify and evaluate ONLY the answer for "
                            f"THIS SPECIFIC question (Question {question_number}). "
                            f"Look for question numbers, headings, or contextual clues. "
                            f"If no answer for this question is found, award 0 marks. "
                            f"Account for possible OCR transcription errors in handwriting."
                        )
                    else:
                        prompt += (
                            f"\n\nSTUDENT'S HANDWRITTEN ANSWER (extracted via OCR):\n"
                            f"\"\"\"\n{ocr_extracted_text.strip()}\n\"\"\"\n"
                            f"Evaluate this extracted answer strictly according to the rubric criteria. "
                            f"Judge the meaning and correctness, not exact wording match. "
                            f"Account for possible OCR transcription errors in handwriting."
                        )
                    logger.info(
                        f"grade_answer: OCR extracted {len(ocr_extracted_text)} chars "
                        f"for question {question_id}"
                    )
                else:
                    logger.warning(f"grade_answer: OCR returned empty text for question {question_id}")
            except OCRError as e:
                logger.error(f"grade_answer: OCR failed for question {question_id}: {e}")
                # If OCR fails and there's no typed answer, we can't grade
                if not has_text:
                    return {
                        "question_id": question_id,
                        "marks_awarded": 0.0,
                        "marks_total": marks_total,
                        "confidence_score": 0.0,
                        "correct_points": [],
                        "deducted_points": [{
                            "issue": "OCR Extraction Failed",
                            "reason": f"Could not extract text from uploaded image: {e}",
                            "concept": f"{subject} > General",
                            "penalty": 0.0
                        }],
                        "annotations": [],
                        "improvement_tip": "Please re-upload a clearer image of your answer, or type your answer directly.",
                        "extracted_answer_text": f"[OCR Failed: {e}]",
                        "ai_summary_en": "OCR extraction failed for the uploaded image. Teacher review required.",
                        "ai_summary_ur": "اپ لوڈ کردہ تصویر سے OCR نکالنا ناکام ہو گیا۔ استاد کا جائزہ ضروری ہے۔"
                    }

        # ---- Step 3: Grading via Groq (DeepSeek-R1), Gemini as fallback ----
        # Text-only input: prompt + extracted answer. No images are sent.
        groq_text = await call_groq_grading(prompt)
        if groq_text:
            parsed = clean_json_response(groq_text)
            if "marks_awarded" in parsed:
                marks_awarded = max(0.0, min(float(parsed.get("marks_awarded", 0.0)), marks_total))
                parsed["marks_awarded"] = marks_awarded
                parsed["marks_total"] = marks_total
                parsed["question_id"] = question_id
                if not parsed.get("extracted_answer_text"):
                    parsed["extracted_answer_text"] = typed_answer_text or ocr_extracted_text or ""
                logger.info(f"grade_answer: question_id={question_id} awarded {marks_awarded}/{marks_total} via Groq")
                return parsed
            logger.warning("grade_answer: Groq response missing marks_awarded, trying Gemini fallback")

        # Fallback: Gemini grading (existing path)
        client = get_gemini_client()
        if client:
            try:
                # Gemini receives ONLY text (prompt with embedded OCR/typed answer). No image data.
                contents = [prompt]
                response_text = await call_gemini_with_retry(contents=contents)
                if response_text:
                    parsed = clean_json_response(response_text)
                    if "marks_awarded" in parsed:
                        marks_awarded = max(0.0, min(float(parsed.get("marks_awarded", 0.0)), marks_total))
                        parsed["marks_awarded"] = marks_awarded
                        parsed["marks_total"] = marks_total
                        parsed["question_id"] = question_id
                        if not parsed.get("extracted_answer_text"):
                            parsed["extracted_answer_text"] = typed_answer_text or ocr_extracted_text or ""
                        logger.info(f"grade_answer: question_id={question_id} awarded {marks_awarded}/{marks_total} via Gemini fallback")
                        return parsed
            except Exception as e:
                logger.warning(f"Gemini grading exception for question {question_id}: {e}")

        # Semantic evaluation fallback: evaluates conceptual meaning and awards appropriate marks (never zero for valid answers)
        evaluated = SemanticEvaluator.evaluate_answer(
            question_text=question_text,
            marks_total=marks_total,
            subject=subject,
            key_points=key_points,
            deductions=deductions,
            student_answer=typed_answer_text or ocr_extracted_text or ("Answer submitted via student upload." if has_image else ""),
            expected_answer=expected_summary
        )
        evaluated["question_id"] = question_id
        if typed_answer_text and not evaluated.get("extracted_answer_text"):
            evaluated["extracted_answer_text"] = typed_answer_text
        elif ocr_extracted_text and not evaluated.get("extracted_answer_text"):
            evaluated["extracted_answer_text"] = ocr_extracted_text
        return evaluated

    @staticmethod
    async def revise_evaluation_with_instruction(
        questions_data: List[Dict[str, Any]],
        overall_score: float,
        total_marks: float,
        teacher_instruction: str,
        image_bytes: Optional[bytes] = None
    ) -> Dict[str, Any]:
        """
        Processes a teacher's instruction to re-evaluate or modify AI-generated scores.
        Generates proposed revised scores and explanatory rationale without publishing as final.
        """
        logger.info(f"revise_evaluation_with_instruction: '{teacher_instruction}'")
        client = get_gemini_client()

        questions_summary = "\n".join([
            f"- Question ID: {q['id']} (Q{q.get('order_index', 1)}): {q.get('text', '')[:100]} | Max: {q['marks_total']} | Currently Awarded: {q['marks_awarded']} | Current Tip: {q.get('improvement_tip', '')}"
            for q in questions_data
        ])

        system_prompt = (
            "You are an AI Grading Assistant for teachers. A teacher is reviewing an assignment and instructing you "
            "to adjust, reconsider, or revise the awarded marks. Your job is to process the instruction carefully, "
            "calculate the revised score (clamped between 0 and each question's max marks), and provide a clear explanation."
        )

        user_prompt = f"""The teacher has provided this instruction:
"{teacher_instruction}"

Current Assessment Information:
Total Possible Marks: {total_marks}
Current Overall Awarded Score: {overall_score}

Questions:
{questions_summary}

Please return a valid JSON object matching this schema:
{{
  "revised_overall_score": <float>,
  "ai_revision_notes": "<detailed explanation of what was modified and why based on teacher instruction>",
  "question_revisions": [
    {{
      "question_id": "<string>",
      "revised_marks_awarded": <float>,
      "notes": "<string>"
    }}
  ]
}}
"""
        # Attempt Gemini call (text only — no image data sent to Gemini)
        if client:
            try:
                contents = [user_prompt]

                response_text = await call_gemini_with_retry(
                    contents=contents,
                    system_instruction=system_prompt
                )
                if response_text:
                    parsed = clean_json_response(response_text)
                    if "revised_overall_score" in parsed and "question_revisions" in parsed:
                        # Validate and clamp
                        revised_map = {}
                        for qr in parsed["question_revisions"]:
                            qid = qr.get("question_id")
                            score = float(qr.get("revised_marks_awarded", 0.0))
                            matching_q = next((q for q in questions_data if q["id"] == qid), None)
                            max_m = matching_q["marks_total"] if matching_q else total_marks
                            revised_map[qid] = max(0.0, min(score, max_m))

                        # Re-calculate total from map if all questions present
                        calc_total = sum(revised_map.get(q["id"], q["marks_awarded"]) for q in questions_data)
                        return {
                            "revised_overall_score": float(parsed.get("revised_overall_score", calc_total)),
                            "ai_revision_notes": str(parsed.get("ai_revision_notes", f"Revised per teacher instruction: '{teacher_instruction}'")),
                            "question_revisions": revised_map
                        }
            except Exception as e:
                logger.warning(f"Gemini revision call failed, using rule-based revision fallback: {e}")

        # Intelligent rule-based fallback for standard instructions
        instruction_lower = teacher_instruction.lower().strip()
        delta = 0.0
        target_score = None

        # Check for explicit numbers
        inc_match = re.search(r"(?:increase|add|raise|give)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*(?:marks|pts|points)?", instruction_lower)
        dec_match = re.search(r"(?:decrease|reduce|deduct|lower)\s+(?:by\s+)?(\d+(?:\.\d+)?)\s*(?:marks|pts|points)?", instruction_lower)
        set_match = re.search(r"(?:change|set|make)\s+(?:proposed\s+score\s+to|to|score\s+to)\s*(\d+(?:\.\d+)?)", instruction_lower)

        if set_match:
            target_score = float(set_match.group(1))
            delta = target_score - overall_score
        elif inc_match:
            delta = float(inc_match.group(1))
        elif dec_match:
            delta = -float(dec_match.group(1))
        elif "partial" in instruction_lower or "reasoning" in instruction_lower or "concept" in instruction_lower:
            delta = max(1.0, round(total_marks * 0.1))
        elif "rubric" in instruction_lower or "re-evaluate" in instruction_lower:
            delta = 0.0

        # Distribute delta across questions
        revised_map = {}
        remaining_delta = delta
        for idx, q in enumerate(questions_data):
            curr = q["marks_awarded"]
            max_m = q["marks_total"]
            if idx == 0 and len(questions_data) == 1:
                new_q_score = max(0.0, min(curr + remaining_delta, max_m))
            elif len(questions_data) > 0:
                portion = remaining_delta / len(questions_data)
                new_q_score = max(0.0, min(curr + portion, max_m))
            else:
                new_q_score = curr
            revised_map[q["id"]] = round(new_q_score, 1)

        revised_total = sum(revised_map.values())
        if target_score is not None:
            revised_total = min(total_marks, max(0.0, target_score))

        notes = f"AI Re-evaluation: Adjusted score by {delta:+.1f} marks based on teacher instruction ('{teacher_instruction}'). Proposed revised total is {revised_total}/{total_marks}."
        return {
            "revised_overall_score": revised_total,
            "ai_revision_notes": notes,
            "question_revisions": revised_map
        }
