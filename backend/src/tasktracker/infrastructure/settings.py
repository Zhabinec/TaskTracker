from functools import lru_cache
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL, make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="TASKTRACKER_",
        env_file=".env",
        extra="ignore",
        hide_input_in_errors=True,
    )

    environment: Literal["development", "test", "production"] = "development"
    product_timezone: str = "Europe/Moscow"
    database_url: SecretStr | None = None
    db_host: str | None = None
    db_port: int = Field(default=5432, ge=1, le=65535)
    db_name: str = "tasktracker"
    db_user: str = "tasktracker"
    db_password: SecretStr | None = None
    session_hours: int = Field(default=168, ge=1, le=720)
    auth_global_limit: int = Field(default=60, ge=1, le=10000)
    auth_account_limit: int = Field(default=5, ge=1, le=100)

    def connection_url(self) -> URL | None:
        if self.database_url is not None:
            return make_url(self.database_url.get_secret_value())
        if self.db_host is None or self.db_password is None:
            return None
        return URL.create(
            "postgresql+asyncpg",
            username=self.db_user,
            password=self.db_password.get_secret_value(),
            host=self.db_host,
            port=self.db_port,
            database=self.db_name,
        )

    @model_validator(mode="after")
    def validate_database(self) -> Settings:
        if self.database_url is not None and self.db_host is not None:
            raise ValueError("Configure either database_url or database components")
        if (self.db_host is None) != (self.db_password is None):
            raise ValueError("Database host and password must be configured together")
        try:
            url = self.connection_url()
        except Exception:
            raise ValueError("Invalid database URL") from None
        if url is not None and (
            url.drivername != "postgresql+asyncpg" or not url.host or not url.database
        ):
            raise ValueError("A PostgreSQL asyncpg URL with host and database is required")
        if self.environment == "production" and url is None:
            raise ValueError("Production requires database configuration")
        return self

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
