import json
import os
import re

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException
from groq import Groq
from sqlalchemy.orm import Session

from database import get_db
from models import Meeting


load_dotenv()

router = APIRouter(prefix="/sentiment", tags=["sentiment"])
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

TIMESTAMP_RE = re.compile(
    r"(?P<start>\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(?P<end>\d{2}:\d{2}:\d{2}\.\d{3})"
)
SPEAKER_RE = re.compile(r"^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*(?:\s*\([^)]+\))?)\s*:")


def extract_speaker(text: str) -> str | None:
    match = SPEAKER_RE.match(text.strip())
    return match.group(1) if match else None


def parse_plaintext_segments(content: str) -> list[dict]:
    segments = []
    for line_number, raw_line in enumerate(content.splitlines(), start=1):
        text = raw_line.strip()
        if not text:
            continue
        segments.append(
            {
                "text": text,
                "line_start": line_number,
                "line_end": line_number,
                "timestamp_start": None,
                "timestamp_end": None,
                "speaker_name": extract_speaker(text),
            }
        )
    return segments


def parse_vtt_segments(content: str) -> list[dict]:
    normalized = content.replace("\r\n", "\n")
    blocks = re.split(r"\n\s*\n", normalized)
    segments = []
    current_line = 1

    for block in blocks:
        block_lines = [line.rstrip("\n") for line in block.split("\n")]
        block_line_count = len(block_lines)
        stripped_lines = [line.strip() for line in block_lines if line.strip()]

        if not stripped_lines or stripped_lines[0].upper() == "WEBVTT":
            current_line += block_line_count + 1
            continue

        timestamp_index = None
        timestamp_match = None
        for idx, line in enumerate(stripped_lines):
            match = TIMESTAMP_RE.match(line)
            if match:
                timestamp_index = idx
                timestamp_match = match
                break

        if timestamp_index is None or timestamp_match is None:
            current_line += block_line_count + 1
            continue

        text_lines = stripped_lines[timestamp_index + 1 :]
        text = " ".join(text_lines).strip()
        if not text:
            current_line += block_line_count + 1
            continue

        line_start = current_line + timestamp_index + 1
        line_end = line_start + max(len(text_lines) - 1, 0)
        segments.append(
            {
                "text": text,
                "line_start": line_start,
                "line_end": line_end,
                "timestamp_start": timestamp_match.group("start"),
                "timestamp_end": timestamp_match.group("end"),
                "speaker_name": extract_speaker(text),
            }
        )
        current_line += block_line_count + 1

    return segments


def parse_transcript_segments(file_name: str, content: str) -> list[dict]:
    if file_name.lower().endswith(".vtt"):
        segments = parse_vtt_segments(content)
        if segments:
            return segments
    return parse_plaintext_segments(content)


def build_sentiment_segments(segments: list[dict], max_words: int = 120, overlap_segments: int = 1) -> list[dict]:
    chunked = []
    current_segments: list[dict] = []
    current_words = 0

    def flush_chunk() -> None:
        nonlocal current_segments, current_words
        if not current_segments:
            return

        speaker_names = [segment["speaker_name"] for segment in current_segments if segment["speaker_name"]]
        unique_speakers = list(dict.fromkeys(speaker_names))
        chunked.append(
            {
                "id": len(chunked) + 1,
                "text": "\n".join(segment["text"] for segment in current_segments).strip(),
                "line_start": current_segments[0]["line_start"],
                "line_end": current_segments[-1]["line_end"],
                "timestamp_start": current_segments[0]["timestamp_start"],
                "timestamp_end": current_segments[-1]["timestamp_end"],
                "speaker_hint": ", ".join(unique_speakers) if unique_speakers else None,
            }
        )

        carry = current_segments[-overlap_segments:] if overlap_segments > 0 else []
        current_segments = carry.copy()
        current_words = sum(len(segment["text"].split()) for segment in current_segments)

    for segment in segments:
        segment_words = len(segment["text"].split())
        if current_segments and current_words + segment_words > max_words:
            flush_chunk()

        current_segments.append(segment)
        current_words += segment_words

    flush_chunk()
    return chunked


def build_prompt(transcript: str, deterministic_segments: list[dict]) -> str:
    segment_payload = [
        {
            "id": segment["id"],
            "line_start": segment["line_start"],
            "line_end": segment["line_end"],
            "timestamp_start": segment["timestamp_start"],
            "timestamp_end": segment["timestamp_end"],
            "speaker_hint": segment["speaker_hint"],
            "text": segment["text"],
        }
        for segment in deterministic_segments
    ]

    return f"""Analyse the sentiment and tone of this meeting transcript.

The transcript has already been deterministically segmented by the application. Do NOT invent or merge segments.
Use the provided segments exactly as given and return one analysis object for each segment id.

Return ONLY a valid JSON object with this exact structure:
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
      "id": <segment id from input>,
      "sentiment": "<Positive|Neutral|Negative>",
      "score": <number from -1.0 to 1.0>
    }}
  ]
}}

Tone tags examples: Enthusiastic, Concerned, Agreeable, Frustrated, Decisive, Uncertain, Collaborative

TRANSCRIPT:
{transcript}

DETERMINISTIC SEGMENTS:
{json.dumps(segment_payload, ensure_ascii=True)}"""


@router.post("/{meeting_id}")
def analyse_sentiment(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    try:
        with open(meeting.file_path, "r", encoding="utf-8") as handle:
            transcript = handle.read()
    except FileNotFoundError:
        raise HTTPException(400, "Transcript file not found")

    transcript_segments = parse_transcript_segments(meeting.file_name, transcript)
    deterministic_segments = build_sentiment_segments(transcript_segments)
    if not deterministic_segments:
        raise HTTPException(400, "Transcript is empty")

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": "You are an expert meeting analyst. Always respond with valid JSON only.",
            },
            {
                "role": "user",
                "content": build_prompt(transcript, deterministic_segments),
            },
        ],
        temperature=0.1,
        max_tokens=2200,
    )

    raw = response.choices[0].message.content.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    data = json.loads(raw)

    returned_segments = {segment.get("id"): segment for segment in data.get("segments", [])}
    merged_segments = []
    for segment in deterministic_segments:
        analysis = returned_segments.get(segment["id"], {})
        merged_segments.append(
            {
                "id": segment["id"],
                "text": segment["text"],
                "sentiment": analysis.get("sentiment", "Neutral"),
                "score": analysis.get("score", 0.0),
                "line_start": segment["line_start"],
                "line_end": segment["line_end"],
                "timestamp_start": segment["timestamp_start"],
                "timestamp_end": segment["timestamp_end"],
                "speaker_hint": segment["speaker_hint"],
            }
        )

    data["segments"] = merged_segments
    meeting.sentiment_overall_score = data.get("overall_score")
    meeting.sentiment_overall_label = data.get("overall_label")
    db.commit()
    return data


@router.get("/{meeting_id}/cached")
def get_cached_sentiment(meeting_id: int, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    return {"cached": False}
