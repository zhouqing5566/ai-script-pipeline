from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """应用配置"""

    # Database
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/ai_script_studio"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # AI API Keys
    OPENAI_API_KEY: str = ""
    ANTHROPIC_API_KEY: str = ""

    # Concurrency Control
    MAX_CONCURRENT_REQUESTS: int = 5
    API_RETRY_MAX_ATTEMPTS: int = 3
    API_RETRY_BASE_DELAY: int = 3  # seconds

    # Task Timeout
    TASK_TIMEOUT: int = 300  # seconds

    # App
    APP_NAME: str = "AI Script Studio"
    DEBUG: bool = True

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
