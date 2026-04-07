"""FSRS-AI Service — FastAPI application.

Spaced Repetition scheduling & ML optimization microservice.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import engine
from app.config import settings
from app.models import Base
from app.routers import helper, optimize, report, review


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables on startup (dev convenience; use Alembic in production)
    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS fsrs"))
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(
    title="FSRS-AI Service",
    description=(
        "Microservice xử lý thuật toán Spaced Repetition (FSRS) "
        "và Machine Learning Optimizer cho hệ thống học từ vựng."
    ),
    version="1.0.0",
    lifespan=lifespan,
    root_path=settings.ROOT_PATH,
    # Serialize all responses with camelCase aliases
    response_model_by_alias=True,
    # Use /api-docs for consistency with other services
    docs_url="/api-docs",
    redoc_url="/api-docs/redoc",
    openapi_url="/api-docs/openapi.json",
)

# CORS — allow learn service and frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(review.router)
app.include_router(optimize.router)
app.include_router(helper.router)
app.include_router(report.router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "fsrs-ai"}
