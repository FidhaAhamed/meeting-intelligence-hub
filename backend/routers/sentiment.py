from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Meeting
from groq import Groq
import os, json
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

router = APIRouter(prefix="/sentiment", tags=["sentiment"])
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

def build_prompt(transcript: str) -> str:
    return f"""Analyse the sentiment and tone of this meeting transcript.

Return ONLY a valid JSON object with this exact structure, nothing else:
{{
  "overall_score": <number from -1.0 (very negative) to 1.0 (very positive)>,
  "overall_label": "<Positive|Neutral|Negative>",
  "summary": "<2 sentence summary of the meeting tone>",
  "speakers": [
    {{
      "name": "<speaker name>",
      "sentiment_score": <number from -1.0 to 1.0>,
      "sentiment_label": "<Positive|Neutral|Negative>",
      "tone_tags": ["<tag1>", "<tag2>"],
      "key_quote": "<most representative quote from this speaker>"
    }}
  ],
  "segments": [
    {{
      "text": "<first 80 chars of this segment>",
      "sentiment": "<Positive|Neutral|Negative>",
      "score": <number from -1.0 to 1.0>
    }}
  ]
}}

Tone tags examples: Enthusiastic, Concerned, Agreeable, Frustrated, Decisive, Uncertain, Collaborative

TRANSCRIPT:
{transcript}"""

@router.post("/{meeting_id}")
def analyse_sentiment(meeting_id: int, db: Session = Depends(get_db)):
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
            {
                "role": "system",
                "content": "You are an expert meeting analyst. Always respond with valid JSON only."
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
    return data

@router.get("/{meeting_id}/cached")
def get_cached_sentiment(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    return {"cached": False}