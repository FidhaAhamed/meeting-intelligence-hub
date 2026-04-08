# Meeting Intelligence Hub

## Overview
An AI-powered platform that transforms meeting transcripts into actionable intelligence by automatically extracting decisions, action items, analyzing sentiment, and providing a conversational chatbot interface.

## Key Features
1. **Multi-Transcript Ingestion** - Upload .txt and .vtt files
2. **Decision & Action Item Extraction** - Auto-parse key decisions and tasks
3. **Contextual Chatbot** - Ask cross-meeting questions with citations
4. **Sentiment Analysis** - Visual dashboard showing meeting tone and emotions

## Tech Stack
- **Frontend:** React 19, Vite, Tailwind CSS, Axios
- **Backend:** FastAPI (Python), SQLAlchemy ORM
- **AI/LLM:** Anthropic Claude API & Groq
- **Database:** PostgreSQL (configure via connection string)

## Quick Start

### Prerequisites
- Python 3.9+
- Node.js 18+
- PostgreSQL running locally or remote

### Installation & Setup

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```
#### Frontend
```bash
cd frontend
npm install
```
#### Environment Configuration
Create .env file in the backend/ directory:

```bash
DATABASE_URL=postgresql://user:password@localhost/meeting_hub
GROQ_API_KEY=your_groq_api_key
```
#### Running the Application
Terminal 1 - Backend:

```bash
cd backend
uvicorn main:app --reload --port 8000
```
Terminal 2 - Frontend:

```bash
cd frontend
npm run dev
```
Visit: http://localhost:5173

#### Project Structure
```bash
meeting-intelligence-hub/
├── backend/
│   ├── main.py              # FastAPI app entry
│   ├── models.py            # SQLAlchemy models
│   ├── database.py          # DB connection
│   ├── requirements.txt
│   └── routers/
│       ├── meetings.py      # Meeting CRUD
│       ├── extract.py       # AI extraction logic
│       ├── chat.py          # Chatbot endpoint
│       └── sentiment.py     # Sentiment analysis
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── components/
    │   │   ├── UploadPortal.jsx
    │   │   ├── MeetingDetail.jsx
    │   │   ├── ChatPanel.jsx
    │   │   └── SentimentDashboard.jsx
    │   └── pages/
    │       ├── Dashboard.jsx
    │       └── MeetingDetail.jsx
    └── package.json
```

### API Endpoints
Meetings
POST /api/meetings/upload - Upload transcript(s)
GET /api/meetings - List all meetings
GET /api/meetings/{id} - Get meeting details
DELETE /api/meetings/{id} - Delete meeting
Extraction
GET /api/extract/{meeting_id}/decisions - Get decisions
GET /api/extract/{meeting_id}/action-items - Get action items
POST /api/extract/{meeting_id}/process - Trigger extraction
Chat
POST /api/chat/query - Ask questions across meetings with context
Sentiment
GET /api/sentiment/{meeting_id} - Get sentiment breakdown
