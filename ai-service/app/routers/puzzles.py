from fastapi import APIRouter, HTTPException, status
from app.models.puzzle import PuzzleGenerateRequest, PuzzleGenerateResponse
from app.services.generator import generate_puzzle_service
from app.services.validator import PuzzleValidationError

router = APIRouter(prefix="/api/v1/ai/puzzles", tags=["Puzzles"])

@router.post("/generate", response_model=PuzzleGenerateResponse, status_code=status.HTTP_200_OK)
async def generate_puzzle(request: PuzzleGenerateRequest):
    """
    Generate an authoritative educational challenge conforming to the Phase 11 contract.
    Strictly non-coding, multi-modal, and safe.
    """
    try:
        puzzle = await generate_puzzle_service(request)
        return puzzle
    except PuzzleValidationError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": ve.code, "message": ve.message}
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_AI_ERROR", "message": str(e)}
        )
