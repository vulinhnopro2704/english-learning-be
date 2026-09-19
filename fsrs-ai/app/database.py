"""Database connection and session management for FSRS-AI Service using PostgreSQL & SQLAlchemy (Asyncpg)."""

import ssl
from typing import Any, Dict, Tuple
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

database_url = settings.DATABASE_URL


def _prepare_asyncpg_config(url: str) -> Tuple[str, Dict[str, Any]]:
    """Normalize database URL for asyncpg, strip unsupported query parameters,
    and configure SSL context and connection pool matching Node.js/Prisma behavior.
    """
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
    ssl_param = query.pop("ssl", None)

    # Strip parameters that asyncpg doesn't support directly as query params
    query.pop("channel_binding", None)
    connection_limit = query.pop("connection_limit", None)
    query.pop("pooler", None)
    query.pop("pgbouncer", None)
    query.pop("target_session_attrs", None)
    query.pop("schema", None)
    query.pop("sslrootcert", None)

    # Determine SSL configuration
    is_ssl_disabled = sslmode == "disable" or ssl_param == "disable" or ssl_param == "false"
    is_ssl_required = (
        sslmode in ("require", "prefer", "verify-ca", "verify-full")
        or ssl_param in ("require", "true", "1")
        or (not is_ssl_disabled and bool(split_url.hostname) and "localhost" not in str(split_url.hostname) and "127.0.0.1" not in str(split_url.hostname))
    )

    connect_args: Dict[str, Any] = {
        "timeout": 60,
        "command_timeout": 60,
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    }

    if is_ssl_required:
        ctx = ssl.create_default_context()
        # In WSL2/Cloudflared/Docker environments, avoid strict hostname drop matching Node.js rejectUnauthorized: false
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        connect_args["ssl"] = ctx
    else:
        connect_args["ssl"] = None

    normalized_query = urlencode(query, doseq=True)
    clean_url = urlunsplit(
        (
            split_url.scheme,
            split_url.netloc,
            split_url.path,
            normalized_query,
            split_url.fragment,
        )
    )

    engine_kwargs: Dict[str, Any] = {
        "echo": False,
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "connect_args": connect_args,
    }

    if connection_limit and str(connection_limit).isdigit():
        engine_kwargs["pool_size"] = int(connection_limit)
        engine_kwargs["max_overflow"] = 10
    else:
        engine_kwargs["pool_size"] = 10
        engine_kwargs["max_overflow"] = 20

    return clean_url, engine_kwargs


# Backward compatibility alias
def _normalize_asyncpg_url(url: str) -> str:
    clean_url, _ = _prepare_asyncpg_config(url)
    return clean_url


normalized_url, engine_kwargs = _prepare_asyncpg_config(database_url)

engine = create_async_engine(normalized_url, **engine_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    """FastAPI dependency for yielding async db sessions."""
    async with async_session() as session:
        yield session
