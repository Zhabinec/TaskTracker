from functools import lru_cache
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TASKTRACKER_", env_file=".env", extra="ignore")

    environment: Literal["development", "test", "production"] = "development"
    product_timezone: str = "Europe/Moscow"

    @field_validator("product_timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Unknown IANA timezone") from exc
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
