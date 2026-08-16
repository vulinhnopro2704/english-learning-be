"""Listening Microservice — FastAPI application entry point.

YouTube transcript extraction, timestamps, and interactive exercise generation.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import init_db, async_session
from app.repositories.lesson_repo import LessonRepository
from app.routers import listening


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for database schema & tables initialization."""
    try:
        await init_db()
        async with async_session() as session:
            await LessonRepository.seed_default_lessons(session)
    except Exception as e:
        print(f"[ListeningService] Database initialization warning: {e}")
    yield


app = FastAPI(
    title="Listening Service",
    description=(
        "Microservice xử lý trích xuất transcript YouTube, timestamp đồng bộ, "
        "và tự động tạo bài tập điền từ (Fill in the Blank) & Shadowing."
    ),
    version="1.0.0",
    root_path=settings.ROOT_PATH,
    response_model_by_alias=True,
    docs_url="/api-docs",
    redoc_url="/api-docs/redoc",
    openapi_url="/api-docs/openapi.json",
    lifespan=lifespan,
)

# Configure CORS with dynamic origin matching for credentialed requests
raw_cors = getattr(settings, "CORS_ORIGIN", None) or getattr(settings, "CORS_ORIGINS", None) or "*"
cors_origins = [origin.strip() for origin in raw_cors.split(",") if origin.strip()]

if "*" in cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Register routers
app.include_router(listening.router)


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for gateway status checks."""
    return {"status": "ok", "service": settings.SERVICE_NAME}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
