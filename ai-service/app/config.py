import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    ENVIRONMENT: str = "development"
    LLM_PROVIDER: str = "offline"  # "gemini", "openai", or "offline"
    GEMINI_API_KEY: Optional[str] = None
    OPENAI_API_KEY: Optional[str] = None
    SPEC_VERSION: str = "1.0"
    MAX_RETRIES: int = 2

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
