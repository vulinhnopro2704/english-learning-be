from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from app.config import settings

database_url = settings.DATABASE_URL


def _normalize_asyncpg_url(url: str) -> str:
    normalized = url
    if normalized.startswith("postgresql://"):
        normalized = normalized.replace("postgresql://", "postgresql+asyncpg://", 1)

    split_url = urlsplit(normalized)
    query = dict(parse_qsl(split_url.query, keep_blank_values=True))

    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)

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


database_url = _normalize_asyncpg_url(database_url)

engine = create_async_engine(database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    async with async_session() as session:
        yield session
