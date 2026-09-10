from pydantic import BaseModel, Field, field_validator
from typing import Optional, Dict, Any, Union, List

SUPPORTED_DOMAINS = {
    "aptitude",
    "english",
    "artificial_intelligence",
    "mathematics",
    "interview_preparation",
    "cloud_computing",
    "cyber_security",
    "data_science",
    "logical_reasoning",
    "critical_thinking",
    "communication_skills",
    "problem_solving",
    "quantitative_reasoning",
    "verbal_reasoning",
    "general_knowledge",
    "general"
}

SUPPORTED_INTERACTION_TYPES = {
    "multiple_choice",
    "text_input",
    "ordering",
    "matching",
    "decision",
    "true_false"
}

SUPPORTED_DIFFICULTIES = {"easy", "medium", "hard"}

class PuzzleGenerateRequest(BaseModel):
    questId: Optional[str] = Field(default=None, description="Narrative quest association")
    topic: str = Field(default="general", description="Educational knowledge domain")
    difficulty: str = Field(default="easy", description="Challenge difficulty: easy, medium, hard")
    type: Optional[str] = Field(default=None, description="Cognitive puzzle type")
    interactionType: Optional[str] = Field(default=None, description="Client interaction model")

    @field_validator("topic")
    @classmethod
    def validate_topic(cls, v: str) -> str:
        norm = v.strip().lower().replace(" ", "_").replace("-", "_")
        if norm not in SUPPORTED_DOMAINS:
            raise ValueError(f"Unsupported topic '{v}'. Must be one of: {', '.join(sorted(SUPPORTED_DOMAINS))}")
        return norm

    @field_validator("difficulty")
    @classmethod
    def validate_difficulty(cls, v: str) -> str:
        norm = v.strip().lower()
        if norm not in SUPPORTED_DIFFICULTIES:
            raise ValueError(f"Difficulty must be one of: {', '.join(sorted(SUPPORTED_DIFFICULTIES))}")
        return norm

    @field_validator("interactionType")
    @classmethod
    def validate_interaction_type(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        norm = v.strip().lower()
        if norm not in SUPPORTED_INTERACTION_TYPES:
            raise ValueError(f"Unsupported interactionType '{v}'. Must be one of: {', '.join(sorted(SUPPORTED_INTERACTION_TYPES))}")
        return norm

class PuzzleGenerateResponse(BaseModel):
    specVersion: str = Field(default="1.0", description="Contract specification version")
    externalPuzzleId: str = Field(..., description="Unique AI-generated puzzle ID")
    type: str = Field(..., description="Educational puzzle category")
    interactionType: str = Field(..., description="Player interaction model")
    topic: str = Field(..., description="Educational domain")
    difficulty: str = Field(..., description="Difficulty level")
    question: str = Field(..., description="Primary puzzle prompt/question")
    content: Dict[str, Any] = Field(..., description="Interaction-specific structured payload (options, items, choices, terms)")
    answer: Union[str, int, float, List[Any], Dict[str, Any]] = Field(..., description="Authoritative solution for server-side evaluation only")
    explanation: Optional[str] = Field(default=None, description="Educational explanation of the solution")
