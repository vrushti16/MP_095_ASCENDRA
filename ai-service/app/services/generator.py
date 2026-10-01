import json
import logging
from typing import Dict, Any, Optional

from app.config import settings
from app.models.puzzle import PuzzleGenerateRequest, PuzzleGenerateResponse
from app.services.validator import validate_generated_puzzle, PuzzleValidationError
from app.services.catalog import find_catalog_puzzle

from app.prompts import get_system_prompt, build_user_prompt

logger = logging.getLogger("ai-service.generator")

def build_system_prompt(request: PuzzleGenerateRequest) -> str:
    """Returns master system prompt loaded from master_prompt.txt."""
    return get_system_prompt()

async def generate_with_gemini(request: PuzzleGenerateRequest) -> Dict[str, Any]:
    """Generate puzzle using Google Gemini API with model & key rotation."""
    import google.generativeai as genai

    keys = [
        getattr(settings, "GEMINI_API_KEY_1", None),
        getattr(settings, "GEMINI_API_KEY_2", None),
        getattr(settings, "GEMINI_API_KEY_3", None),
        settings.GEMINI_API_KEY,
    ]
    active_keys = [k for k in keys if k and k.strip()]
    if not active_keys:
        raise ValueError("GEMINI_API_KEY is not configured in settings.")

    system_prompt = get_system_prompt()
    user_prompt = build_user_prompt(request)

    target_models = [
        settings.GEMINI_MODEL,
        "gemini-3.5-flash-lite",
        "gemini-3.1-flash-lite",
        "gemini-3-flash-preview",
        "gemini-3.5-flash",
        "gemini-3.6-flash",
        "gemini-flash-lite-latest",
        "gemini-3.8-flash"
    ]
    # Remove duplicates while preserving order
    seen = set()
    deduped_models = []
    for m in target_models:
        if m and m not in seen:
            seen.add(m)
            deduped_models.append(m)

    last_ex = None
    for api_key in active_keys:
        genai.configure(api_key=api_key)
        for model_name in deduped_models:
            try:
                model = genai.GenerativeModel(model_name, system_instruction=system_prompt)
                response = model.generate_content(
                    user_prompt,
                    generation_config={"response_mime_type": "application/json"},
                    request_options={"timeout": 30.0}
                )
                logger.info(f"Successfully generated puzzle with model {model_name}")
                return json.loads(response.text)
            except Exception as e:
                last_ex = e
                logger.warning(f"Model {model_name} with API key failed: {e}. Trying next option...")

    if last_ex is not None:
        raise last_ex
    raise RuntimeError("All Gemini API keys and models failed to generate content.")

async def generate_with_openai(request: PuzzleGenerateRequest) -> Dict[str, Any]:
    """Generate puzzle using OpenAI API."""
    from openai import AsyncOpenAI

    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured in settings.")

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    system_prompt = get_system_prompt()
    user_prompt = build_user_prompt(request)

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)

async def generate_puzzle_service(request: PuzzleGenerateRequest) -> PuzzleGenerateResponse:
    """
    Main entry point for AI puzzle generation:
    - Calls LLM provider (Gemini / OpenAI)
    - Validates puzzle structure & non-coding rule
    - Retries up to MAX_RETRIES (3 total attempts) if validation fails
    - Returns sanitized PuzzleGenerateResponse
    """
    import asyncio
    last_error: Optional[Exception] = None

    for attempt in range(settings.MAX_RETRIES + 1):
        try:
            raw_puzzle: Dict[str, Any] = {}

            # Check active LLM provider
            if settings.LLM_PROVIDER == "gemini":
                raw_puzzle = await generate_with_gemini(request)
            elif settings.LLM_PROVIDER == "openai":
                raw_puzzle = await generate_with_openai(request)
            else:
                # Deterministic catalog generator ONLY if provider is explicitly set to offline/catalog
                logger.info("LLM_PROVIDER set to offline. Using catalog puzzle.")
                raw_puzzle = find_catalog_puzzle(request.topic, request.difficulty, request.interactionType, request.type)

            # Assign external ID and spec version if missing
            if not raw_puzzle.get("externalPuzzleId"):
                import uuid
                raw_puzzle["externalPuzzleId"] = raw_puzzle.get("puzzle_id") or raw_puzzle.get("puzzleId") or f"ai_{uuid.uuid4().hex[:12]}"
            raw_puzzle["puzzleId"] = raw_puzzle["externalPuzzleId"]
            raw_puzzle["specVersion"] = settings.SPEC_VERSION

            # Run authoritative validation (Non-coding, structure, answer integrity)
            validated_data = validate_generated_puzzle(raw_puzzle)

            return PuzzleGenerateResponse(**validated_data)

        except PuzzleValidationError as ve:
            logger.warning(f"Attempt {attempt + 1} failed validation: {ve.message}. Retrying...")
            last_error = ve
            if attempt < settings.MAX_RETRIES:
                await asyncio.sleep(2.0 * (attempt + 1))
            continue
        except Exception as e:
            logger.warning(f"Attempt {attempt + 1} unexpected error: {e}. Retrying...")
            last_error = e
            if attempt < settings.MAX_RETRIES:
                await asyncio.sleep(2.0 * (attempt + 1))
            continue

    raise PuzzleValidationError(f"Puzzle generation failed after retries: {str(last_error)}", "GENERATION_EXHAUSTED")
