from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from ..core.config import settings


def _get_engine():
    url = settings.DATABASE_URL

    # Turso / libSQL remote connection (production)
    if url.startswith("libsql+sqld://") or url.startswith("sqlite+libsql://"):
        # Use libsql-experimental SQLAlchemy dialect
        engine = create_engine(url)
        return engine

    # Standard SQLite (local development)
    engine = create_engine(
        url,
        connect_args={"check_same_thread": False}
    )
    return engine


engine = _get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
