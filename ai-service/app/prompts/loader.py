import json
import logging
from pathlib import Path
from functools import lru_cache
from typing import Dict, Any, Union

from app.models.puzzle import PuzzleGenerateRequest

logger = logging.getLogger("ai-service.prompts")

PROMPTS_DIR = Path(__file__).parent
MASTER_PROMPT_PATH = PROMPTS_DIR / "master_prompt.txt"
ENVIRONMENT_PROMPT_PATH = PROMPTS_DIR / "environment_prompt_v3.txt"

@lru_cache(maxsize=1)
def load_master_prompt() -> str:
    """Load the master puzzle system prompt from master_prompt.txt."""
    if not MASTER_PROMPT_PATH.exists():
        logger.error(f"Master prompt file missing at {MASTER_PROMPT_PATH}")
        raise FileNotFoundError(f"Master prompt file not found at {MASTER_PROMPT_PATH}")
    
    with open(MASTER_PROMPT_PATH, "r", encoding="utf-8") as f:
        prompt_content = f.read()
    
    logger.info(f"Successfully loaded master prompt ({len(prompt_content)} characters).")
    return prompt_content

@lru_cache(maxsize=1)
def load_environment_prompt() -> str:
    """Load the environment generator prompt specification v3.0 from environment_prompt_v3.txt."""
    target_path = ENVIRONMENT_PROMPT_PATH if ENVIRONMENT_PROMPT_PATH.exists() else (PROMPTS_DIR / "environment_prompt_v2.txt")
    if not target_path.exists():
        logger.error(f"Environment prompt file missing at {target_path}")
        raise FileNotFoundError(f"Environment prompt file not found at {target_path}")
    
    with open(target_path, "r", encoding="utf-8") as f:
        prompt_content = f.read()
    
    logger.info(f"Successfully loaded environment prompt ({target_path.name}, {len(prompt_content)} characters).")
    return prompt_content

def get_system_prompt() -> str:
    """Return the cached master system prompt for puzzle generation."""
    return load_master_prompt()

def get_environment_prompt() -> str:
    """Return the cached environment generator prompt specification v3.0."""
    return load_environment_prompt()

def reload_prompts() -> None:
    """Clear lru_cache and force reload for both master and environment prompts."""
    load_master_prompt.cache_clear()
    load_environment_prompt.cache_clear()
    logger.info("Prompt caches cleared and reloaded.")

DIFFICULTY_MAP = {
    "beginner": 1,
    "novice": 2,
    "easy": 2,
    "skilled": 3,
    "medium": 3,
    "expert": 4,
    "hard": 4,
    "master": 5,
    "legend": 6
}

def build_user_prompt(request: PuzzleGenerateRequest) -> str:
    """Build the runtime JSON request payload prompt for puzzle generation matching the Master Prompt contract."""
    diff_norm = request.difficulty.strip().lower()
    diff_level = DIFFICULTY_MAP.get(diff_norm, 3)
    standard_diff = diff_norm
    if diff_norm == "easy": standard_diff = "novice"
    elif diff_norm == "medium": standard_diff = "skilled"
    elif diff_norm == "hard": standard_diff = "expert"

    payload: Dict[str, Any] = {
        "request_type": "generate_puzzle",
        "category": request.topic,
        "difficulty": standard_diff,
        "difficulty_level": diff_level,
        "current_environment": "village",
        "trigger_id": request.questId or "first_clue_village",
    }
    if request.type:
        payload["preferred_mechanisms"] = [request.type]
    if request.interactionType:
        payload["preferred_interaction"] = request.interactionType

    return f"Generate a dynamic puzzle instance for the following runtime request payload:\n{json.dumps(payload, indent=2)}"

def build_environment_user_prompt(puzzle_data: Union[Dict[str, Any], str]) -> str:
    """Build the user prompt for environment generation from an input puzzle JSON."""
    if isinstance(puzzle_data, str):
        puzzle_json_str = puzzle_data
    else:
        puzzle_json_str = json.dumps(puzzle_data, indent=2)

    return f"Convert the following existing puzzle JSON into a complete Unity-ready environment specification:\n\n{puzzle_json_str}"
