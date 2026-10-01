from fastapi import APIRouter, HTTPException, status
from app.models.puzzle import PuzzleGenerateRequest
from app.models.environment import EnvironmentGenerateRequest, EnvironmentGenerateResponse
from app.services.generator import generate_puzzle_service
from app.services.environment_generator import generate_environment_service

router = APIRouter(prefix="/api/v1/ai/environments", tags=["Environments"])

@router.post("/generate", response_model=EnvironmentGenerateResponse, status_code=status.HTTP_200_OK)
async def generate_environment(request: EnvironmentGenerateRequest):
    """
    Generate a dynamic 3D Unity environment JSON (v3.0) from a puzzle definition.
    """
    try:
        env_response = await generate_environment_service(request.puzzle)
        return env_response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "ENVIRONMENT_GENERATION_ERROR", "message": str(e)}
        )

@router.post("/generate-full", response_model=EnvironmentGenerateResponse, status_code=status.HTTP_200_OK)
async def generate_full_environment(request: PuzzleGenerateRequest):
    """
    End-to-End Pipeline:
    1. Generates puzzle JSON using Master Prompt.
    2. Converts puzzle JSON into 3D Unity Environment JSON (v3.0) using Environment Prompt v3.0.
    """
    try:
        puzzle_response = await generate_puzzle_service(request)
        puzzle_dict = puzzle_response.model_dump()
        env_response = await generate_environment_service(puzzle_dict)
        return env_response
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "FULL_PIPELINE_ERROR", "message": str(e)}
        )
