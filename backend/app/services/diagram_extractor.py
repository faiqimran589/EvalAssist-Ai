"""
Diagram & Table Extraction Service for EvalAssist.

Detects embedded diagrams, figures, charts, and tables within uploaded
exam papers or answer sheets. Crops the detected visual assets and stores
them locally so they can be linked to specific MCQ or short-answer questions.

Uses PIL + NumPy for lightweight local detection (no OpenCV dependency).
Falls back to full-page crop if no embedded figures are detected.
"""

import io
import os
import uuid
import logging
from pathlib import Path
from typing import List, Dict, Optional, Tuple

import numpy as np
from PIL import Image, ImageFilter

from app.core.config import settings

logger = logging.getLogger("evalassist.diagram_extractor")

# Minimum bounding box dimensions (px) to qualify as a diagram region
MIN_WIDTH = 80
MIN_HEIGHT = 60
# Edge-density threshold: a region must have at least this fraction of edge pixels
EDGE_DENSITY_THRESHOLD = 0.08
# Scan grid cell size for edge-density analysis
CELL_SIZE = 32


def _detect_edge_density(image: Image.Image) -> np.ndarray:
    """Returns a 2D numpy array of edge-density values per grid cell."""
    gray = image.convert("L")
    edges = gray.filter(ImageFilter.FIND_EDGES)
    edge_arr = np.array(edges, dtype=np.float32) / 255.0

    h, w = edge_arr.shape
    rows = max(1, h // CELL_SIZE)
    cols = max(1, w // CELL_SIZE)
    density = np.zeros((rows, cols), dtype=np.float32)

    for r in range(rows):
        for c in range(cols):
            y0 = r * CELL_SIZE
            y1 = min((r + 1) * CELL_SIZE, h)
            x0 = c * CELL_SIZE
            x1 = min((c + 1) * CELL_SIZE, w)
            cell = edge_arr[y0:y1, x0:x1]
            density[r, c] = cell.mean() if cell.size > 0 else 0.0

    return density


def _find_diagram_regions(
    density: np.ndarray,
    img_width: int,
    img_height: int,
) -> List[Tuple[int, int, int, int]]:
    """
    Identifies rectangular regions with high edge density (likely diagrams/figures).
    Returns list of (x, y, w, h) bounding boxes in pixel coordinates.
    """
    rows, cols = density.shape
    visited = np.zeros_like(density, dtype=bool)
    regions: List[Tuple[int, int, int, int]] = []

    for r in range(rows):
        for c in range(cols):
            if visited[r, c] or density[r, c] < EDGE_DENSITY_THRESHOLD:
                continue

            # Flood-fill connected high-density cells
            stack = [(r, c)]
            min_r, max_r = r, r
            min_c, max_c = c, c

            while stack:
                cr, cc = stack.pop()
                if cr < 0 or cr >= rows or cc < 0 or cc >= cols:
                    continue
                if visited[cr, cc] or density[cr, cc] < EDGE_DENSITY_THRESHOLD:
                    continue
                visited[cr, cc] = True
                min_r = min(min_r, cr)
                max_r = max(max_r, cr)
                min_c = min(min_c, cc)
                max_c = max(max_c, cc)
                stack.extend([(cr - 1, cc), (cr + 1, cc), (cr, cc - 1), (cr, cc + 1)])

            # Convert grid coords to pixel coords
            x = min_c * CELL_SIZE
            y = min_r * CELL_SIZE
            w = (max_c - min_c + 1) * CELL_SIZE
            h = (max_r - min_r + 1) * CELL_SIZE

            if w >= MIN_WIDTH and h >= MIN_HEIGHT:
                # Add padding
                pad = 10
                x = max(0, x - pad)
                y = max(0, y - pad)
                w = min(img_width - x, w + 2 * pad)
                h = min(img_height - y, h + 2 * pad)
                regions.append((x, y, w, h))

    # Merge overlapping regions
    merged = _merge_overlapping(regions)
    return merged


def _merge_overlapping(
    regions: List[Tuple[int, int, int, int]],
) -> List[Tuple[int, int, int, int]]:
    """Merges overlapping bounding boxes into larger enclosing boxes."""
    if not regions:
        return []

    merged: List[List[int]] = [list(r) for r in regions]
    changed = True
    while changed:
        changed = False
        new_merged: List[List[int]] = []
        used = set()
        for i in range(len(merged)):
            if i in used:
                continue
            x1, y1, w1, h1 = merged[i]
            for j in range(i + 1, len(merged)):
                if j in used:
                    continue
                x2, y2, w2, h2 = merged[j]
                # Check overlap
                if (
                    x1 < x2 + w2 and x1 + w1 > x2 and
                    y1 < y2 + h2 and y1 + h1 > y2
                ):
                    # Merge
                    nx = min(x1, x2)
                    ny = min(y1, y2)
                    nw = max(x1 + w1, x2 + w2) - nx
                    nh = max(y1 + h1, y2 + h2) - ny
                    merged[i] = [nx, ny, nw, nh]
                    used.add(j)
                    changed = True
            new_merged.append(merged[i])
        merged = new_merged

    return [tuple(r) for r in merged]  # type: ignore


def _save_crop(image: Image.Image, bbox: Tuple[int, int, int, int]) -> Optional[str]:
    """Crops the region and saves it to the uploads directory. Returns the relative path."""
    try:
        x, y, w, h = bbox
        crop = image.crop((x, y, x + w, y + h))

        # Ensure output directory exists
        upload_base = Path(settings.UPLOAD_DIR).resolve() / "diagrams"
        upload_base.mkdir(parents=True, exist_ok=True)

        filename = f"{uuid.uuid4()}.png"
        filepath = upload_base / filename
        crop.save(str(filepath), format="PNG", optimize=True)

        relative_path = f"uploads/diagrams/{filename}"
        logger.info(f"Saved diagram crop: {relative_path} ({w}x{h}px)")
        return relative_path
    except Exception as e:
        logger.error(f"Failed to save diagram crop: {e}")
        return None


def crop_mcq_asset(
    page_image_bytes: bytes,
    bounding_box: List[float],
    mcq_id: str,
) -> Optional[str]:
    """
    Crops a diagram/table region from a page image using Gemini-normalized bounding box
    coordinates and saves it as a PNG file linked to a specific MCQ question.

    Args:
        page_image_bytes: Raw bytes of the full page image (PNG/JPEG/WEBP).
        bounding_box: [ymin, xmin, ymax, xmax] on a normalized 0-1000 scale
                      relative to page dimensions.
        mcq_id: Unique identifier for the MCQ question (used as filename).

    Returns:
        Relative file URL (e.g. "uploads/mcq_diagrams/<mcq_id>.png") or None on failure.
    """
    if not bounding_box or len(bounding_box) != 4:
        logger.warning(f"crop_mcq_asset: invalid bounding_box for mcq_id={mcq_id}")
        return None

    try:
        image = Image.open(io.BytesIO(page_image_bytes))
        img_width, img_height = image.size

        ymin_norm, xmin_norm, ymax_norm, xmax_norm = bounding_box

        # Convert normalized 0-1000 coordinates to pixel coordinates
        xmin_px = int(xmin_norm * img_width / 1000)
        ymin_px = int(ymin_norm * img_height / 1000)
        xmax_px = int(xmax_norm * img_width / 1000)
        ymax_px = int(ymax_norm * img_height / 1000)

        # Clamp to image boundaries
        xmin_px = max(0, min(xmin_px, img_width))
        ymin_px = max(0, min(ymin_px, img_height))
        xmax_px = max(xmin_px + 1, min(xmax_px, img_width))
        ymax_px = max(ymin_px + 1, min(ymax_px, img_height))

        crop_box = (xmin_px, ymin_px, xmax_px, ymax_px)
        cropped = image.crop(crop_box)

        # Ensure output directory exists
        upload_base = Path(settings.UPLOAD_DIR).resolve() / "mcq_diagrams"
        upload_base.mkdir(parents=True, exist_ok=True)

        filename = f"{mcq_id}.png"
        filepath = upload_base / filename
        cropped.save(str(filepath), format="PNG", optimize=True)

        relative_url = f"uploads/mcq_diagrams/{filename}"
        logger.info(
            f"crop_mcq_asset: saved {relative_url} "
            f"(bbox={crop_box}, image={img_width}x{img_height})"
        )
        return relative_url

    except Exception as e:
        logger.error(f"crop_mcq_asset failed for mcq_id={mcq_id}: {e}")
        return None


async def extract_diagrams_from_image(
    image_bytes: bytes,
    mime_type: str = "image/png",
    max_diagrams: int = 10,
) -> List[Dict[str, any]]:
    """
    Detects and crops embedded diagrams, figures, charts, and tables
    from an uploaded exam paper image.

    Returns a list of dicts:
    [
        {
            "image_url": "uploads/diagrams/<uuid>.png",
            "bbox": [x, y, w, h],
            "width": <px>,
            "height": <px>
        },
        ...
    ]
    """
    try:
        image = Image.open(io.BytesIO(image_bytes))
        img_width, img_height = image.size
        logger.info(f"Diagram extraction: image size {img_width}x{img_height}")
    except Exception as e:
        logger.error(f"Failed to open image for diagram extraction: {e}")
        return []

    # Detect edge density grid
    density = _detect_edge_density(image)

    # Find diagram regions
    regions = _find_diagram_regions(density, img_width, img_height)
    logger.info(f"Detected {len(regions)} potential diagram regions")

    # Limit to max_diagrams and sort by area (largest first)
    regions.sort(key=lambda r: r[2] * r[3], reverse=True)
    regions = regions[:max_diagrams]

    # Crop and save each region
    results: List[Dict[str, any]] = []
    for bbox in regions:
        url = _save_crop(image, bbox)
        if url:
            results.append({
                "image_url": url,
                "bbox": list(bbox),
                "width": bbox[2],
                "height": bbox[3],
            })

    return results


async def extract_diagrams_from_pdf(
    pdf_bytes: bytes,
    max_diagrams_per_page: int = 5,
) -> List[Dict[str, any]]:
    """
    Renders each PDF page as an image and extracts diagrams from each page.
    Returns combined list of all diagram crops across all pages.
    """
    try:
        import pymupdf  # PyMuPDF
    except ImportError:
        logger.error("PyMuPDF not installed — cannot process PDF for diagram extraction")
        return []

    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
        all_diagrams: List[Dict[str, any]] = []

        for page_num in range(len(doc)):
            page = doc[page_num]
            zoom = 300 / 72.0  # 300 DPI
            mat = pymupdf.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat, alpha=False)
            page_img_bytes = pix.tobytes("png")

            page_diagrams = await extract_diagrams_from_image(
                page_img_bytes,
                mime_type="image/png",
                max_diagrams=max_diagrams_per_page,
            )
            # Tag each diagram with its source page
            for d in page_diagrams:
                d["page"] = page_num + 1
            all_diagrams.extend(page_diagrams)

        doc.close()
        logger.info(f"Extracted {len(all_diagrams)} diagrams from {len(doc)} PDF pages")
        return all_diagrams
    except Exception as e:
        logger.error(f"PDF diagram extraction failed: {e}")
        return []
