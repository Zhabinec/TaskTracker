"""Run once per release: python -m tasktracker.infrastructure.db.migrate."""

from pathlib import Path

from alembic import command
from alembic.config import Config


def migration_config() -> Config:
    config = Config()
    config.set_main_option("script_location", str(Path(__file__).with_name("migrations")))
    return config


if __name__ == "__main__":
    command.upgrade(migration_config(), "head")
