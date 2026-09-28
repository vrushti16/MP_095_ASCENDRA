import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

class Settings(BaseSettings):
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    ENVIRONMENT: str = "development"
    LLM_PROVIDER: str = "offline"  # "gemini", "openai", or "offline"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_API_KEYS: Optional[str] = None
    GEMINI_MODEL: str = "gemini-flash-latest"
    OPENAI_API_KEY: Optional[str] = None
    SPEC_VERSION: str = "1.0"
    MAX_RETRIES: int = 2

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def get_gemini_keys(self) -> List[str]:
        keys: List[str] = []
        if self.GEMINI_API_KEYS:
            for k in self.GEMINI_API_KEYS.split(","):
                clean = k.strip()
                if clean and clean not in keys:
                    keys.append(clean)
        if self.GEMINI_API_KEY:
            clean = self.GEMINI_API_KEY.strip()
            if clean and clean not in keys:
                keys.insert(0, clean)
        return keys

settings = Settings()
