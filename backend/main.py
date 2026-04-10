from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from database import engine, Base
from routers.extract import router as extract_router
from routers.meetings import router as meetings_router
from routers.rag import router as rag_router
from routers.sentiment import router as sentiment_router

Base.metadata.create_all(bind=engine)


def ensure_database_columns() -> None:
    inspector = inspect(engine)

    statements = []
    if "meetings" in inspector.get_table_names():
        existing_columns = {column["name"] for column in inspector.get_columns("meetings")}
        if "project_name" not in existing_columns:
            statements.append("ALTER TABLE meetings ADD COLUMN project_name VARCHAR")
        if "meeting_type" not in existing_columns:
            statements.append("ALTER TABLE meetings ADD COLUMN meeting_type VARCHAR")
        if "sentiment_overall_score" not in existing_columns:
            statements.append("ALTER TABLE meetings ADD COLUMN sentiment_overall_score DOUBLE PRECISION")
        if "sentiment_overall_label" not in existing_columns:
            statements.append("ALTER TABLE meetings ADD COLUMN sentiment_overall_label VARCHAR")

    if "decisions" in inspector.get_table_names():
        existing_columns = {column["name"] for column in inspector.get_columns("decisions")}
        if "confidence" not in existing_columns:
            statements.append("ALTER TABLE decisions ADD COLUMN confidence DOUBLE PRECISION")
        if "evidence" not in existing_columns:
            statements.append("ALTER TABLE decisions ADD COLUMN evidence TEXT")
        if "source_span" not in existing_columns:
            statements.append("ALTER TABLE decisions ADD COLUMN source_span VARCHAR")

    if "action_items" in inspector.get_table_names():
        existing_columns = {column["name"] for column in inspector.get_columns("action_items")}
        if "confidence" not in existing_columns:
            statements.append("ALTER TABLE action_items ADD COLUMN confidence DOUBLE PRECISION")
        if "evidence" not in existing_columns:
            statements.append("ALTER TABLE action_items ADD COLUMN evidence TEXT")
        if "source_span" not in existing_columns:
            statements.append("ALTER TABLE action_items ADD COLUMN source_span VARCHAR")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


ensure_database_columns()

app = FastAPI(title="Meeting Intelligence Hub")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meetings_router)
app.include_router(extract_router)
app.include_router(sentiment_router)
app.include_router(rag_router)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Meeting Hub API is running"}
