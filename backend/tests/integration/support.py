from alembic import command
from sqlalchemy import Connection

from tasktracker.infrastructure.db.engine import Database
from tasktracker.infrastructure.db.migrate import migration_config


async def migrate(database: Database, revision: str) -> None:
    def run(connection: Connection) -> None:
        config = migration_config()
        config.attributes["connection"] = connection
        if revision == "base":
            command.downgrade(config, revision)
        else:
            command.upgrade(config, revision)

    async with database.engine.begin() as connection:
        await connection.run_sync(run)
