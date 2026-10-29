import asyncio
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import URL, Connection
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine


class Database:
    def __init__(self, url: URL) -> None:
        self.engine = create_async_engine(
            url,
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=5,
            pool_timeout=3,
            hide_parameters=True,
            connect_args={"timeout": 3, "command_timeout": 3},
        )
        # The factory is shared; each call creates a separate session.
        self.sessions = async_sessionmaker[AsyncSession](self.engine, expire_on_commit=False)
        scripts = ScriptDirectory(str(Path(__file__).with_name("migrations")))
        self.expected_heads = frozenset(scripts.get_heads())

    async def ready(self) -> bool:
        def schema_matches(connection: Connection) -> bool:
            current = MigrationContext.configure(connection).get_current_heads()
            return bool(self.expected_heads) and frozenset(current) == self.expected_heads

        try:
            async with asyncio.timeout(3), self.engine.connect() as connection:
                return await connection.run_sync(schema_matches)
        except SQLAlchemyError, OSError, TimeoutError:
            return False

    async def close(self) -> None:
        await self.engine.dispose()
