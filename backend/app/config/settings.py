import os
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Server
    port: int = 8000
    environment: str = "development"
    log_level: str = "info"

    # Database
    postgres_connection_string: str = "postgresql://devuser:devpassword@localhost:5432/social_stack_dev"

    # Frontend
    frontend_url: str = "http://localhost:8081"

    # WorkOS
    workos_api_key: str = ""
    workos_client_id: str = ""
    workos_redirect_uri: str = "https://res007-0-8a1a2ecf605e412c-dev.redground-500683d1.eastus.azurecontainerapps.io/api/v1/auth/callback"

    # CORS
    cors_origin: str = "http://localhost:19006,http://localhost:19000,http://localhost:8081,https://res007-0-8a1a2ecf605e412c-dev.redground-500683d1.eastus.azurecontainerapps.io"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origin.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
