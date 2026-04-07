from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import meetings, extract, chat, sentiment 

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Meeting Intelligence Hub")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meetings.router)
app.include_router(extract.router)
app.include_router(chat.router)
app.include_router(sentiment.router)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Meeting Hub API is running"}