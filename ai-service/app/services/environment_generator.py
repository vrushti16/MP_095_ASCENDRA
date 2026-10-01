import json
import logging
from typing import Dict, Any, Optional

from app.config import settings
from app.prompts import get_environment_prompt, build_environment_user_prompt
from app.models.environment import EnvironmentGenerateResponse, DifficultyProfile

logger = logging.getLogger("ai-service.environment_generator")

DIFFICULTY_SCORES = {
    "beginning": {"complexity": 15, "lighting": 30, "contrast": 20, "fog": 0, "particles": 10, "music": 20},
    "easy":      {"complexity": 30, "lighting": 40, "contrast": 35, "fog": 10, "particles": 25, "music": 35},
    "medium":    {"complexity": 50, "lighting": 55, "contrast": 50, "fog": 25, "particles": 45, "music": 55},
    "hard":      {"complexity": 70, "lighting": 70, "contrast": 65, "fog": 45, "particles": 65, "music": 75},
    "expert":    {"complexity": 85, "lighting": 80, "contrast": 80, "fog": 60, "particles": 80, "music": 85},
    "master":    {"complexity": 92, "lighting": 90, "contrast": 90, "fog": 75, "particles": 90, "music": 92},
    "legend":    {"complexity": 100, "lighting": 95, "contrast": 95, "fog": 90, "particles": 100, "music": 100},
}

def calculate_difficulty_profile(difficulty_str: str) -> DifficultyProfile:
    norm = difficulty_str.strip().lower() if difficulty_str else "medium"
    scores = DIFFICULTY_SCORES.get(norm, DIFFICULTY_SCORES["medium"])
    return DifficultyProfile(
        complexityLevel=scores["complexity"],
        lightingIntensity=scores["lighting"],
        lightingContrast=scores["contrast"],
        fogIntensity=scores["fog"],
        particleIntensity=scores["particles"],
        ambientAudioIntensity=scores["lighting"],
        musicIntensity=scores["music"],
        interactionComplexity=scores["complexity"],
        navigationComplexity=scores["complexity"] * 0.8,
        visualComplexity=scores["complexity"]
    )

def build_fallback_environment(puzzle_data: Dict[str, Any]) -> Dict[str, Any]:
    """Generates a dynamic v3.0 fallback 3D Unity environment layout."""
    puzzle_id = puzzle_data.get("externalPuzzleId") or puzzle_data.get("puzzleId") or "PZ_FALLBACK_001"
    difficulty = puzzle_data.get("difficulty", "medium")
    diff_profile = calculate_difficulty_profile(difficulty).model_dump()

    return {
        "environmentSpecVersion": "3.0",
        "externalPuzzleId": puzzle_id,
        "difficulty": difficulty,
        "difficultyProfile": diff_profile,
        "puzzle": puzzle_data,
        "environment": {
            "theme": "dungeon_chamber",
            "asset_pack": "3D Dungeon Lowpoly Pack",
            "bounds": {"x": 20.0, "y": 10.0, "z": 20.0}
        },
        "playerSpawn": {
            "position": {"x": 0.0, "y": 0.0, "z": -5.0},
            "rotation": {"x": 0.0, "y": 0.0, "z": 0.0}
        },
        "objects": [
            {
                "objectId": "env_root",
                "asset": {"assetId": "Environment_Root_Prefab"},
                "parent": None,
                "transform": {
                    "position": {"x": 0.0, "y": 0.0, "z": 0.0},
                    "rotation": {"x": 0.0, "y": 0.0, "z": 0.0},
                    "scale": {"x": 1.0, "y": 1.0, "z": 1.0}
                },
                "active": True,
                "static": True,
                "layer": "Default",
                "tag": "Environment"
            },
            {
                "objectId": "pedestal_center",
                "asset": {"assetId": "Stone_Pedestal_01"},
                "parent": "env_root",
                "transform": {
                    "position": {"x": 0.0, "y": 0.0, "z": 0.0},
                    "rotation": {"x": 0.0, "y": 0.0, "z": 0.0},
                    "scale": {"x": 1.0, "y": 1.0, "z": 1.0}
                },
                "active": True,
                "static": False,
                "layer": "Interactable",
                "tag": "PuzzleMechanism"
            }
        ],
        "interactions": [
            {
                "interactionId": "int_pedestal_main",
                "objectId": "pedestal_center",
                "interactionType": puzzle_data.get("interactionType", "tile_selection"),
                "interactable": True,
                "interactionPrompt": "Inspect Mechanism",
                "puzzleValue": puzzle_data.get("answer", ""),
                "validationValue": puzzle_data.get("answer", ""),
                "interactionPoint": {
                    "position": {"x": 0.0, "y": 0.5, "z": -1.0},
                    "rotation": {"x": 0.0, "y": 0.0, "z": 0.0}
                },
                "interactionRadius": 2.0
            }
        ],
        "camera": {
            "position": {"x": 0.0, "y": 4.0, "z": -7.0},
            "rotation": {"x": 25.0, "y": 0.0, "z": 0.0},
            "fieldOfView": 60.0
        },
        "lighting": [
            {
                "type": "point",
                "intensity": diff_profile["lightingIntensity"] / 50.0,
                "color": "#4A90E2",
                "position": {"x": 0.0, "y": 3.0, "z": 0.0}
            }
        ],
        "effects": [],
        "animations": [],
        "audio": [
            {
                "clip": "puzzle_ambient_dungeon",
                "loop": True,
                "volume": diff_profile["ambientAudioIntensity"] / 100.0
            }
        ],
        "validation": {
            "authoritative": True,
            "puzzleId": puzzle_id,
            "answer": puzzle_data.get("answer", "")
        },
        "completion": {
            "onSuccess": "trigger_completion_effects",
            "restorePlayer": True
        },
        "cleanup": {
            "destroyRoot": True,
            "rootObjectId": "env_root",
            "restoreCamera": True,
            "restoreAudio": True
        },
        "generationNotes": ["Generated dynamic v3.0 fallback 3D environment layout."]
    }

async def generate_environment_with_gemini(puzzle_data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate 3D Unity environment JSON from puzzle definition using Gemini."""
    import google.generativeai as genai

    keys = [
        settings.GEMINI_API_KEY,
        getattr(settings, "GEMINI_API_KEY_1", None),
        getattr(settings, "GEMINI_API_KEY_2", None),
        getattr(settings, "GEMINI_API_KEY_3", None),
    ]
    active_keys = [k for k in keys if k and k.strip()]
    if not active_keys:
        raise ValueError("GEMINI_API_KEY is not configured in settings.")

    system_prompt = get_environment_prompt()
    user_prompt = build_environment_user_prompt(puzzle_data)

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
                logger.info(f"Successfully generated environment layout with model {model_name}")
                return json.loads(response.text)
            except Exception as e:
                last_ex = e
                logger.warning(f"Gemini model {model_name} environment generation failed: {e}")

    if last_ex is not None:
        raise last_ex
    raise RuntimeError("All Gemini models failed to generate environment.")

async def generate_environment_with_openai(puzzle_data: Dict[str, Any]) -> Dict[str, Any]:
    """Generate 3D Unity environment JSON from puzzle definition using OpenAI."""
    from openai import AsyncOpenAI

    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured in settings.")

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    system_prompt = get_environment_prompt()
    user_prompt = f"Convert the following generated puzzle JSON into a complete dynamic Unity puzzle environment JSON adhering to spec version 3.0:\n\n{json.dumps(puzzle_data, indent=2)}"

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        response_format={"type": "json_object"}
    )
    return json.loads(response.choices[0].message.content)

async def generate_environment_service(puzzle_data: Dict[str, Any]) -> EnvironmentGenerateResponse:
    """
    Main entry point for AI 3D Puzzle Environment generation v3.0:
    - Accepts puzzle JSON definition
    - Calls LLM (Gemini / OpenAI) with Environment Prompt v3.0
    - Falls back to robust dynamic 3D environment generator if offline or error
    """
    raw_env: Dict[str, Any] = {}

    if settings.LLM_PROVIDER == "gemini":
        try:
            raw_env = await generate_environment_with_gemini(puzzle_data)
        except Exception as e:
            logger.warning(f"Gemini environment generation failed: {e}. Using procedural 3D layout.")
            raw_env = build_fallback_environment(puzzle_data)
    elif settings.LLM_PROVIDER == "openai":
        try:
            raw_env = await generate_environment_with_openai(puzzle_data)
        except Exception as e:
            logger.warning(f"OpenAI environment generation failed: {e}. Using procedural 3D layout.")
            raw_env = build_fallback_environment(puzzle_data)
    else:
        raw_env = build_fallback_environment(puzzle_data)

    # Ensure required fields exist
    if "environmentSpecVersion" not in raw_env:
        raw_env["environmentSpecVersion"] = "3.0"
    if "externalPuzzleId" not in raw_env or not raw_env["externalPuzzleId"]:
        raw_env["externalPuzzleId"] = puzzle_data.get("externalPuzzleId") or puzzle_data.get("puzzleId") or "PZ_UNK"

    return EnvironmentGenerateResponse(**raw_env)
