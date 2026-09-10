from fastapi import APIRouter
from app.config import settings

router = APIRouter(prefix="/api/v1", tags=["Health"])

@router.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "ascendra-ai-service",
        "version": "1.0.0",
        "specVersion": settings.SPEC_VERSION,
        "provider": settings.LLM_PROVIDER
    }
