import os
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()

class Settings(BaseSettings):
    PROJECT_NAME: str = "Arista AI - SV-CIE"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "arista-ai-production-key-change-me")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days

    # Turso (libSQL) in production; fallback to local SQLite for dev
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./vouching.db")

    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")

    STORAGE_DIR: str = os.path.join(os.getcwd(), "storage")

    # CORS: comma-separated list of allowed origins
    CORS_ORIGINS: str = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:3001"
    )

    class Config:
        case_sensitive = True

settings = Settings()
