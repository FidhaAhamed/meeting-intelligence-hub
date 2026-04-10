# Meeting Intelligence Hub - Approach Document

## 1) Problem Framing
Teams generate long meeting transcripts, but key outcomes are hard to retrieve quickly. The solution goal was to reduce this "double work" by turning transcripts into structured, searchable, and explainable insights.

Core outcomes targeted:
- Fast transcript ingestion and organization
- Automatic extraction of decisions and action items
- Natural-language Q and A across meetings with evidence
- Sentiment and tone visibility for faster management decisions

## 2) Solution Overview
The product is an end-to-end AI meeting intelligence workflow:
1. Upload one or many transcript files (.txt, .vtt)
2. Auto-derive metadata (meeting type/date, word count, speakers)
3. Extract decisions and action items into structured tables
4. Query meeting content through retrieval-augmented generation (RAG)
5. Analyze sentiment overall, by speaker, and by conversation segments
6. Export extracted outcomes as CSV and PDF

This design optimizes both speed (quick summaries) and traceability (source-linked answers and evidence).

## 3) Architecture and Design
### Frontend
- React + Vite single-page app
- Route-driven UX for Dashboard, Meeting Detail, Ask AI, and Analytics
- Componentized layout for upload, extraction tables, chat, summary, and sentiment dashboards
- Axios-based API layer for clean separation between UI and backend

### Backend
- FastAPI service with modular routers:
  - meetings: upload, list, search, metadata, dashboard stats
  - extract: decisions/action items extraction, summary, CSV/PDF export
  - rag: indexing, status, semantic query with citations
  - sentiment: overall, speaker-level, and segment-level tone analysis
- SQLAlchemy ORM for persistence
- Transcript chunks and embeddings stored for retrieval

### Data Model (high level)
- Meeting: transcript metadata and aggregate sentiment fields
- Decision and ActionItem: structured extraction outputs
- RAGChunk: indexed transcript chunks with line ranges, speaker hints, optional timestamps, and embedding payload

## 4) Minimum Feature Coverage Mapping
### Feature 1: Multi-Transcript Ingestion Portal
Implemented:
- Multi-file drag and drop upload
- File type validation for .txt and .vtt
- Stored transcripts with metadata and grouping context via project_name
- Post-upload summaries on dashboard cards: filename type, speaker count, word count, meeting date/type

### Feature 2: Decision and Action Item Extractor
Implemented:
- LLM-based structured extraction with confidence and evidence
- Clear UI separation for Decisions vs Action Items
- Required action item fields: owner, task, due date
- Export to CSV and PDF

### Feature 3: Contextual Query Engine (Chatbot)
Implemented:
- Meeting-scoped and workspace-wide querying
- RAG retrieval over indexed chunks
- Source citations in answers (meeting title, line range, speaker/timestamp context)
- Supports cross-meeting questions when querying globally

### Feature 4: Speaker Sentiment and Tone Analysis
Implemented:
- Overall meeting sentiment score + label + summary
- Per-speaker sentiment scores and tone tags
- Segment-level timeline with click-to-view source text
- Color-coded indicators for positive/neutral/negative segments

### Minimum End-to-End Expectations
Implemented:
- Dashboard home with uploaded meetings and stats
- Upload interface with progress and validation feedback
- Meeting detail view with extraction, sentiment, and Ask AI tabs
- Chat-like Q and A interface with grounded responses and citations

## 5) Tech Stack Choices and Rationale
### React + Vite
Chosen for fast developer iteration, modular UI, and good maintainability for a feature-heavy SPA.

### FastAPI + SQLAlchemy
Chosen for clear API contracts, strong Python ecosystem integration, and straightforward model-based persistence.

### Groq LLM API
Chosen to power extraction, summary, sentiment interpretation, and answer generation with low-latency inference.

### Sentence-Transformers Embeddings
Chosen to improve retrieval relevance for semantic questions that lexical match alone cannot answer.

### Supabase/PostgreSQL
Chosen for managed relational storage, reliable local-to-cloud workflow, and easy SQLAlchemy integration.

### ReportLab for PDF Export
Chosen for deterministic server-side PDF generation with custom table formatting.

## 6) Key Engineering Tradeoffs
- Embeddings are generated asynchronously after indexing to keep indexing responsive.
- Retrieval combines lexical and embedding similarity for better robustness when embeddings are unavailable or pending.
- Sentiment segmentation is deterministic and transcript-driven; this improves reproducibility of segment references.

## 7) Additional Enhancements Implemented
- Dashboard stats endpoint to avoid expensive client-side fan-out calls
- Improved dashboard UX with an added projects stat card
- Search endpoint for meetings by title, project, and meeting type
- Meeting metadata inference from transcript/file naming patterns
- Re-index support and index status tracking in Ask AI flow

## 8) What I Would Improve With More Time
1. Reliability and safeguards
- Add strict schema validation and retry strategy for model JSON responses
- Add fuller API and UI test coverage (unit + integration + E2E)

2. Retrieval quality
- Better chunking strategy for long meetings and topic boundaries
- Re-ranking layer for higher citation precision

3. Sentiment depth
- True time-window analysis for timestamped transcripts
- Trend and anomaly summaries across multiple meetings/projects

4. Product and ops readiness
- Authentication and project-level access control
- Background job queue for heavy AI tasks
- Observability dashboard for API latency, failures, and model costs
