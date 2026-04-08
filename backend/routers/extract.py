from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Meeting, ActionItem, Decision
from groq import Groq
import os, json
from dotenv import load_dotenv
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
import csv, io

load_dotenv()

router = APIRouter(prefix="/extract", tags=["extract"])
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def build_prompt(transcript: str) -> str:
    return f"""You are an expert meeting analyst. Read the transcript and extract decisions and action items.

Return ONLY valid JSON with this exact structure:
{{
  "decisions": [
    {{"description": "string", "confidence": <0.0 to 1.0>, "evidence": "<exact quote from transcript>"}}
  ],
  "action_items": [
    {{"owner": "string", "task": "string", "due_date": "string or null", "confidence": <0.0 to 1.0>, "evidence": "<exact quote>"}}
  ]
}}

Confidence guide: 1.0 = explicitly stated, 0.7 = strongly implied, 0.4 = inferred

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

@router.post("/summary/{meeting_id}")
def generate_summary(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    try:
        with open(meeting.file_path, 'r', encoding='utf-8') as f:
            transcript = f.read()
    except FileNotFoundError:
        raise HTTPException(400, "Transcript file not found")

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": "You are a meeting analyst. Always respond with valid JSON only."},
            {"role": "user", "content": f"""Analyse this meeting transcript and return ONLY this JSON:
{{
  "tldr": "<2-3 sentence summary of the entire meeting>",
  "key_topics": ["<topic1>", "<topic2>", "<topic3>"],
  "meeting_type": "<standup|planning|review|brainstorm|decision|other>",
  "estimated_duration": "<estimated meeting length e.g. 30 mins>",
  "participants": ["<name1>", "<name2>"]
}}

TRANSCRIPT:
{transcript}"""}
        ],
        temperature=0.1,
        max_tokens=600,
    )

    raw = response.choices[0].message.content.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(raw)

@router.get("/{meeting_id}")
def get_extractions(meeting_id: int, db: Session = Depends(get_db)):
    decisions = db.query(Decision).filter(Decision.meeting_id == meeting_id).all()
    action_items = db.query(ActionItem).filter(ActionItem.meeting_id == meeting_id).all()
    return {
        "decisions": [{"id": d.id, "description": d.description} for d in decisions],
        "action_items": [{"id": a.id, "owner": a.owner, "task": a.task, "due_date": a.due_date} for a in action_items]
    }
    
@router.get("/export/{meeting_id}/csv")
def export_csv(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    decisions = db.query(Decision).filter(Decision.meeting_id == meeting_id).all()
    action_items = db.query(ActionItem).filter(ActionItem.meeting_id == meeting_id).all()

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(["MEETING", meeting.title])
    writer.writerow(["DATE", str(meeting.created_at.date())])
    writer.writerow([])

    writer.writerow(["DECISIONS"])
    writer.writerow(["#", "Description"])
    for i, d in enumerate(decisions, 1):
        writer.writerow([i, d.description])

    writer.writerow([])
    writer.writerow(["ACTION ITEMS"])
    writer.writerow(["Owner", "Task", "Due Date"])
    for a in action_items:
        writer.writerow([a.owner, a.task, a.due_date])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={meeting.title}-export.csv"}
    )

@router.get("/export/{meeting_id}/pdf")
def export_pdf(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    decisions = db.query(Decision).filter(Decision.meeting_id == meeting_id).all()
    action_items = db.query(ActionItem).filter(ActionItem.meeting_id == meeting_id).all()

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph(meeting.title, styles['Title']))
    elements.append(Paragraph(f"Date: {meeting.created_at.date()}", styles['Normal']))
    elements.append(Spacer(1, 20))

    elements.append(Paragraph("Decisions", styles['Heading2']))
    if decisions:
        data = [["#", "Decision"]] + [[i+1, d.description] for i, d in enumerate(decisions)]
        t = Table(data, colWidths=[40, 450])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#4f46e5')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f5f5ff')]),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e5e7eb')),
            ('PADDING', (0,0), (-1,-1), 8),
        ]))
        elements.append(t)
    else:
        elements.append(Paragraph("No decisions found.", styles['Normal']))

    elements.append(Spacer(1, 20))
    elements.append(Paragraph("Action Items", styles['Heading2']))
    if action_items:
        data = [["Owner", "Task", "Due Date"]] + [
            [a.owner, a.task, a.due_date or "—"] for a in action_items
        ]
        t = Table(data, colWidths=[100, 270, 120])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#4f46e5')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.white),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f5f5ff')]),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e5e7eb')),
            ('PADDING', (0,0), (-1,-1), 8),
        ]))
        elements.append(t)
    else:
        elements.append(Paragraph("No action items found.", styles['Normal']))

    doc.build(elements)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={meeting.title}-export.pdf"}
    )    