"""
Groq Cloud grading service for EvalAssist.

Handles the MARKING/EVALUATION step of the student grading pipeline using
Groq's free tier (currently openai/gpt-oss-120b — a 120B reasoning model).

Text-only input (extracted student answer + rubric prompt) -> graded JSON output.
No images are ever sent to Groq — OCR is handled separately (EasyOCR + Gemini-Urdu).
"""

import asyncio
import logging
import re
from typing import Optional

from app.core.config import settings

logger = logging.getLogger("evalassist.groq")

# Retry delays for transient errors (seconds)
RETRY_DELAYS = [2.0, 5.0, 10.0]

# DeepSeek-R1 reasoning models emit <think>...</think> blocks before the answer
_THINK_BLOCK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)


def strip_reasoning(text: str) -> str:
    """Removes DeepSeek-R1 <think>...</think> reasoning blocks from model output."""
    if not text:
        return ""
    cleaned = _THINK_BLOCK_RE.sub("", text)
    # Handle an unterminated <think> block (truncated generation):
    # keep only text before it — the final answer never arrived.
    if "<think>" in cleaned and "</think>" not in cleaned:
        cleaned = cleaned.split("<think>")[0]
    return cleaned.strip()


def _get_groq_client():
    """Creates a Groq client. Returns None if GROQ_API_KEY is missing or init fails."""
    if not settings.GROQ_API_KEY:
        logger.warning("Groq: GROQ_API_KEY is not configured. Skipping Groq grading.")
        return None
    try:
        from groq import Groq
        return Groq(api_key=settings.GROQ_API_KEY)
    except Exception as e:
        logger.error(f"Groq: Failed to initialize client: {e}")
        return None


async def call_groq_grading(prompt: str) -> Optional[str]:
    """
    Sends the grading prompt (rubric + student's extracted answer text) to
    the configured Groq model for marking and feedback generation.

    Retries transient errors (rate-limit/5xx) with backoff. Reasoning blocks
    are stripped before returning.

    Args:
        prompt: The fully-formatted grading prompt (text only).

    Returns:
        The model's final answer text (JSON expected), or None on failure.
        Callers should fall back to Gemini grading when None is returned.
    """
    client = _get_groq_client()
    if not client:
        return None

    model = settings.GROQ_MODEL or "openai/gpt-oss-120b"

    # Reinforce JSON-only output
    user_content = (
        prompt
        + "\n\nREMINDER: Your final answer must be ONLY the valid JSON object "
        "specified above — no <think> narration in the answer, no markdown, "
        "no extra commentary."
    )

    for attempt_idx, delay in enumerate(RETRY_DELAYS):
        try:
            completion = await asyncio.to_thread(
                client.chat.completions.create,
                model=model,
                messages=[{"role": "user", "content": user_content}],
                temperature=0.1,   # Low temperature keeps grading objective
                max_tokens=4096,   # Room for reasoning + JSON answer
            )

            raw_content = completion.choices[0].message.content or ""
            answer = strip_reasoning(raw_content)

            if answer:
                logger.info(
                    f"Groq: Grading succeeded via '{model}' "
                    f"(attempt {attempt_idx + 1}, {len(answer)} chars)"
                )
                return answer

            logger.warning(
                f"Groq: Empty answer after reasoning strip "
                f"(attempt {attempt_idx + 1}/{len(RETRY_DELAYS)})"
            )
            # Retry — the reasoning consumed all tokens

        except Exception as e:
            err_str = str(e)

            # --- Auth errors: no retry ---
            if any(tag in err_str for tag in ("401", "403", "UNAUTHENTICATED", "invalid_api_key", "Invalid API Key")):
                logger.error(f"Groq: API key is invalid: {err_str[:150]}")
                return None

            # --- Model not available: no retry ---
            if any(tag in err_str for tag in ("404", "not_found", "decommissioned", "does not exist")):
                logger.error(
                    f"Groq: Model '{model}' is not available: {err_str[:150]}. "
                    f"Update GROQ_MODEL in .env with a currently supported model."
                )
                return None

            # --- Rate limit / server errors: retry with backoff ---
            if any(tag in err_str for tag in ("429", "rate_limit", "Rate limit", "500", "502", "503", "504")):
                if attempt_idx < len(RETRY_DELAYS) - 1:
                    logger.warning(
                        f"Groq: Rate-limited/server error on attempt "
                        f"{attempt_idx + 1}/{len(RETRY_DELAYS)}, retrying in {delay}s: {err_str[:120]}"
                    )
                    await asyncio.sleep(delay)
                    continue
                logger.error(f"Groq: Rate limit/server errors persisted after {len(RETRY_DELAYS)} attempts: {err_str[:150]}")
                return None

            # --- Input/validation errors: no retry ---
            if "400" in err_str:
                logger.error(f"Groq: Bad request (validation error): {err_str[:200]}")
                return None

            # --- Unknown errors: no retry ---
            logger.error(f"Groq: Unexpected error: {err_str[:200]}")
            return None

    logger.error(f"Groq: All {len(RETRY_DELAYS)} attempts failed for grading.")
    return None
