import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional, List

class Settings(BaseSettings):
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    ENVIRONMENT: str = "development"
    LLM_PROVIDER: str = "gemini"  # "gemini", "openai", or "offline"
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_API_KEYS: Optional[str] = None
    GEMINI_API_KEY_1: Optional[str] = None
    GEMINI_API_KEY_2: Optional[str] = None
    GEMINI_API_KEY_3: Optional[str] = None
    GEMINI_MODEL: str = "gemini-3.6-flash"
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
        for explicit_key in [self.GEMINI_API_KEY_1, self.GEMINI_API_KEY_2, self.GEMINI_API_KEY_3, self.GEMINI_API_KEY]:
            if explicit_key:
                clean = explicit_key.strip()
                if clean and clean not in keys:
                    keys.append(clean)
        return keys

settings = Settings()
