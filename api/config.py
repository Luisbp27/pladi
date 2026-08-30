from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_host: str = "postgis"
    postgres_port: int = 5432
    postgres_user: str = "pladi"
    postgres_password: str = "pladi"
    postgres_db: str = "pladi"
    minio_endpoint: str = "http://minio:9000"
    models_dir: str = "/opt/models"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


settings = Settings()
