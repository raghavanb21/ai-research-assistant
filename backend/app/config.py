import os
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables and .env file."""
    
    APP_NAME: str = "AI Research Assistant"
    DEBUG: bool = True
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Database
    DATABASE_URL: str = "sqlite:///./data/assistant.db"
    
    # Local PDF File Storage
    PDF_STORAGE_DIR: str = "./data/pdfs"
    
    # LLM Settings
    LLM_PROVIDER: str = "gemini"  # "gemini" or "openai"
    LLM_MODEL: str = "gemini-1.5-flash"
    GEMINI_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    
    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

# Ensure local storage directory exists
os.makedirs(settings.PDF_STORAGE_DIR, exist_ok=True)
