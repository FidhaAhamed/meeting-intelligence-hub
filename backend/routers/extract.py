import csv
import io
import json
import os

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from groq import Groq
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session

from database import get_db
from models import ActionItem, Decision, Meeting


load_dotenv()

router = APIRouter(prefix="/extract", tags=["extract"])
client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def build_prompt(transcript: str) -> str:
    return f"""You are an expert meeting analyst. Read the transcript and extract decisions and action items.

Return ONLY valid JSON with this exact structure:
{{
  "decisions": [
    {{
      "description": "string",
      "confidence": <0.0 to 1.0>,
      "evidence": "<exact quote from transcript>",
      "source_span": "<optional citation like lines 12-16 or 00:03:12-00:03:44>"
    }}
  ],
  "action_items": [
    {{
      "owner": "string",
      "task": "string",
      "due_date": "string or null",
      "confidence": <0.0 to 1.0>,
      "evidence": "<exact quote>",
      "source_span": "<optional citation like lines 22-25 or 00:14:02-00:14:18>"
    }}
  ]
}}

Confidence guide: 1.0 = explicitly stated, 0.7 = strongly implied, 0.4 = inferred

TRANSCRIPT:
{transcript}"""


def serialize_decision(decision: Decision) -> dict:
    return {
        "id": decision.id,
        "description": decision.description,
        "confidence": decision.confidence,
        "evidence": decision.evidence,
        "source_span": decision.source_span,
    }


def serialize_action_item(action_item: ActionItem) -> dict:
    return {
        "id": action_item.id,
        "owner": action_item.owner,
        "task": action_item.task,
        "due_date": action_item.due_date,
        "confidence": action_item.confidence,
        "evidence": action_item.evidence,
        "source_span": action_item.source_span,
    }


@router.post("/{meeting_id}")
def extract_from_meeting(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    try:
        with open(meeting.file_path, "r", encoding="utf-8") as handle:
            transcript = handle.read()
    except FileNotFoundError:
        raise HTTPException(400, "Transcript file not found on disk")

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": "You are an expert meeting analyst. Always respond with valid JSON only, no extra text.",
            },
            {
                "role": "user",
                "content": build_prompt(transcript),
            },
        ],
        temperature=0.1,
        max_tokens=2200,
    )

    raw = response.choices[0].message.content.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    data = json.loads(raw)

    db.query(ActionItem).filter(ActionItem.meeting_id == meeting_id).delete()
    db.query(Decision).filter(Decision.meeting_id == meeting_id).delete()

    for item in data.get("decisions", []):
        db.add(
            Decision(
                meeting_id=meeting_id,
                description=item.get("description", ""),
                confidence=item.get("confidence"),
                evidence=item.get("evidence"),
                source_span=item.get("source_span"),
            )
        )

    for item in data.get("action_items", []):
        db.add(
            ActionItem(
                meeting_id=meeting_id,
                owner=item.get("owner", "Unassigned"),
                task=item.get("task", ""),
                due_date=item.get("due_date", "Not specified"),
                confidence=item.get("confidence"),
                evidence=item.get("evidence"),
                source_span=item.get("source_span"),
            )
        )

    db.commit()
    return {
        "decisions": data.get("decisions", []),
        "action_items": data.get("action_items", []),
    }


@router.post("/summary/{meeting_id}")
def generate_summary(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    try:
        with open(meeting.file_path, "r", encoding="utf-8") as handle:
            transcript = handle.read()
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
{transcript}"""},
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
        "decisions": [serialize_decision(decision) for decision in decisions],
        "action_items": [serialize_action_item(action_item) for action_item in action_items],
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
    writer.writerow(["DATE", str((meeting.meeting_date or meeting.created_at).date())])
    writer.writerow([])

    writer.writerow(["DECISIONS"])
    writer.writerow(["#", "Description", "Confidence", "Evidence", "Source Span"])
    for index, decision in enumerate(decisions, 1):
        writer.writerow([
            index,
            decision.description,
            decision.confidence,
            decision.evidence,
            decision.source_span,
        ])

    writer.writerow([])
    writer.writerow(["ACTION ITEMS"])
    writer.writerow(["Owner", "Task", "Due Date", "Confidence", "Evidence", "Source Span"])
    for action_item in action_items:
        writer.writerow([
            action_item.owner,
            action_item.task,
            action_item.due_date,
            action_item.confidence,
            action_item.evidence,
            action_item.source_span,
        ])

    output.seek(0)
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={meeting.title}-export.csv"},
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

    elements.append(Paragraph(meeting.title, styles["Title"]))
    elements.append(Paragraph(f"Date: {(meeting.meeting_date or meeting.created_at).date()}", styles["Normal"]))
    elements.append(Spacer(1, 20))

    elements.append(Paragraph("Decisions", styles["Heading2"]))
    if decisions:
        data = [["#", "Decision", "Conf.", "Source Span"]]
        for index, decision in enumerate(decisions, 1):
            data.append([
                index,
                decision.description,
                f"{round(decision.confidence * 100)}%" if decision.confidence is not None else "-",
                decision.source_span or "-",
            ])
        table = Table(data, colWidths=[30, 300, 50, 110])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f5ff")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
            ("PADDING", (0, 0), (-1, -1), 8),
        ]))
        elements.append(table)
    else:
        elements.append(Paragraph("No decisions found.", styles["Normal"]))

    elements.append(Spacer(1, 20))
    elements.append(Paragraph("Action Items", styles["Heading2"]))
    if action_items:
        data = [["Owner", "Task", "Due", "Conf.", "Source Span"]]
        for action_item in action_items:
            data.append([
                action_item.owner,
                action_item.task,
                action_item.due_date or "-",
                f"{round(action_item.confidence * 100)}%" if action_item.confidence is not None else "-",
                action_item.source_span or "-",
            ])
        table = Table(data, colWidths=[80, 220, 70, 50, 100])
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4f46e5")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f5f5ff")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
            ("PADDING", (0, 0), (-1, -1), 8),
        ]))
        elements.append(table)
    else:
        elements.append(Paragraph("No action items found.", styles["Normal"]))

    doc.build(elements)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={meeting.title}-export.pdf"},
    )
