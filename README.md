# AI Research Assistant

A modern, full-stack application for researchers, students, and engineers to **discover**, **organize**, **read**, **summarize**, and **query** academic papers — all from a single local interface.

---

## Features

| Feature | Description |
| :--- | :--- |
| 🔍 **Paper Search** | Search 250M+ papers via OpenAlex and arXiv — no paid API keys needed |
| 📚 **Personal Library** | Save papers to a persistent local SQLite database; survives restarts |
| 📄 **PDF Upload** | Upload local PDF research papers; metadata (title, authors, year, abstract) is auto-extracted |
| 👁️ **PDF Viewer** | Preview uploaded PDFs directly in the browser via the backend's secure `/api/pdf/view/{id}` endpoint |
| 🤖 **AI Summarization** | Generate structured summaries (Key Takeaways, Methodology, Findings, Limitations) grounded in the paper's full text or abstract |
| 💬 **Interactive Q&A** | Ask natural-language questions about any saved paper; answers are strictly grounded in the paper content with anti-hallucination guardrails |
| 🌗 **Light / Dark Theme** | Toggleable theme with system-friendly light mode as the default |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend  (React + Vite)                    │
│                                                                 │
│  SearchPanel  │  LibraryPanel  │  PaperCard  │  PDFUploadModal  │
│  SummaryModal │  QAModal       │  PDFViewerModal                │
└──────────────────────────┬──────────────────────────────────────┘
                           │  HTTP / REST (JSON)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend  (FastAPI)                         │
│                                                                 │
│  Routers                                                        │
│    /api/search   → search_service  (OpenAlex + arXiv)          │
│    /api/papers   → paper_service   (CRUD, library)             │
│    /api/pdf      → pdf_service     (upload, view, extract)     │
│    /api/ai       → llm_service     (summarize, Q&A)            │
│                                                                 │
│  Data Layer: SQLAlchemy ORM + SQLite  (data/assistant.db)      │
│  PDF Storage:  data/pdfs/                                       │
└─────────────────────────────────────────────────────────────────┘
```

For full design decisions and API contracts, see [`docs/architecture.md`](docs/architecture.md).

---

## Project Structure

```
ai4se/
├── .env.example                 # Environment variable template
├── .gitignore
├── README.md                    # This file
├── AGENT_LOG.md                 # Development trajectory & engineering log
├── docs/
│   └── architecture.md          # System specification & architecture
├── data/                        # Auto-created at runtime
│   ├── assistant.db             # SQLite database
│   └── pdfs/                   # Uploaded PDF files
├── backend/
│   ├── requirements.txt
│   └── app/
│       ├── main.py              # FastAPI entry point, CORS, router registration
│       ├── config.py            # Pydantic settings (reads .env)
│       ├── database.py          # SQLAlchemy engine & session factory
│       ├── models/              # ORM table definitions (papers, summaries, qa_messages)
│       ├── schemas/             # Pydantic request/response schemas
│       ├── routers/
│       │   ├── search.py        # GET /api/search
│       │   ├── papers.py        # GET/POST/DELETE /api/papers
│       │   ├── pdf.py           # POST /api/pdf/upload, GET /api/pdf/view/{id}
│       │   └── ai.py            # POST /api/ai/summarize, /api/ai/ask, GET /api/ai/history
│       └── services/
│           ├── search_service.py   # OpenAlex + arXiv API clients
│           ├── paper_service.py    # Library CRUD logic
│           ├── pdf_service.py      # PyMuPDF extraction & font-heuristic metadata
│           └── llm_service.py      # Google Gemini / OpenAI adapter with model fallback
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── App.tsx              # Root layout, theme toggle, modal orchestration
        ├── index.css            # Design system, CSS variables, light/dark themes
        ├── types/               # TypeScript interfaces (Paper, Summary, QAMessage …)
        ├── services/
        │   └── api.ts           # Typed fetch wrappers for all backend endpoints
        └── components/
            ├── SearchPanel.tsx      # Search form & results list
            ├── LibraryPanel.tsx     # Saved papers grid / list view
            ├── PaperCard.tsx        # Reusable paper card with actions
            ├── PDFUploadModal.tsx   # Drag-and-drop PDF uploader
            ├── PDFViewerModal.tsx   # In-browser PDF preview (iframe)
            ├── SummaryModal.tsx     # AI summary panel
            └── QAModal.tsx          # Interactive Q&A chat panel
```

---

## Prerequisites

| Requirement | Version |
| :--- | :--- |
| Python | 3.10+ (tested on 3.13) |
| Node.js | 18+ |
| npm | 9+ |

---

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/raghavanb21/ai-research-assistant.git
cd ai-research-assistant
```

### 2. Configure environment variables

```bash
cp .env.example backend/.env
```

Open `backend/.env` and fill in at minimum:

```env
GEMINI_API_KEY=your_google_gemini_api_key   # Required for AI features
```

All other values have working defaults — see the [Environment Variables](#environment-variables) table below.

> **Get a free Gemini API key:** https://aistudio.google.com/app/apikey

### 3. Backend setup

```bash
cd backend

# Create and activate a virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

### 4. Frontend setup

```bash
cd ../frontend
npm install
```

---

## Running the Application

Open **two terminal windows** and run each service:

### Terminal 1 — Backend

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

| Endpoint | URL |
| :--- | :--- |
| Application API | `http://localhost:8000` |
| Swagger UI (API Docs) | `http://localhost:8000/docs` |
| Health Check | `http://localhost:8000/api/health` |

### Terminal 2 — Frontend

```bash
cd frontend
npm run dev
```

| Endpoint | URL |
| :--- | :--- |
| Web Application | `http://localhost:5173` |

---

## Environment Variables

All variables are read from `backend/.env`. Copy from `.env.example` to get started.

| Variable | Default | Required | Description |
| :--- | :--- | :---: | :--- |
| `HOST` | `0.0.0.0` | | Backend bind host |
| `PORT` | `8000` | | Backend port |
| `DEBUG` | `true` | | Enable FastAPI debug mode |
| `CORS_ORIGINS` | `http://localhost:5173,...` | | Comma-separated allowed frontend origins |
| `DATABASE_URL` | `sqlite:///./data/assistant.db` | | SQLite database path |
| `PDF_STORAGE_DIR` | `./data/pdfs` | | Directory for uploaded PDF files |
| `LLM_PROVIDER` | `gemini` | | LLM backend: `gemini` or `openai` |
| `LLM_MODEL` | `gemini-3.5-flash` | | Model identifier (overridden by fallback logic) |
| `GEMINI_API_KEY` | — | (AI features) | Google Gemini API key |

> The `data/` directory (database + PDFs) is created automatically on first run. It is excluded from version control via `.gitignore`.

---

## Key Dependencies

### Backend (`requirements.txt`)

| Package | Purpose |
| :--- | :--- |
| `fastapi` | Web framework & API routing |
| `uvicorn[standard]` | ASGI server |
| `sqlalchemy` | ORM & database abstraction |
| `pydantic` / `pydantic-settings` | Data validation & settings management |
| `httpx` | Async HTTP client (OpenAlex & arXiv API calls) |
| `pymupdf` | PDF text extraction & font-heuristic metadata parsing |
| `google-genai` | Google Gemini API client |
| `openai` | OpenAI API client (alternative LLM provider) |
| `python-multipart` | Multipart form handling for file uploads |
| `pytest` | Test framework |

### Frontend (`package.json`)

| Package | Purpose |
| :--- | :--- |
| `react` + `react-dom` | UI framework |
| `vite` | Build tool & dev server |
| `typescript` | Type safety |
| `lucide-react` | Icon library |

---

## API Reference

All endpoints are prefixed with `/api`.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Backend health check |
| `GET` | `/search?query=...&source=...` | Search OpenAlex or arXiv |
| `GET` | `/papers` | List all saved papers |
| `POST` | `/papers` | Save a paper to the library |
| `DELETE` | `/papers/{id}` | Remove a paper from the library |
| `POST` | `/pdf/upload` | Upload a PDF file |
| `GET` | `/pdf/view/{paper_id}` | Serve a stored PDF for browser viewing |
| `POST` | `/ai/summarize/{paper_id}` | Generate (or regenerate) an AI summary |
| `GET` | `/ai/summarize/{paper_id}` | Retrieve a cached summary |
| `POST` | `/ai/ask/{paper_id}` | Ask a question about a paper |
| `GET` | `/ai/history/{paper_id}` | Get Q&A conversation history |
| `DELETE` | `/ai/history/{paper_id}` | Clear Q&A history for a paper |

Full interactive documentation is available at `http://localhost:8000/docs` when the backend is running.

---

## Testing

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

---

## License

This project is for academic and educational use of CS593 AI4SE
