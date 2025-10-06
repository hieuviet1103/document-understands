from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

    SUPABASE_URL: str
    SUPABASE_KEY: str
    SUPABASE_SERVICE_ROLE_KEY: str

    GEMINI_API_KEY: str

    REDIS_URL: str = "redis://localhost:6379/0"

    API_V1_PREFIX: str = "/api/v1"
    EXTERNAL_API_PREFIX: str = "/external/v1"
    SECRET_KEY: str

    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    MAX_UPLOAD_SIZE: int = 52428800
    ALLOWED_FILE_TYPES: str = "application/pdf,image/png,image/jpeg,image/jpg,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation"

    STORAGE_BUCKET_NAME: str = "documents"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    @property
    def allowed_file_types_list(self) -> List[str]:
        return [ft.strip() for ft in self.ALLOWED_FILE_TYPES.split(",")]


settings = Settings()
