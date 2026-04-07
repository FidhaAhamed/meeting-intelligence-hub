from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Meeting
from groq import Groq
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from typing import Optional


load_dotenv()

router = APIRouter(prefix="/chat", tags=["chat"])
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

class ChatRequest(BaseModel):
    question: str
    meeting_id: Optional[int] = None

def load_transcripts(db: Session, meeting_id: Optional[int]) -> list[dict]:
    if meeting_id:
        meetings = db.query(Meeting).filter(Meeting.id == meeting_id).all()
    else:
        meetings = db.query(Meeting).all()

    results = []
    for m in meetings:
        try:
            with open(m.file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            results.append({"title": m.title, "id": m.id, "content": content})
        except FileNotFoundError:
            continue
    return results

def build_context(transcripts: list[dict]) -> str:
    context = ""
    for t in transcripts:
        context += f"\n\n--- MEETING: {t['title']} (ID: {t['id']}) ---\n{t['content']}"
    return context

@router.post("/")
def chat(request: ChatRequest, db: Session = Depends(get_db)):
    transcripts = load_transcripts(db, request.meeting_id)
    if not transcripts:
        raise HTTPException(404, "No transcripts found")

    context = build_context(transcripts)

    system_prompt = """You are a meeting intelligence assistant. 
You have access to meeting transcripts and answer questions based strictly on their content.
Always cite which meeting your answer comes from by mentioning the meeting title.
If the answer is not in the transcripts, say so clearly.
Keep answers concise and structured."""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": f"Transcripts:{context}\n\nQuestion: {request.question}"}
        ],
        temperature=0.2,
        max_tokens=1000,
    )

    answer = response.choices[0].message.content.strip()
    sources = [{"meeting_id": t["id"], "title": t["title"]} for t in transcripts]

    return {"answer": answer, "sources": sources}