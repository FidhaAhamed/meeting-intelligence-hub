from datetime import datetime
import os
import re

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from models import ActionItem, Decision, Meeting


router = APIRouter(prefix="/meetings", tags=["meetings"])

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

COLLECTIVE_SPEAKER_LABELS = {
    "all",
    "everyone",
    "everybody",
    "team",
    "group",
    "audience",
    "participants",
}

MONTH_NAMES = (
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
)


def normalize_speaker_label(label: str) -> str:
    return re.sub(r"\s*\([^)]+\)", "", label).strip().lower()


def parse_transcript(content: str) -> tuple[int, int]:
    word_count = len(content.split())
    speakers = set(re.findall(r'^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*(?:\s*\([^)]+\))?)\s*:', content, re.MULTILINE))

    excluded = {"note", "update", "action", "decision", "summary"}
    speakers = {
        speaker for speaker in speakers
        if normalize_speaker_label(speaker) not in excluded
        and normalize_speaker_label(speaker) not in COLLECTIVE_SPEAKER_LABELS
    }

    return word_count, len(speakers) if speakers else 1


def prettify_title(file_name: str) -> str:
    return file_name.rsplit(".", 1)[0].replace("-", " ").replace("_", " ").title()


def detect_meeting_type(title: str, content: str) -> str:
    haystack = f"{title}\n{content[:3000]}".lower()
    if any(term in haystack for term in ("standup", "daily sync", "daily update")):
        return "standup"
    if any(term in haystack for term in ("brainstorm", "ideation")):
        return "brainstorm"
    if any(term in haystack for term in ("retrospective", "retro")):
        return "retrospective"
    if any(term in haystack for term in ("review", "demo", "showcase")):
        return "review"
    if any(term in haystack for term in ("planning", "roadmap", "sprint plan")):
        return "planning"
    if any(term in haystack for term in ("launch", "decision made", "approved", "go ahead")):
        return "decision"
    return "general"


def detect_meeting_date(file_name: str, content: str) -> datetime | None:
    sources = [file_name, content[:5000]]

    numeric_patterns = [
        (r"\b(\d{4})-(\d{2})-(\d{2})\b", "%Y-%m-%d"),
        (r"\b(\d{2})/(\d{2})/(\d{4})\b", "%m/%d/%Y"),
        (r"\b(\d{2})-(\d{2})-(\d{4})\b", "%m-%d-%Y"),
    ]
    for source in sources:
        for pattern, fmt in numeric_patterns:
            match = re.search(pattern, source)
            if match:
                try:
                    return datetime.strptime(match.group(0), fmt)
                except ValueError:
                    pass

    month_pattern = r"\b(" + "|".join(MONTH_NAMES) + r")\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?"
    for source in sources:
        match = re.search(month_pattern, source, re.IGNORECASE)
        if not match:
            continue
        cleaned = re.sub(r"(\d{1,2})(st|nd|rd|th)", r"\1", match.group(0), flags=re.IGNORECASE)
        for fmt in ("%B %d, %Y", "%B %d %Y", "%B %d, %y", "%B %d"):
            try:
                parsed = datetime.strptime(cleaned, fmt)
                if "%Y" not in fmt and "%y" not in fmt:
                    parsed = parsed.replace(year=datetime.utcnow().year)
                return parsed
            except ValueError:
                continue

    return None


def infer_project_name(file_name: str, explicit_project_name: str | None) -> str | None:
    if explicit_project_name and explicit_project_name.strip():
        return explicit_project_name.strip()

    base = file_name.rsplit(".", 1)[0]
    project = re.sub(r"[_-]*(meeting|call|transcript|notes|sync|review|standup)\b.*$", "", base, flags=re.IGNORECASE)
    project = re.sub(r"[_-]*\d{4}[-_]\d{2}[-_]\d{2}.*$", "", project)
    project = project.replace("-", " ").replace("_", " ").strip()
    return project.title() if project else None


@router.post("/upload")
async def upload_transcripts(
    files: list[UploadFile] = File(...),
    project_name: str | None = Form(default=None),
    db: Session = Depends(get_db),
):
    saved = []
    for file in files:
        if not file.filename.endswith((".txt", ".vtt")):
            raise HTTPException(400, f"Unsupported file type: {file.filename}")

        content = (await file.read()).decode("utf-8", errors="ignore")
        file_path = os.path.join(UPLOAD_DIR, file.filename)

        with open(file_path, "w", encoding="utf-8") as handle:
            handle.write(content)

        word_count, speaker_count = parse_transcript(content)
        title = prettify_title(file.filename)
        detected_project_name = infer_project_name(file.filename, project_name)
        detected_meeting_date = detect_meeting_date(file.filename, content)
        detected_meeting_type = detect_meeting_type(title, content)

        meeting = Meeting(
            title=title,
            project_name=detected_project_name,
            file_name=file.filename,
            file_path=file_path,
            meeting_date=detected_meeting_date,
            meeting_type=detected_meeting_type,
            word_count=word_count,
            speaker_count=speaker_count,
        )
        db.add(meeting)
        db.commit()
        db.refresh(meeting)
        saved.append(meeting)

    return {
        "uploaded": len(saved),
        "meetings": [
            {
                "id": meeting.id,
                "title": meeting.title,
                "project_name": meeting.project_name,
                "meeting_date": meeting.meeting_date.isoformat() if meeting.meeting_date else None,
                "meeting_type": meeting.meeting_type,
            }
            for meeting in saved
        ],
    }


@router.get("/")
def get_meetings(db: Session = Depends(get_db)):
    return db.query(Meeting).order_by(Meeting.created_at.desc()).all()


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_meetings = db.query(func.count(Meeting.id)).scalar() or 0
    total_projects = (
        db.query(func.count(func.distinct(Meeting.project_name)))
        .filter(Meeting.project_name.isnot(None), Meeting.project_name != "")
        .scalar()
        or 0
    )
    total_decisions = db.query(func.count(Decision.id)).scalar() or 0
    total_actions = db.query(func.count(ActionItem.id)).scalar() or 0

    average_sentiment = (
        db.query(func.avg(Meeting.sentiment_overall_score))
        .filter(Meeting.sentiment_overall_score.isnot(None))
        .scalar()
    )

    sentiment_label = "Unscored"
    if average_sentiment is not None:
        if average_sentiment >= 0.3:
            sentiment_label = "Positive"
        elif average_sentiment <= -0.3:
            sentiment_label = "Negative"
        else:
            sentiment_label = "Neutral"

    return {
        "total_meetings": total_meetings,
        "total_projects": total_projects,
        "total_decisions": total_decisions,
        "total_actions": total_actions,
        "average_sentiment": float(average_sentiment) if average_sentiment is not None else None,
        "sentiment_label": sentiment_label,
    }


@router.get("/search")
def search_meetings(q: str = "", db: Session = Depends(get_db)):
    query = db.query(Meeting)
    if q:
        query = query.filter(
            or_(
                Meeting.title.ilike(f"%{q}%"),
                Meeting.project_name.ilike(f"%{q}%"),
                Meeting.meeting_type.ilike(f"%{q}%"),
            )
        )
    return query.order_by(Meeting.created_at.desc()).all()


@router.get("/{meeting_id}")
def get_meeting(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    return meeting


@router.delete("/{meeting_id}")
def delete_meeting(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    file_path = meeting.file_path
    db.delete(meeting)
    db.commit()

    if file_path and os.path.exists(file_path):
        os.remove(file_path)

    return {"message": "Meeting deleted successfully", "id": meeting_id}


