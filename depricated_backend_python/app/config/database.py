import asyncpg
from asyncpg import connection as _ap_connection
from app.config.settings import get_settings
from app.utils.logger import logger

from typing import Optional

_pool: Optional[asyncpg.Pool] = None

class NoResetConnection(_ap_connection.Connection):
    # asyncpg docs: Connection.get_reset_query() is used for pool reset.
    # Returning an empty string makes Connection.reset() a no-op.
    def get_reset_query(self) -> str:
        return ""

async def get_pool() -> asyncpg.Pool:
    """Return the existing connection pool, creating it if needed."""
    global _pool
    if _pool is None:
        settings = get_settings()
        _pool = await asyncpg.create_pool(
            dsn=settings.postgres_connection_string,
            min_size=2,
            max_size=20,
            command_timeout=30,
            connection_class=NoResetConnection,  # Use the custom connection class
        )
        logger.info("✅ Connected to PostgreSQL database")
    return _pool


async def close_pool() -> None:
    """Gracefully close the connection pool."""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("PostgreSQL connection pool closed")
