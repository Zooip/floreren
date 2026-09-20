# groei/backend/database/__init__.py
"""Database module — asyncpg connection pool, FastAPI dependency."""
import os
from contextlib import asynccontextmanager

import asyncpg

from services.db_adapter import DbAdapter

_pool: asyncpg.Pool | None = None


async def init_pool() -> None:
    global _pool
    if _pool is not None:
        return
    dsn = os.environ["DATABASE_URL"]
    # min_size=0, not 1. Neon suspends its compute only while no connection is
    # open, and it bills compute-time rather than queries. A pool that keeps one
    # connection alive therefore bills around the clock on a machine that never
    # stops — and `min_machines_running = 1` means ours never does. The app
    # being barely used made no difference at all: it exhausted a month's quota
    # in roughly four and a half days of sitting idle.
    #
    # The cost is that the first request after an idle spell waits for Neon to
    # wake, on the order of a second. The app already tolerates a nine-second
    # Fly cold start and has a prewarm endpoint for the latency-sensitive path.
    _pool = await asyncpg.create_pool(dsn, min_size=0, max_size=10)


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


@asynccontextmanager
async def get_db():
    """For scripts (seed, migrate). Routers should use db_dep instead."""
    assert _pool is not None, "Pool not initialised — call init_pool() first"
    async with _pool.acquire() as conn:
        yield DbAdapter(conn)


async def db_dep():
    """FastAPI dependency. Yields a DbAdapter."""
    assert _pool is not None, "Pool not initialised — check lifespan"
    async with _pool.acquire() as conn:
        yield DbAdapter(conn)
