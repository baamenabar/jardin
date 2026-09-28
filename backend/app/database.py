from typing import Generator
from sqlalchemy import event, text
from sqlmodel import SQLModel, Session, create_engine
from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)


@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def init_db() -> None:
    SQLModel.metadata.create_all(engine)
    # Ensure staging_area columns exist on SQLite property table
    with engine.connect() as conn:
        for col, col_type in [
            ("staging_area_x", "FLOAT"),
            ("staging_area_y", "FLOAT"),
            ("staging_area_w", "FLOAT"),
            ("staging_area_h", "FLOAT"),
        ]:
            try:
                conn.execute(text(f"ALTER TABLE property ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
