"""Application configuration settings for Listening Service."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuration settings for Listening Microservice."""

    HOST: str = "0.0.0.0"
    PORT: int = 3006
    SERVICE_NAME: str = "listening-service"
    ROOT_PATH: str = "/listening"
    SWAGGER_ENABLED: bool = True
    CORS_ORIGIN: str = "*"

    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()
