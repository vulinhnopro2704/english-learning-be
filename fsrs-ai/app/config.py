from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/fsrs_ai"
    PORT: int = 8000
    ROOT_PATH: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
