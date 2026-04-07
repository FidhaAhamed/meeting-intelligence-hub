from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Meeting, ActionItem, Decision
from groq import Groq
import os, json
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/extract", tags=["extract"])
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def build_prompt(transcript: str) -> str:
    return f"""You are an expert meeting analyst. Read the transcript below and extract:
1. Key decisions made by the team
2. Action items assigned to specific people

Return ONLY a valid JSON object with this exact structure, nothing else:
{{
  "decisions": [
    {{"description": "string"}}
  ],
  "action_items": [
    {{"owner": "string", "task": "string", "due_date": "string or null"}}
  ]
}}

TRANSCRIPT:
{transcript}"""

@router.post("/{meeting_id}")
def extract_from_meeting(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    try:
        with open(meeting.file_path, 'r', encoding='utf-8') as f:
            transcript = f.read()
    except FileNotFoundError:
        raise HTTPException(400, "Transcript file not found on disk")

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": "You are an expert meeting analyst. Always respond with valid JSON only, no extra text."
            },
            {
                "role": "user",
                "content": build_prompt(transcript)
            }
        ],
        temperature=0.1,
        max_tokens=2000,
    )

    raw = response.choices[0].message.content.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    data = json.loads(raw)

    # Clear old extractions for this meeting
    db.query(ActionItem).filter(ActionItem.meeting_id == meeting_id).delete()
    db.query(Decision).filter(Decision.meeting_id == meeting_id).delete()

    for d in data.get("decisions", []):
        db.add(Decision(meeting_id=meeting_id, description=d["description"]))

    for a in data.get("action_items", []):
        db.add(ActionItem(
            meeting_id=meeting_id,
            owner=a.get("owner", "Unassigned"),
            task=a.get("task", ""),
            due_date=a.get("due_date", "Not specified")
        ))

    db.commit()
    return {"decisions": data.get("decisions", []), "action_items": data.get("action_items", [])}

@router.get("/{meeting_id}")
def get_extractions(meeting_id: int, db: Session = Depends(get_db)):
    decisions = db.query(Decision).filter(Decision.meeting_id == meeting_id).all()
    action_items = db.query(ActionItem).filter(ActionItem.meeting_id == meeting_id).all()
    return {
        "decisions": [{"id": d.id, "description": d.description} for d in decisions],
        "action_items": [{"id": a.id, "owner": a.owner, "task": a.task, "due_date": a.due_date} for a in action_items]
    }