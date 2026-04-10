from collections import Counter
from functools import lru_cache
from math import log, sqrt
from typing import Optional
from threading import Lock
import json
import os
import re

from dotenv import load_dotenv
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from groq import Groq
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import SessionLocal, get_db
from models import Meeting, RAGChunk


load_dotenv()

router = APIRouter(prefix="/rag", tags=["rag"])
client = Groq(api_key=os.getenv("GROQ_API_KEY"))
ACTIVE_EMBEDDING_JOBS: set[int] = set()
ACTIVE_EMBEDDING_LOCK = Lock()

WORD_RE = re.compile(r"[a-z0-9']+")
SPEAKER_RE = re.compile(r"^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+)*(?:\s*\([^)]+\))?)\s*:")
TIMESTAMP_RE = re.compile(
    r"(?P<start>\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(?P<end>\d{2}:\d{2}:\d{2}\.\d{3})"
)
EMBEDDING_MODEL_NAME = "all-MiniLM-L6-v2"


class RagQueryRequest(BaseModel):
    question: str = Field(min_length=3)
    meeting_id: Optional[int] = None
    top_k: int = Field(default=5, ge=1, le=10)


def tokenize(text: str) -> list[str]:
    return WORD_RE.findall(text.lower())


def cosine_similarity(query_terms: Counter, chunk_terms: Counter, idf: dict[str, float]) -> float:
    numerator = 0.0
    query_norm = 0.0
    chunk_norm = 0.0

    for term, query_tf in query_terms.items():
        weight = idf.get(term, 0.0)
        q_weight = query_tf * weight
        c_weight = chunk_terms.get(term, 0) * weight
        numerator += q_weight * c_weight
        query_norm += q_weight * q_weight

    for term, chunk_tf in chunk_terms.items():
        weight = idf.get(term, 0.0)
        c_weight = chunk_tf * weight
        chunk_norm += c_weight * c_weight

    if query_norm == 0.0 or chunk_norm == 0.0:
        return 0.0

    return numerator / (sqrt(query_norm) * sqrt(chunk_norm))


def vector_cosine_similarity(query_vector: list[float], chunk_vector: list[float]) -> float:
    if not query_vector or not chunk_vector or len(query_vector) != len(chunk_vector):
        return 0.0

    numerator = sum(q * c for q, c in zip(query_vector, chunk_vector))
    query_norm = sqrt(sum(q * q for q in query_vector))
    chunk_norm = sqrt(sum(c * c for c in chunk_vector))
    if query_norm == 0.0 or chunk_norm == 0.0:
        return 0.0

    return numerator / (query_norm * chunk_norm)


@lru_cache(maxsize=1)
def get_embedding_backend():
    try:
        from sentence_transformers import SentenceTransformer
    except Exception:
        return None, "sentence-transformers is not installed"

    try:
        return SentenceTransformer(EMBEDDING_MODEL_NAME), None
    except Exception as exc:
        return None, str(exc)


def embed_texts(texts: list[str]) -> tuple[list[list[float]] | None, str | None]:
    model, error = get_embedding_backend()
    if model is None:
        return None, error

    try:
        vectors = model.encode(texts, normalize_embeddings=True)
        return [list(map(float, vector)) for vector in vectors], None
    except Exception as exc:
        return None, str(exc)


def parse_embedding(chunk: RAGChunk) -> list[float] | None:
    if not chunk.embedding_json:
        return None

    try:
        vector = json.loads(chunk.embedding_json)
    except (TypeError, json.JSONDecodeError):
        return None

    if not isinstance(vector, list):
        return None

    try:
        return [float(value) for value in vector]
    except (TypeError, ValueError):
        return None


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
                "speaker_name": extract_speaker(text),
                "timestamp_start": None,
                "timestamp_end": None,
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
                "speaker_name": extract_speaker(text),
                "timestamp_start": timestamp_match.group("start"),
                "timestamp_end": timestamp_match.group("end"),
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


def build_chunks(segments: list[dict], max_words: int = 140, overlap_segments: int = 1) -> list[dict]:
    chunks = []
    current_segments: list[dict] = []
    current_words = 0

    def flush_chunk() -> None:
        nonlocal current_segments, current_words
        if not current_segments:
            return

        content = "\n".join(segment["text"] for segment in current_segments).strip()
        speaker_names = [segment["speaker_name"] for segment in current_segments if segment["speaker_name"]]
        unique_speakers = list(dict.fromkeys(speaker_names))
        chunks.append(
            {
                "chunk_index": len(chunks),
                "content": content,
                "line_start": current_segments[0]["line_start"],
                "line_end": current_segments[-1]["line_end"],
                "speaker_name": unique_speakers[0] if len(unique_speakers) == 1 else None,
                "speaker_hint": ", ".join(unique_speakers) if unique_speakers else None,
                "timestamp_start": current_segments[0]["timestamp_start"],
                "timestamp_end": current_segments[-1]["timestamp_end"],
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
    return chunks


def get_indexed_chunks(db: Session, meeting_id: Optional[int]) -> list[RAGChunk]:
    query = db.query(RAGChunk).join(Meeting)
    if meeting_id is not None:
        query = query.filter(RAGChunk.meeting_id == meeting_id)
    return query.order_by(RAGChunk.meeting_id.asc(), RAGChunk.chunk_index.asc()).all()


def ensure_meeting(db: Session, meeting_id: int) -> Meeting:
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    return meeting


def build_citation(meeting_title: str, chunk: RAGChunk) -> str:
    parts = [meeting_title]
    if chunk.timestamp_start and chunk.timestamp_end:
        parts.append(f"{chunk.timestamp_start}-{chunk.timestamp_end}")
    parts.append(f"lines {chunk.line_start}-{chunk.line_end}")
    if chunk.speaker_name:
        parts.append(chunk.speaker_name)
    elif chunk.speaker_hint:
        parts.append(chunk.speaker_hint)
    return " | ".join(parts)


def set_embedding_job(meeting_id: int, active: bool) -> None:
    with ACTIVE_EMBEDDING_LOCK:
        if active:
            ACTIVE_EMBEDDING_JOBS.add(meeting_id)
        else:
            ACTIVE_EMBEDDING_JOBS.discard(meeting_id)


def is_embedding_job_active(meeting_id: int) -> bool:
    with ACTIVE_EMBEDDING_LOCK:
        return meeting_id in ACTIVE_EMBEDDING_JOBS


def generate_embeddings_for_meeting(meeting_id: int) -> None:
    set_embedding_job(meeting_id, True)
    db = SessionLocal()
    try:
        chunks = (
            db.query(RAGChunk)
            .filter(RAGChunk.meeting_id == meeting_id)
            .order_by(RAGChunk.chunk_index.asc())
            .all()
        )
        if not chunks:
            return

        embeddings, _ = embed_texts([chunk.content for chunk in chunks])
        if not embeddings:
            return

        for index, chunk in enumerate(chunks):
            chunk.embedding_json = json.dumps(embeddings[index])
            chunk.embedding_model = EMBEDDING_MODEL_NAME
        db.commit()
    finally:
        db.close()
        set_embedding_job(meeting_id, False)


@router.post("/index/{meeting_id}")
def index_meeting(meeting_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    meeting = ensure_meeting(db, meeting_id)

    try:
        with open(meeting.file_path, "r", encoding="utf-8") as file:
            transcript = file.read()
    except FileNotFoundError:
        raise HTTPException(400, "Transcript file not found on disk")

    segments = parse_transcript_segments(meeting.file_name, transcript)
    chunks = build_chunks(segments)
    if not chunks:
        raise HTTPException(400, "Transcript is empty and cannot be indexed")

    db.query(RAGChunk).filter(RAGChunk.meeting_id == meeting_id).delete()
    for chunk in chunks:
        db.add(
            RAGChunk(
                meeting_id=meeting_id,
                **chunk,
            )
        )
    db.commit()
    background_tasks.add_task(generate_embeddings_for_meeting, meeting_id)

    return {
        "meeting_id": meeting_id,
        "meeting_title": meeting.title,
        "indexed": True,
        "chunks_created": len(chunks),
        "embedding_enabled": False,
        "embedding_pending": True,
        "embedding_model": EMBEDDING_MODEL_NAME,
        "timestamps_detected": any(chunk["timestamp_start"] for chunk in chunks),
    }


@router.get("/status/{meeting_id}")
def get_index_status(meeting_id: int, db: Session = Depends(get_db)):
    meeting = ensure_meeting(db, meeting_id)
    chunk_query = db.query(RAGChunk).filter(RAGChunk.meeting_id == meeting_id)
    chunk_count = chunk_query.count()
    embedded_chunk_count = chunk_query.filter(RAGChunk.embedding_json.isnot(None)).count()
    timestamped_chunk_count = chunk_query.filter(RAGChunk.timestamp_start.isnot(None)).count()
    return {
        "meeting_id": meeting_id,
        "meeting_title": meeting.title,
        "indexed": chunk_count > 0,
        "chunk_count": chunk_count,
        "embedded_chunk_count": embedded_chunk_count,
        "embedding_enabled": embedded_chunk_count > 0,
        "embedding_pending": is_embedding_job_active(meeting_id),
        "timestamped_chunk_count": timestamped_chunk_count,
    }


@router.post("/query")
def rag_query(request: RagQueryRequest, db: Session = Depends(get_db)):
    chunks = get_indexed_chunks(db, request.meeting_id)
    if not chunks:
        scope = "meeting" if request.meeting_id is not None else "workspace"
        raise HTTPException(404, f"No indexed transcripts found for this {scope}")

    query_terms = Counter(tokenize(request.question))
    if not query_terms:
        raise HTTPException(400, "Question must contain searchable text")

    doc_freq = Counter()
    chunk_term_counters: dict[int, Counter] = {}
    for chunk in chunks:
        term_counter = Counter(tokenize(chunk.content))
        chunk_term_counters[chunk.id] = term_counter
        doc_freq.update(set(term_counter))

    total_docs = len(chunks)
    idf = {term: log((1 + total_docs) / (1 + freq)) + 1 for term, freq in doc_freq.items()}

    embedded_chunks_available = any(chunk.embedding_json for chunk in chunks)
    query_embedding = None
    embedding_error = None
    if embedded_chunks_available:
        query_embeddings, embedding_error = embed_texts([request.question])
        if query_embeddings:
            query_embedding = query_embeddings[0]

    ranked = []
    for chunk in chunks:
        lexical_score = cosine_similarity(query_terms, chunk_term_counters[chunk.id], idf)
        embedding_score = 0.0

        chunk_embedding = parse_embedding(chunk)
        if query_embedding and chunk_embedding:
            embedding_score = vector_cosine_similarity(query_embedding, chunk_embedding)

        combined_score = (embedding_score * 0.8) + (lexical_score * 0.2) if query_embedding and chunk_embedding else lexical_score
        if combined_score <= 0:
            continue

        ranked.append((combined_score, lexical_score, embedding_score, chunk))

    ranked.sort(key=lambda item: item[0], reverse=True)
    top_matches = ranked[: request.top_k]
    if not top_matches:
        raise HTTPException(404, "No relevant indexed transcript passages found")

    context_sections = []
    sources = []
    for combined_score, lexical_score, embedding_score, chunk in top_matches:
        meeting = chunk.meeting
        citation = build_citation(meeting.title, chunk)
        context_sections.append(f"[{citation}]\n{chunk.content}")
        sources.append(
            {
                "meeting_id": meeting.id,
                "meeting_title": meeting.title,
                "chunk_id": chunk.id,
                "line_start": chunk.line_start,
                "line_end": chunk.line_end,
                "speaker_name": chunk.speaker_name,
                "speaker_hint": chunk.speaker_hint,
                "timestamp_start": chunk.timestamp_start,
                "timestamp_end": chunk.timestamp_end,
                "citation": citation,
                "similarity_score": round(combined_score, 4),
                "lexical_score": round(lexical_score, 4),
                "embedding_score": round(embedding_score, 4),
                "snippet": chunk.content[:240],
            }
        )

    prompt = "\n\n".join(context_sections)
    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {
                "role": "system",
                "content": (
                    "You answer questions using only the provided meeting transcript excerpts. "
                    "Cite supporting evidence with the exact citation string already attached to each excerpt. "
                    "If the answer is not supported by the excerpts, say that clearly."
                ),
            },
            {
                "role": "user",
                "content": f"Question: {request.question}\n\nRetrieved transcript excerpts:\n{prompt}",
            },
        ],
        temperature=0.1,
        max_tokens=700,
    )

    return {
        "answer": response.choices[0].message.content.strip(),
        "sources": sources,
        "chunks_used": len(top_matches),
        "indexed_meetings": len({chunk.meeting_id for _, _, _, chunk in top_matches}),
        "embedding_enabled": query_embedding is not None,
        "embedding_error": embedding_error,
    }
