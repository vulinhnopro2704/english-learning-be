"""Database connection and session management for FSRS-AI Service using PostgreSQL & SQLAlchemy (Asyncpg)."""

from typing import Any, Dict
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

database_url = settings.DATABASE_URL


def _normalize_asyncpg_url(url: str) -> str:
    """Normalize database URL for asyncpg and strip unsupported query parameters."""
    normalized = (url or "").strip()
    if normalized.startswith("postgresqlasyncpg://"):
        normalized = normalized.replace("postgresqlasyncpg://", "postgresql+asyncpg://", 1)
    elif normalized.startswith("postgres://"):
        normalized = normalized.replace("postgres://", "postgresql+asyncpg://", 1)
    elif normalized.startswith("postgresql://"):
        normalized = normalized.replace("postgresql://", "postgresql+asyncpg://", 1)

    split_url = urlsplit(normalized)
    query = dict(parse_qsl(split_url.query, keep_blank_values=True))

    sslmode = query.pop("sslmode", None)
    # Strip parameters that asyncpg doesn't support directly as query params
    query.pop("channel_binding", None)
    query.pop("connection_limit", None)
    query.pop("pooler", None)
    query.pop("pgbouncer", None)
    query.pop("target_session_attrs", None)
    query.pop("schema", None)
    query.pop("sslrootcert", None)

    if sslmode:
        if sslmode == "disable":
            query.pop("ssl", None)
        elif "ssl" not in query:
            query["ssl"] = "require"

    normalized_query = urlencode(query, doseq=True)
    return urlunsplit(
        (
            split_url.scheme,
            split_url.netloc,
            split_url.path,
            normalized_query,
            split_url.fragment,
        )
    )


def _get_engine_kwargs(url: str) -> Dict[str, Any]:
    """Build engine kwargs with production-ready connection pool, statement cache, and timeouts."""
    kwargs: Dict[str, Any] = {
        "echo": False,
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "connect_args": {
            "timeout": 60,
            "command_timeout": 60,
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        },
    }
    split_url = urlsplit(url)
    query = dict(parse_qsl(split_url.query, keep_blank_values=True))
    connection_limit = query.get("connection_limit")
    if connection_limit and connection_limit.isdigit():
        kwargs["pool_size"] = int(connection_limit)
        kwargs["max_overflow"] = 10
    else:
        kwargs["pool_size"] = 10
        kwargs["max_overflow"] = 20
    return kwargs


engine_kwargs = _get_engine_kwargs(database_url)
normalized_url = _normalize_asyncpg_url(database_url)

engine = create_async_engine(normalized_url, **engine_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    """FastAPI dependency for yielding async db sessions."""
    async with async_session() as session:
        yield session
