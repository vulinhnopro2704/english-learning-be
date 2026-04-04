from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/fsrs_ai"
    PORT: int = 8000
    ROOT_PATH: str = ""
    FSRS_TRAIN_MIN_VALID_LOGS: int = 50
    FSRS_TRAIN_MIN_DAYS_SINCE_LAST: int = 3
    FSRS_TRAIN_MIN_IMPROVEMENT_PCT: float = 0.02
    FSRS_TRAIN_METRIC: str = "log_loss"
    FSRS_RESCHEDULE_MAX_SHIFT_RATIO: float = 0.3
    FSRS_ASYNC_RESCHEDULE_ENABLED: bool = True

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
