from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./nirnay.db"

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_and_migrate_db(bind_engine=None):
    """
    Creates new tables and automatically adds any missing columns to existing SQLite tables.
    Never deletes or drops data.
    """
    target_engine = bind_engine or engine
    # 1. Create any missing tables
    Base.metadata.create_all(bind=target_engine)

    # 2. Check and migrate missing columns
    with target_engine.connect() as conn:
        for table_name, table in Base.metadata.tables.items():
            try:
                result = conn.execute(text(f"PRAGMA table_info({table_name})")).fetchall()
                existing_cols = {row[1] for row in result}  # row[1] is column name in PRAGMA table_info

                for col in table.columns:
                    if col.name not in existing_cols:
                        # Determine simple SQLite type
                        col_type_str = str(col.type).upper()
                        if "INT" in col_type_str:
                            type_name = "INTEGER"
                        elif "BOOL" in col_type_str:
                            type_name = "BOOLEAN"
                        elif "FLOAT" in col_type_str or "NUMERIC" in col_type_str:
                            type_name = "FLOAT"
                        elif "DATETIME" in col_type_str:
                            type_name = "DATETIME"
                        else:
                            type_name = "TEXT"

                        alter_sql = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {type_name}"
                        conn.execute(text(alter_sql))
                        conn.commit()
            except Exception as e:
                # Table might not exist or other DB engine
                pass
