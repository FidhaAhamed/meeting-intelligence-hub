from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Meeting
import os, re
from datetime import datetime

router = APIRouter(prefix="/meetings", tags=["meetings"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def parse_transcript(content: str):
    word_count = len(content.split())
    speakers = set(re.findall(r'^([A-Z][a-zA-Z\s]+):', content, re.MULTILINE))
    return word_count, len(speakers) if speakers else 1

@router.post("/upload")
async def upload_transcripts(files: list[UploadFile] = File(...), db: Session = Depends(get_db)):
    saved = []
    for file in files:
        if not file.filename.endswith(('.txt', '.vtt')):
            raise HTTPException(400, f"Unsupported file type: {file.filename}")

        content = (await file.read()).decode('utf-8', errors='ignore')
        file_path = os.path.join(UPLOAD_DIR, file.filename)

        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        word_count, speaker_count = parse_transcript(content)
        title = file.filename.rsplit('.', 1)[0].replace('-', ' ').replace('_', ' ').title()

        meeting = Meeting(
            title=title,
            file_name=file.filename,
            file_path=file_path,
            word_count=word_count,
            speaker_count=speaker_count,
            meeting_date=datetime.utcnow(),
        )
        db.add(meeting)
        db.commit()
        db.refresh(meeting)
        saved.append(meeting)

    return {"uploaded": len(saved), "meetings": [{"id": m.id, "title": m.title} for m in saved]}

@router.get("/")
def get_meetings(db: Session = Depends(get_db)):
    return db.query(Meeting).order_by(Meeting.created_at.desc()).all()

@router.get("/{meeting_id}")
def get_meeting(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    return meeting

@router.get("/search")
def search_meetings(q: str = "", db: Session = Depends(get_db)):
    query = db.query(Meeting)
    if q:
        query = query.filter(
            Meeting.title.ilike(f"%{q}%")
        )
    return query.order_by(Meeting.created_at.desc()).all()