import os
import pytest
from app.config import settings

# Force test environment and offline LLM provider for all test suites
settings.ENVIRONMENT = "test"
settings.LLM_PROVIDER = "offline"
os.environ["ENVIRONMENT"] = "test"
os.environ["LLM_PROVIDER"] = "offline"
