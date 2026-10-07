# AI Research Assistant

A modern, full-stack application designed to help researchers, students, and engineers discover, organize, read, summarize, and query academic research papers.

## Features Overview
- **100% Free Public Paper Search**: Search OpenAlex (250M+ papers) and arXiv preprints with zero required paid API keys.
- **Defensive Metadata Display**: Robust fallback rendering for missing authors, years, abstracts, and external links.
- **Persistent Local Library**: Save papers to a persistent local SQLite database across browser refreshes and server restarts.
- **Local PDF Processing**: Upload research papers in PDF format with 100% local text & font-heuristic metadata extraction (via PyMuPDF). Zero document contents leave your machine.
- **Content-Grounded AI Summarization**: Generate structured summaries (Key Contributions, Methodology, Findings, Limitations) grounded strictly in the full paper text.
- **Interactive Paper Q&A**: Ask natural language questions about any paper in your library with context citations.

---

## System Architecture

```
+--------------------------------------------------------------------+
|                         Frontend (React + Vite)                    |
|  +---------------------+  +--------------------+  +--------------+ |
|  | Paper Search View   |  | Library / Grid View|  | Paper Reader | |
|  +---------------------+  +--------------------+  +--------------+ |
|  | Summary Panel       |  | Interactive Q&A    |  | PDF Uploader | |
|  +---------------------+  +--------------------+  +--------------+ |
+---------------------------------+----------------------------------+
                                  | HTTP / REST (JSON)
                                  v
+--------------------------------------------------------------------+
|                         Backend (FastAPI)                          |
|  +---------------------------------------------------------------+ |
|  | Routers: /api/search, /api/papers, /api/pdf, /api/ai          | |
|  +---------------------------------------------------------------+ |
|  | Services: arXiv/OpenAlex Search, PyMuPDF Extractor, LLM Adapter | |
|  +---------------------------------------------------------------+ |
|  | Data Layer: SQLAlchemy ORM + SQLite (assistant.db)             | |
|  +---------------------------------------------------------------+ |
|  | Local Storage: ./data/pdfs/                                   | |
+--------------------------------------------------------------------+
```

Detailed design and architecture specifications can be found in [`docs/architecture.md`](docs/architecture.md).

---

## Project Structure

```
ai4se/
├── .env.example
├── .gitignore
├── AGENT_LOG.md                # Development trajectory and engineering logs
├── README.md                   # This file
├── docs/
│   └── architecture.md         # System specification & architecture
├── backend/
│   ├── app/
│   │   ├── config.py           # Application settings
│   │   ├── database.py         # SQLAlchemy engine & session factory
│   │   ├── main.py             # FastAPI entry point & CORS
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── schemas/            # Pydantic validation schemas
│   │   ├── routers/            # API endpoints
│   │   └── services/           # Search, PDF extraction, and LLM services
│   ├── requirements.txt
│   └── data/                   # SQLite database and uploaded PDFs
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    └── src/
        ├── index.css           # Global design system & theme tokens
        ├── App.tsx             # Root layout & navigation
        ├── components/         # React components
        ├── services/           # API fetch client
        └── types/              # TypeScript interfaces
```

---

## Getting Started & Setup

### Prerequisites
- **Python 3.10+** (Tested on Python 3.13)
- **Node.js 18+** & **npm**

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Create environment configuration
cp ../.env.example .env
```

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Install Node dependencies
npm install
```

---

## Running the Application

### Start the Backend Server

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- API Docs (Swagger UI): `http://localhost:8000/docs`
- Health Check: `http://localhost:8000/api/health`

### Start the Frontend Dev Server

```bash
cd frontend
npm run dev
```
- Frontend Web App: `http://localhost:5173`

---

## Environment Variables

| Variable | Default | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `sqlite:///./data/assistant.db` | Local SQLite database file path |
| `PDF_STORAGE_DIR` | `./data/pdfs` | Directory for uploaded PDF documents |
| `LLM_PROVIDER` | `gemini` | `gemini` or `openai` |
| `GEMINI_API_KEY` | - | Google Gemini API Key (for summarization/Q&A) |
| `OPENAI_API_KEY` | - | OpenAI API Key (alternative LLM provider) |
| `LLM_MODEL` | `gemini-1.5-flash` | Model identifier |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Allowed frontend origins |
| `PORT` | `8000` | Backend port |

---

## Testing

Backend test suites will be run in Phase 8:
```bash
cd backend
pytest tests/
```
