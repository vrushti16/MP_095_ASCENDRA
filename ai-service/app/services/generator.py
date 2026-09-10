import json
import logging
from typing import Dict, Any, Optional

from app.config import settings
from app.models.puzzle import PuzzleGenerateRequest, PuzzleGenerateResponse
from app.services.validator import validate_generated_puzzle, PuzzleValidationError
from app.services.catalog import find_catalog_puzzle

logger = logging.getLogger("ai-service.generator")

def build_system_prompt(request: PuzzleGenerateRequest) -> str:
    return f"""You are the authoritative educational challenge generator for the ASCENDRA adventure game.
Your task is to generate a multi-modal, highly engaging learning puzzle for the following parameters:
- Topic / Domain: {request.topic}
- Difficulty: {request.difficulty}
- Requested Puzzle Type: {request.type or "any appropriate"}
- Requested Interaction Model: {request.interactionType or "any appropriate"}

CRITICAL ARCHITECTURAL CONSTRAINTS:
1. STRICT NON-CODING POLICY:
   - Absolutely NO programming syntax, code snippets, compiler questions, or coding exercises.
   - Do NOT ask the player to write code, complete code, debug code, predict program output, or recall API/syntax keywords.
   - All technical domains (AI, Cloud Computing, Cyber Security, Data Science) must focus exclusively on architecture, concepts, trade-offs, ethics, hygiene, and logical problem solving.
2. SUPPORT MULTI-MODAL INTERACTION:
   - Do NOT produce simple multiple-choice quizzes for every puzzle.
   - Use interactionType in ["ordering", "matching", "text_input", "decision", "true_false", "multiple_choice"].
   - For 'ordering', provide an array of steps in content.items and the correct zero-indexed permutation in answer.
   - For 'matching', provide terms and definitions arrays, with an answer mapping dictionary.
   - For 'decision', provide situational context with professional/ethical choices.
   - For 'text_input', provide a sequence or riddle with an unambiguous short answer.
3. STRUCTURED JSON OUTPUT ONLY:
   Output MUST be valid JSON conforming exactly to this structure:
   {{
     "type": "{request.type or 'concept'}",
     "interactionType": "{request.interactionType or 'multiple_choice'}",
     "topic": "{request.topic}",
     "difficulty": "{request.difficulty}",
     "question": "Clear, concise, educational question string",
     "content": {{ ... }},
     "answer": "...",
     "explanation": "Clear explanation explaining why the answer is correct"
   }}
"""

async def generate_with_gemini(request: PuzzleGenerateRequest) -> Dict[str, Any]:
    """Generate puzzle using Google Gemini API."""
    import google.generativeai as genai

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel("gemini-1.5-flash")

    prompt = build_system_prompt(request)
    response = model.generate_content(
        prompt,
        generation_config={"response_mime_type": "application/json"}
    )
    return json.loads(response.text)

async def generate_with_openai(request: PuzzleGenerateRequest) -> Dict[str, Any]:
    """Generate puzzle using OpenAI API."""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    prompt = build_system_prompt(request)

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": prompt},
            {"role": "user", "content": f"Generate a {request.difficulty} {request.topic} puzzle."}
        ],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)

async def generate_puzzle_service(request: PuzzleGenerateRequest) -> PuzzleGenerateResponse:
    """
    Main entry point for AI puzzle generation:
    - Calls LLM provider or offline catalog
    - Validates puzzle structure & non-coding rule
    - Retries up to MAX_RETRIES (3 total attempts) if validation fails
    - Returns sanitized PuzzleGenerateResponse
    """
    last_error: Optional[Exception] = None

    for attempt in range(settings.MAX_RETRIES + 1):
        try:
            raw_puzzle: Dict[str, Any] = {}

            # Check if active LLM provider is configured
            if settings.LLM_PROVIDER == "gemini" and settings.GEMINI_API_KEY:
                try:
                    raw_puzzle = await generate_with_gemini(request)
                except Exception as e:
                    logger.warning(f"Gemini API call failed: {e}. Falling back to catalog.")
                    raw_puzzle = find_catalog_puzzle(request.topic, request.difficulty, request.interactionType, request.type)
            elif settings.LLM_PROVIDER == "openai" and settings.OPENAI_API_KEY:
                try:
                    raw_puzzle = await generate_with_openai(request)
                except Exception as e:
                    logger.warning(f"OpenAI API call failed: {e}. Falling back to catalog.")
                    raw_puzzle = find_catalog_puzzle(request.topic, request.difficulty, request.interactionType, request.type)
            else:
                # Deterministic high-quality offline generator
                raw_puzzle = find_catalog_puzzle(request.topic, request.difficulty, request.interactionType, request.type)

            # Assign external ID and spec version if missing
            if "externalPuzzleId" not in raw_puzzle:
                import uuid
                raw_puzzle["externalPuzzleId"] = f"ai_{uuid.uuid4().hex[:12]}"
            raw_puzzle["specVersion"] = settings.SPEC_VERSION

            # Run authoritative validation (Non-coding, structure, answer integrity)
            validated_data = validate_generated_puzzle(raw_puzzle)

            return PuzzleGenerateResponse(**validated_data)

        except PuzzleValidationError as ve:
            logger.warning(f"Attempt {attempt + 1} failed validation: {ve.message}. Retrying...")
            last_error = ve
            continue
        except Exception as e:
            logger.warning(f"Attempt {attempt + 1} unexpected error: {e}. Retrying...")
            last_error = e
            continue

    raise PuzzleValidationError(f"Puzzle generation failed after retries: {str(last_error)}", "GENERATION_EXHAUSTED")
