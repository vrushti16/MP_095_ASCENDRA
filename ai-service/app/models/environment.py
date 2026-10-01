from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

class DifficultyProfile(BaseModel):
    complexityLevel: float = Field(default=50.0, ge=0.0, le=100.0)
    lightingIntensity: float = Field(default=50.0, ge=0.0, le=100.0)
    lightingContrast: float = Field(default=50.0, ge=0.0, le=100.0)
    fogIntensity: float = Field(default=20.0, ge=0.0, le=100.0)
    particleIntensity: float = Field(default=30.0, ge=0.0, le=100.0)
    ambientAudioIntensity: float = Field(default=50.0, ge=0.0, le=100.0)
    musicIntensity: float = Field(default=50.0, ge=0.0, le=100.0)
    interactionComplexity: float = Field(default=50.0, ge=0.0, le=100.0)
    navigationComplexity: float = Field(default=40.0, ge=0.0, le=100.0)
    visualComplexity: float = Field(default=50.0, ge=0.0, le=100.0)

class EnvironmentGenerateRequest(BaseModel):
    puzzle: Dict[str, Any] = Field(..., description="The authoritative generated puzzle JSON object")

class EnvironmentGenerateResponse(BaseModel):
    environmentSpecVersion: str = Field(default="3.0", description="Environment spec version")
    externalPuzzleId: str = Field(..., description="Matching external puzzle ID")
    difficulty: str = Field(default="medium", description="Puzzle difficulty level")
    difficultyProfile: DifficultyProfile = Field(default_factory=DifficultyProfile)
    puzzle: Dict[str, Any] = Field(default_factory=dict)
    environment: Dict[str, Any] = Field(default_factory=dict)
    playerSpawn: Dict[str, Any] = Field(default_factory=dict)
    objects: List[Dict[str, Any]] = Field(default_factory=list)
    interactions: List[Dict[str, Any]] = Field(default_factory=list)
    camera: Dict[str, Any] = Field(default_factory=dict)
    lighting: List[Dict[str, Any]] = Field(default_factory=list)
    effects: List[Dict[str, Any]] = Field(default_factory=list)
    animations: List[Dict[str, Any]] = Field(default_factory=list)
    audio: List[Dict[str, Any]] = Field(default_factory=list)
    validation: Dict[str, Any] = Field(default_factory=dict)
    completion: Dict[str, Any] = Field(default_factory=dict)
    cleanup: Dict[str, Any] = Field(default_factory=dict)
    generationNotes: List[str] = Field(default_factory=list)
