"""
Database module — async SQLAlchemy with PostgreSQL.
NFR-03: Uses open-source PostgreSQL; connection string is environment-configured.
"""

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings


# Async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.is_development,  # SQL logging in dev only
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    """Base class for all SQLAlchemy models."""
    pass


async def get_db() -> AsyncSession:
    """FastAPI dependency — provides a database session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    """Create all tables on startup (development). In production, use Alembic."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
