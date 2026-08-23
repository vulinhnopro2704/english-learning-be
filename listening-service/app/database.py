"""Database connection and session management for Listening Service using PostgreSQL."""

from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import text
from app.config import settings

database_url = settings.DATABASE_URL


def _normalize_asyncpg_url(url: str) -> str:
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
    query.pop("channel_binding", None)
    query.pop("connection_limit", None)

    if sslmode and "ssl" not in query:
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


def _get_engine_kwargs(url: str) -> dict:
    kwargs = {"echo": False}
    split_url = urlsplit(url)
    query = dict(parse_qsl(split_url.query, keep_blank_values=True))
    connection_limit = query.get("connection_limit")
    if connection_limit and connection_limit.isdigit():
        kwargs["pool_size"] = int(connection_limit)
        kwargs["max_overflow"] = 0
    return kwargs


engine_kwargs = _get_engine_kwargs(database_url)
normalized_url = _normalize_asyncpg_url(database_url)

engine = create_async_engine(normalized_url, **engine_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    """FastAPI dependency for yielding async db sessions."""
    async with async_session() as session:
        yield session


async def init_db():
    """Initialize PostgreSQL schema 'listening', tables, and sync missing columns."""
    from app.models import Base
    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS listening;"))
        await conn.run_sync(Base.metadata.create_all)

        migration_statements = [
            # listening.lessons
            'ALTER TABLE listening.lessons ADD COLUMN IF NOT EXISTS "status" VARCHAR(32) NOT NULL DEFAULT \'READY\';',
            'ALTER TABLE listening.lessons ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;',
            'ALTER TABLE listening.lessons ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;',
            'ALTER TABLE listening.lessons ADD COLUMN IF NOT EXISTS "duration" VARCHAR(32) NOT NULL DEFAULT \'03:30\';',
            'ALTER TABLE listening.lessons ADD COLUMN IF NOT EXISTS "difficulty" VARCHAR(32) NOT NULL DEFAULT \'medium\';',
            'ALTER TABLE listening.lessons ADD COLUMN IF NOT EXISTS "language" VARCHAR(16) NOT NULL DEFAULT \'en\';',
            'ALTER TABLE listening.lessons ADD COLUMN IF NOT EXISTS "isPublished" BOOLEAN NOT NULL DEFAULT TRUE;',
            # listening.lesson_vocabularies
            'ALTER TABLE listening.lesson_vocabularies ADD COLUMN IF NOT EXISTS "partOfSpeech" VARCHAR(64);',
            'ALTER TABLE listening.lesson_vocabularies ADD COLUMN IF NOT EXISTS "phonetic" VARCHAR(255);',
            'ALTER TABLE listening.lesson_vocabularies ADD COLUMN IF NOT EXISTS "meaningVi" TEXT NOT NULL DEFAULT \'\';',
            'ALTER TABLE listening.lesson_vocabularies ADD COLUMN IF NOT EXISTS "example" TEXT;',
            'ALTER TABLE listening.lesson_vocabularies ADD COLUMN IF NOT EXISTS "exampleVi" TEXT;',
            'ALTER TABLE listening.lesson_vocabularies ADD COLUMN IF NOT EXISTS "audioUrl" VARCHAR(500);',
            # listening.lesson_quizzes
            'ALTER TABLE listening.lesson_quizzes ADD COLUMN IF NOT EXISTS "correctAnswerIndex" INTEGER NOT NULL DEFAULT 0;',
            'ALTER TABLE listening.lesson_quizzes ADD COLUMN IF NOT EXISTS "explanation" TEXT;',
            'ALTER TABLE listening.lesson_quizzes ADD COLUMN IF NOT EXISTS "segmentTimestamp" DOUBLE PRECISION NOT NULL DEFAULT 0.0;',
            # listening.lesson_segments
            'ALTER TABLE listening.lesson_segments ADD COLUMN IF NOT EXISTS "maskedText" TEXT;',
            # listening.segment_blanks
            'ALTER TABLE listening.segment_blanks ADD COLUMN IF NOT EXISTS "originalWord" VARCHAR(255) NOT NULL DEFAULT \'\';',
            'ALTER TABLE listening.segment_blanks ADD COLUMN IF NOT EXISTS "hint" VARCHAR(255) NOT NULL DEFAULT \'\';',
        ]
        for stmt in migration_statements:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass
