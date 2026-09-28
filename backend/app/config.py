from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Jardín - Garden Bloom OS"
    VERSION: str = "0.1.0"
    API_V1_STR: str = "/api/v1"

    # Persistence paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    DATA_DIR: Path = BASE_DIR.parent / "data"
    DATABASE_URL: str = f"sqlite:///{BASE_DIR.parent / 'data' / 'garden.db'}"
    MEDIA_DIR: Path = BASE_DIR.parent / "data" / "media"

    # Default Geographic settings (can be overridden per Property in DB)
    DEFAULT_LATITUDE: float = 40.4168
    DEFAULT_LONGITUDE: float = -3.7038
    DEFAULT_TIMEZONE: str = "Europe/Madrid"

    # LLM Settings (OpenAI-compatible: OpenRouter, Ollama, vLLM, Anthropic proxy, etc.)
    OPENAI_BASE_URL: str = "https://openrouter.ai/api/v1"
    OPENAI_API_KEY: str = ""
    DEFAULT_LLM_MODEL: str = "nousresearch/hermes-3-llama-3.1-8b"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.MEDIA_DIR.mkdir(parents=True, exist_ok=True)
