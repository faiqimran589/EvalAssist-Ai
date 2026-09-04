"""Unit tests for question-paper extraction image/PDF preprocessing.

These tests do not call Gemini. They verify payload sizing, that small inputs
are left alone, that student-answer OCR downscale defaults are unchanged,
and that normalized 0-1000 bounding boxes still crop the same relative region
after a uniform resize (the transform sent to Gemini).
"""
import io
import sys
from pathlib import Path

from PIL import Image, ImageDraw

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.services.ocr_service import (  # noqa: E402
    GEMINI_IMAGE_MAX_DIM,
    QUESTION_EXTRACT_MAX_BYTES,
    QUESTION_EXTRACT_MAX_DIM,
    QUESTION_EXTRACT_JPEG_QUALITY,
    QUESTION_EXTRACT_PNG_JPEG_THRESHOLD,
    _downscale_image_for_gemini,
    prepare_image_for_gemini,
)
from app.services.gemini_vision import (  # noqa: E402
    PDF_EXTRACT_TARGET_LONG_EDGE,
    _sanitize_questions,
    render_pdf_pages_as_images,
)
from app.schemas.assessment import QuestionExtractItem, QuestionExtractResponse  # noqa: E402


def _png_bytes(width: int, height: int, color=(240, 240, 240)) -> bytes:
    img = Image.new("RGB", (width, height), color)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _jpeg_bytes(width: int, height: int, quality: int = 90) -> bytes:
    img = Image.new("RGB", (width, height), (240, 240, 240))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=quality)
    return buf.getvalue()


def _extract_prepare(image_bytes: bytes, page_num=None):
    return prepare_image_for_gemini(
        image_bytes,
        max_dim=QUESTION_EXTRACT_MAX_DIM,
        max_bytes=QUESTION_EXTRACT_MAX_BYTES,
        jpeg_quality=QUESTION_EXTRACT_JPEG_QUALITY,
        png_jpeg_threshold=QUESTION_EXTRACT_PNG_JPEG_THRESHOLD,
        log_prefix="test_extract",
        page_num=page_num,
    )


def test_small_image_left_unchanged():
    original = _png_bytes(800, 600)
    prepared, mime = _extract_prepare(original)
    assert prepared is original or prepared == original
    assert mime == "image/png"
    with Image.open(io.BytesIO(prepared)) as img:
        assert img.size == (800, 600)


def test_large_image_is_downscaled_not_tiny():
    original = _jpeg_bytes(5000, 4000, quality=95)
    prepared, mime = _extract_prepare(original)
    with Image.open(io.BytesIO(prepared)) as img:
        w, h = img.size
    assert max(w, h) <= QUESTION_EXTRACT_MAX_DIM
    assert max(w, h) >= 2000  # must not crush to ~1024
    assert mime == "image/jpeg"
    assert len(prepared) < len(original)
    assert len(prepared) <= QUESTION_EXTRACT_MAX_BYTES


def test_student_ocr_downscale_still_caps_at_1024():
    original = _jpeg_bytes(3000, 2000)
    down = _downscale_image_for_gemini(original)
    with Image.open(io.BytesIO(down)) as img:
        assert max(img.size) <= GEMINI_IMAGE_MAX_DIM
        assert max(img.size) <= 1024


def test_student_ocr_small_image_not_resized():
    original = _png_bytes(640, 480)
    down = _downscale_image_for_gemini(original)
    assert down == original


def test_extraction_does_not_use_student_1024_cap_on_medium_pages():
    """A 2000px page is fine for extraction and must not be forced to 1024."""
    original = _jpeg_bytes(2000, 1400)
    prepared, _mime = _extract_prepare(original)
    with Image.open(io.BytesIO(prepared)) as img:
        assert img.size == (2000, 1400)


def test_response_schema_fields_unchanged():
    item = QuestionExtractItem(
        order_index=1,
        text="What is 2+2?",
        marks=2.0,
        question_type="mcq",
        answer_lines=0,
        options=["3", "4"],
        correct_answer="4",
        has_diagram_or_table=True,
        bounding_box=[10.0, 20.0, 300.0, 400.0],
        diagram_image_url=None,
    )
    resp = QuestionExtractResponse(
        questions=[item],
        raw_ocr="What is 2+2?",
        error=None,
    )
    dumped = item.model_dump()
    assert set(dumped.keys()) >= {
        "order_index",
        "text",
        "marks",
        "question_type",
        "answer_lines",
        "options",
        "correct_answer",
        "has_diagram_or_table",
        "bounding_box",
        "diagram_image_url",
    }
    assert resp.questions[0].bounding_box == [10.0, 20.0, 300.0, 400.0]


def test_sanitize_preserves_order_and_bbox():
    raw = [
        {
            "text": "Question A",
            "question_type": "short",
            "marks": 5,
            "has_diagram_or_table": True,
            "bounding_box": [100, 50, 400, 500],
        },
        {
            "text": "سوال ب",
            "question_type": "mcq",
            "options": ["الف", "ب"],
            "has_diagram_or_table": False,
            "bounding_box": None,
        },
    ]
    out = _sanitize_questions(raw)
    assert [q["text"] for q in out] == ["Question A", "سوال ب"]
    assert out[0]["order_index"] == 1
    assert out[1]["order_index"] == 2
    assert out[0]["bounding_box"] == [100.0, 50.0, 400.0, 500.0]
    assert out[1]["options"] == ["الف", "ب"]


def test_normalized_bbox_compatible_after_uniform_resize(tmp_path, monkeypatch):
    """Gemini sees a uniformly scaled page; crop still uses the original page."""
    from app.core import config as config_mod
    from app.services.diagram_extractor import crop_mcq_asset

    monkeypatch.setattr(config_mod.settings, "UPLOAD_DIR", str(tmp_path))

    w, h = 2000, 1000
    img = Image.new("RGB", (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    # Region corresponding to bbox [100, 200, 400, 600] on 0-1000 scale
    box = (int(200 * w / 1000), int(100 * h / 1000), int(600 * w / 1000), int(400 * h / 1000))
    draw.rectangle(box, fill=(220, 30, 30))
    orig_buf = io.BytesIO()
    img.save(orig_buf, format="PNG")
    original = orig_buf.getvalue()

    prepared, _mime = prepare_image_for_gemini(
        original,
        max_dim=1000,
        max_bytes=QUESTION_EXTRACT_MAX_BYTES,
        jpeg_quality=85,
        png_jpeg_threshold=None,
        log_prefix="bbox_test",
    )
    with Image.open(io.BytesIO(prepared)) as gemini_img:
        gw, gh = gemini_img.size
        assert abs(gw / gh - w / h) < 0.02

    bbox = [100.0, 200.0, 400.0, 600.0]
    url = crop_mcq_asset(original, bbox, "bbox_compat_q1")
    assert url
    cropped = Image.open(tmp_path / "mcq_diagrams" / "bbox_compat_q1.png")
    cx, cy = cropped.size[0] // 2, cropped.size[1] // 2
    pixel = cropped.convert("RGB").getpixel((cx, cy))
    assert pixel[0] > 180 and pixel[1] < 80


def _make_multipage_pdf(page_count: int = 2, scanned: bool = False) -> bytes:
    import pymupdf

    doc = pymupdf.open()
    for i in range(page_count):
        page = doc.new_page(width=595, height=842)  # A4 points
        if scanned:
            pix = pymupdf.Pixmap(pymupdf.csRGB, pymupdf.IRect(0, 0, 400, 300), 0)
            pix.clear_with(230)
            page.insert_image(page.rect, pixmap=pix)
        else:
            page.insert_text((72, 72), f"Question {i + 1}. Define photosynthesis.")
    data = doc.tobytes()
    doc.close()
    return data


def test_adaptive_pdf_render_smaller_than_300dpi():
    pdf_bytes = _make_multipage_pdf(2, scanned=False)
    pages_300 = render_pdf_pages_as_images(pdf_bytes, dpi=300)
    pages_adapt = render_pdf_pages_as_images(
        pdf_bytes, target_long_edge=PDF_EXTRACT_TARGET_LONG_EDGE
    )
    assert len(pages_adapt) == 2
    assert len(pages_300) == 2
    for a, b in zip(pages_adapt, pages_300):
        with Image.open(io.BytesIO(a)) as ia, Image.open(io.BytesIO(b)) as ib:
            assert max(ia.size) <= PDF_EXTRACT_TARGET_LONG_EDGE + 5
            assert max(ia.size) < max(ib.size)
            assert max(ia.size) >= 1600  # still dense-page readable


def test_scanned_pdf_still_rasterized_not_text_extracted():
    pdf_bytes = _make_multipage_pdf(1, scanned=True)
    pages = render_pdf_pages_as_images(
        pdf_bytes, target_long_edge=PDF_EXTRACT_TARGET_LONG_EDGE
    )
    assert len(pages) == 1
    with Image.open(io.BytesIO(pages[0])) as img:
        assert img.size[0] > 100 and img.size[1] > 100
    prepared, mime = _extract_prepare(pages[0], page_num=1)
    assert mime in ("image/jpeg", "image/png")
    assert len(prepared) <= QUESTION_EXTRACT_MAX_BYTES


def test_extraction_pdf_pages_prepared_individually():
    """Multi-page PDFs stay per-page; each prepared payload is bounded."""
    pdf_bytes = _make_multipage_pdf(3, scanned=False)
    pages = render_pdf_pages_as_images(
        pdf_bytes, target_long_edge=PDF_EXTRACT_TARGET_LONG_EDGE
    )
    assert len(pages) == 3
    sizes = []
    for i, page in enumerate(pages, start=1):
        prepared, mime = _extract_prepare(page, page_num=i)
        sizes.append(len(prepared))
        assert mime == "image/jpeg" or len(page) <= QUESTION_EXTRACT_PNG_JPEG_THRESHOLD
        assert len(prepared) <= QUESTION_EXTRACT_MAX_BYTES
        with Image.open(io.BytesIO(prepared)) as img:
            assert max(img.size) <= QUESTION_EXTRACT_MAX_DIM
    # Pages are processed separately, not concatenated into one payload
    assert sum(sizes) > max(sizes)
