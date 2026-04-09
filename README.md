# Meeting Intelligence Hub

An AI-powered meeting analysis platform that transforms raw transcripts into structured insights — decisions, action items, sentiment analysis, and a smart chatbot — all powered by Groq AI and a RAG pipeline.

---

## Features

- **Upload transcripts** — drag and drop `.txt` or `.vtt` files
- **AI extraction** — automatically pulls out decisions and action items with confidence scores
- **RAG chatbot** — ask questions across your transcripts using vector similarity search
- **Sentiment analysis** — per-speaker tone breakdown and conversation timeline
- **Meeting summary** — auto-generated TL;DR with key topics and meeting type
- **Export** — download decisions and action items as CSV or PDF

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite + TailwindCSS |
| Backend | FastAPI (Python) |
| Database | PostgreSQL via Supabase + pgvector |
| AI / LLM | Groq API (LLaMA 3.3 70B) |
| Embeddings | sentence-transformers (all-MiniLM-L6-v2) |
| PDF Export | ReportLab |

---

## Prerequisites

Make sure you have these installed before starting:

- [Node.js](https://nodejs.org/) v18 or above
- [Python](https://www.python.org/) 3.9 or above
- A free [Supabase](https://supabase.com) account
- A free [Groq](https://console.groq.com) API key

---

## Project Structure

```
meeting-intelligence-hub/
├── frontend/                  # React app
│   ├── src/
│   │   ├── api/
│   │   │   └── meetings.js    # All API calls
│   │   ├── components/
│   │   │   ├── ChatPanel.jsx
│   │   │   ├── ExtractionPanel.jsx
│   │   │   ├── SentimentDashboard.jsx
│   │   │   ├── SummaryCard.jsx
│   │   │   └── UploadZone.jsx
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   └── MeetingDetail.jsx
│   │   └── App.jsx
│   └── package.json
│
├── backend/                   # FastAPI app
│   ├── routers/
│   │   ├── meetings.py        # Upload + fetch meetings
│   │   ├── extract.py         # AI extraction + export
│   │   ├── chat.py            # Basic chatbot
│   │   ├── rag.py             # RAG pipeline
│   │   └── sentiment.py       # Sentiment analysis
│   ├── services/
│   │   └── embedder.py        # Chunking + embedding logic
│   ├── database.py
│   ├── models.py
│   ├── main.py
│   ├── .env                   # Your secrets (never commit this)
│   └── requirements.txt
│
└── README.md
```

---

## Setup Guide

### Step 1 — Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/meeting-intelligence-hub.git
cd meeting-intelligence-hub
```

---

### Step 2 — Set up Supabase database

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project**, name it `meeting-hub`, set a strong password
3. Wait ~2 minutes for provisioning
4. Go to **Settings → Database → Connection String → URI tab**
5. Copy the connection string — it looks like:
   ```
   postgresql://postgres:YOUR_PASSWORD@db.xxxxxxxxxxxx.supabase.co:5432/postgres
   ```
6. Go to **SQL Editor** and run this to enable vector search:
   ```sql
   create extension if not exists vector;
   ```

---

### Step 3 — Get your Groq API key

1. Go to [console.groq.com](https://console.groq.com) and sign up free (no card needed)
2. Click **API Keys → Create API Key**
3. Copy the key — it starts with `gsk_`

---

### Step 4 — Set up the backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv

# On Windows:
venv\Scripts\activate

# On Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

If `requirements.txt` is missing, install manually:

```bash
pip install fastapi uvicorn sqlalchemy psycopg2-binary python-dotenv \
            groq sentence-transformers pgvector python-multipart \
            aiofiles reportlab
pip freeze > requirements.txt
```

---

### Step 5 — Configure environment variables

Create a `.env` file inside the `backend/` folder:

```bash
# backend/.env

DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.xxxxxxxxxxxx.supabase.co:5432/postgres
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxxxxxx
```

Replace the values with your actual Supabase connection string and Groq API key.

> Never commit your `.env` file. Make sure `.env` is in your `.gitignore`.

---

### Step 6 — Run the backend

```bash
# Make sure you are inside the backend/ folder with venv activated
uvicorn main:app --reload
```

You should see:

```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

Open [http://localhost:8000/docs](http://localhost:8000/docs) to see the auto-generated API documentation.

> The first time you run the backend, SQLAlchemy will automatically create all database tables in Supabase.

---

### Step 7 — Set up the frontend

Open a new terminal window:

```bash
cd frontend

# Install dependencies
npm install

# Start the development server
npm run dev
```

You should see:

```
  VITE v5.x.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Using the App

### Upload a transcript

1. Click **Upload Transcript** on the dashboard
2. Drag and drop a `.txt` or `.vtt` file
3. The meeting card appears once uploaded

### Sample transcript to test with

Create a file called `product-meeting.txt` with this content:

```
Sarah (PM): Good morning everyone. Let's align on the API launch.
John (Engineering): Testing needs two more weeks minimum.
Sarah (PM): Okay, we're delaying the API launch to April 20th. Everyone agreed?
All: Agreed.
Sarah (PM): John, complete all testing by April 15th please.
John (Engineering): Done, I'll have it ready.
Sarah (PM): Maya, update the docs by April 17th.
Maya (Design): Sure, will do.
Sarah (PM): We're also going with the freemium pricing model — final decision.
John (Engineering): I'll implement rate limiting for the free tier by April 18th.
```

### Extract decisions and action items

1. Click a meeting card
2. Go to the **Decisions & Actions** tab
3. Click **Extract Decisions & Action Items**
4. View results with confidence scores and export as CSV or PDF

### Use the AI chatbot (RAG)

1. Click a meeting card
2. Go to the **Ask AI** tab
3. Click **Index transcript** — this chunks and embeds the transcript
4. Ask questions like:
   - "What decisions were made?"
   - "Who is responsible for testing?"
   - "What is the launch date?"

### Run sentiment analysis

1. Click a meeting card
2. Go to the **Sentiment** tab
3. Click **Run Sentiment Analysis**
4. View per-speaker tone, overall score, and colour-coded timeline

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/meetings/` | List all meetings |
| `POST` | `/meetings/upload` | Upload transcript files |
| `POST` | `/extract/{id}` | Extract decisions and action items |
| `GET` | `/extract/{id}` | Get cached extractions |
| `POST` | `/extract/summary/{id}` | Generate meeting TL;DR |
| `GET` | `/extract/export/{id}/csv` | Download as CSV |
| `GET` | `/extract/export/{id}/pdf` | Download as PDF |
| `POST` | `/rag/index/{id}` | Chunk and embed transcript |
| `POST` | `/rag/query` | Ask a question via RAG |
| `GET` | `/rag/status/{id}` | Check if transcript is indexed |
| `POST` | `/sentiment/{id}` | Run sentiment analysis |
| `POST` | `/chat/` | Basic chatbot query |

---

## Common Errors

**`ModuleNotFoundError: No module named 'groq'`**
Your virtual environment is not activated. Run `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Mac/Linux) before starting the server.

**`Error loading ASGI app. Attribute "app" not found`**
Make sure you are running `uvicorn main:app --reload` from inside the `backend/` folder, not the root.

**`SSL connection error` on Supabase**
Make sure `connect_args={"sslmode": "require"}` is set in `database.py`.

**`sentence_transformers` takes long on first run**
The embedding model (`all-MiniLM-L6-v2`, ~80MB) downloads automatically on first use. This is a one-time download.

---

## Environment Variables Reference

| Variable | Description | Where to get it |
|---|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string | Supabase → Settings → Database |
| `GROQ_API_KEY` | Groq API key for LLM calls | console.groq.com |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT License — feel free to use this project for learning and portfolio purposes.