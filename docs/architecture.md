# AI Research Assistant — System Architecture & Specification

## 1. Requirements Breakdown

The **AI Research Assistant** is a single-user full-stack web application designed to help researchers, students, and engineers discover, organize, read, summarize, and query academic research papers.

### Functional Requirements (FR)
- **FR-1: 100% Free Public Paper Search**: Query free public research APIs (OpenAlex and arXiv Atom API) without requiring paid API keys or user signups.
- **FR-2: Robust Metadata Display with Defensive Fallbacks**: Display paper metadata including Title, Authors, Publication Year, Abstract, DOI/ArXiv Link, and Source. When fields are unavailable, display clear, user-friendly fallback placeholders (e.g. *"Unknown Author(s)"*, *"Year N/A"*, *"No abstract provided"*).
- **FR-3: Persistent Paper Library**: Save selected papers to a persistent local database with deduplication (by DOI, arXiv ID, or URL).
- **FR-4: Library Management**: Browse, filter, sort, view details, and remove saved papers across browser refreshes and backend restarts.
- **FR-5: PDF Upload**: Upload PDF research papers via drag-and-drop or file selector with file validation (size, MIME type).
- **FR-6: Local PDF Text & Metadata Extraction**: Extract full body text and parse metadata (title, authors, year, abstract) locally from uploaded PDFs with zero document leakage.
- **FR-7: Unified Paper Representation**: Display uploaded papers and API-searched papers with a consistent data model and UI card/reader view.
- **FR-8: LLM-Powered Summarization**: Generate structured summaries (Key Contributions, Methodology, Findings, Limitations) grounded strictly in the full paper text.
- **FR-9: Grounded Paper Q&A**: Interactive conversational Q&A on selected papers, answering user prompts using the paper content as context.
- **FR-10: Content-Grounded Responses**: Guardrails against hallucination: summaries and Q&A must cite/rely on the actual paper content, not mere titles/abstracts.
- **FR-11: Usable Full-Stack Interface**: Clean, modern, responsive UI with light/dark theme, split-pane reader/Q&A, and resilient backend REST API with auto-generated OpenAPI docs.
- **FR-12: Deployment Readiness**: Containerized / free-tier deployable (e.g., Render, Railway, Hugging Face Spaces, or Vercel + Render).

### Non-Functional Requirements (NFR)
- **NFR-1: Security**: Never expose LLM API keys to the frontend or commit secrets to Git. Strict `.env` usage.
- **NFR-2: Privacy & Safe PDF Handling**: Local PDF processing using verified libraries (no external third-party telemetry, no arbitrary code execution).
- **NFR-3: Zero-Cost Base Search**: Search must function out of the box with zero required payment or subscriptions.
- **NFR-4: Performance**: Fast search responses (< 1.5s), responsive streaming or fast LLM responses, efficient PDF parsing (< 3s for typical 15-page paper).
- **NFR-5: Simplicity & Maintainability**: Clean, modular codebase, minimal external infrastructure (SQLite instead of managed Postgres/Redis for local mode).
- **NFR-6: Reliability & Defensive UI**: Graceful degradation when external search APIs are rate-limited or paper fields are missing/null.

---

## 2. Proposed Architecture

The system follows a clean, decoupled **Client-Server Architecture**:

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
|  | Router Layer: /api/search, /api/papers, /api/pdf, /api/ai     | |
|  +---------------------------------------------------------------+ |
|  | Service Layer:                                                | |
|  |  * SearchService (OpenAlex & arXiv free public clients)       | |
|  |  * PDFExtractionService (PyMuPDF parser & font heuristic)     | |
|  |  * LLMService (Gemini / OpenAI provider abstraction)          | |
|  |  * PaperRepository (SQLAlchemy CRUD operations)               | |
|  +---------------------------------------------------------------+ |
|  | Data Layer: SQLAlchemy ORM + SQLite (assistant.db)             | |
|  +---------------------------------------------------------------+ |
|  | Storage: Local file storage for uploaded PDFs (./data/pdfs/)  | |
+--------------------------------------------------------------------+
                                  |
              +-------------------+-------------------+
              v                                       v
   +-----------------------+              +-----------------------+
   | Free Public Search    |              |   LLM Provider API    |
   | (OpenAlex & arXiv API)|              | (Gemini / OpenAI)     |
   +-----------------------+              +-----------------------+
```

---

## 3. Technology Choices and Justifications

### 3.1 Core Stack Justification

| Layer / Component | Technology | Detailed Engineering Justification |
| :--- | :--- | :--- |
| **Backend Framework** | **FastAPI (Python 3.10+)** | Async non-blocking I/O for network-bound external API searches and LLM requests; native Pydantic validation for schema contracts; automatic OpenAPI/Swagger documentation (`/docs`); seamless integration with Python PDF & AI ecosystems. |
| **Database & ORM** | **SQLite + SQLAlchemy ORM** | **Why SQLAlchemy ORM?**<br>1. *Declarative Data Modeling*: Type-annotated models cleanly map database entities (`Paper`, `Summary`, `QAMessage`) to Pydantic schemas.<br>2. *Automated Relationship & Cascade Management*: Manages 1-to-1 (`Paper -> Summary`) and 1-to-Many (`Paper -> QAMessage`) relationships with automatic cascade deletion (deleting a paper cleans up its summaries and chat history).<br>3. *SQL Injection Protection*: Automated query parameterization and escaping.<br>4. *Database Portability*: Zero-code migration if migrating from local SQLite to cloud PostgreSQL.<br>5. *Connection & Transaction Management*: Thread-safe session handling and atomic transactions. |
| **Frontend Framework** | **React (Vite + TypeScript)** | Fast developer HMR, strong compile-time type safety mirroring backend DTOs, reactive component state management for multi-pane paper reader, search filters, and Q&A chat. |
| **Frontend Styling** | **Vanilla CSS with Design Tokens** | Full control over design aesthetics, custom dark/light theme tokens, zero dependency bloat, sleek micro-animations, and responsive split-pane layout. |
| **Public Paper Search** | **OpenAlex API (Primary) & arXiv API (Secondary)** | **100% Free Public Search**:<br>• *OpenAlex API*: Free access to 250M+ multidisciplinary research papers, reconstructed abstracts, DOIs, and open-access links with zero authentication/keys needed.<br>• *arXiv Atom API*: Completely free, zero API key required, zero authentication, high uptime, searches millions of CS, AI, Math, and Physics preprints. |
| **PDF Extraction Engine** | **PyMuPDF (`fitz`)** | C-based MuPDF engine running 100% locally. Extracts text, font sizes, layout spans, and metadata in <50ms without external network access or arbitrary code execution. (See detailed investigation below). |
| **LLM Provider Adapter** | **Google Gemini / OpenAI (Pluggable)** | Pluggable service layer supporting high-context models (e.g. Gemini 1.5 Flash / OpenAI GPT-4o-mini) for comprehensive, cost-effective full-paper summarization and Q&A. |
| **HTTP Client** | **`httpx` (Backend) / `fetch` (Frontend)** | Modern async HTTP client with timeout handling and connection pooling. |

---

### 3.2 PDF-Processing Tools & Skills Investigation

As required, we investigated available PDF processing tools, agent skills, and libraries:

| Evaluation Criterion | **PyMuPDF (`fitz`)** *(Recommended)* | **pypdf** | **pdfplumber** | **Cloud OCR / Parser Tools (e.g. LlamaParse / Unstructured)** |
| :--- | :--- | :--- | :--- | :--- |
| **What it does** | High-performance C-extension wrapper around MuPDF engine. Extracts raw text, layout blocks, font sizes, spans, and embedded document metadata. | Pure-Python PDF extraction library. Extracts basic page text strings. | Python library built on `pdfminer.six`. Specializes in visual table extraction and layout inspection. | Remote SaaS API that ingests PDFs and returns parsed markdown/JSON via cloud vision models. |
| **Permissions / Access** | Local filesystem read/write only. Requires zero special system permissions or root access. | Local filesystem read only. | Local filesystem read only. | Requires outbound HTTPS network access + external API credentials. |
| **Arbitrary Code Execution Risk** | **None**. Operates purely as a data parser on binary PDF streams. | **None**. Pure Python data parser. | **None**. Pure Python data parser. | **Low / Medium**. Runs on third-party remote servers outside our control. |
| **Communicates with External Services?** | **No**. 100% offline, zero network requests, zero telemetry. | **No**. 100% offline. | **No**. 100% offline. | **Yes**. Transmits entire PDF file payload over public internet to third-party endpoints. |
| **Document Privacy (Data leaves machine?)** | **NO**. All document contents, extracted text, and metadata remain strictly on the local machine. | **NO**. Remains local. | **NO**. Remains local. | **YES**. Document contents are uploaded to third-party cloud infrastructure. |
| **Academic Layout & Font Extraction** | **Excellent**. Extracts font size and bounding boxes, allowing heuristics to reliably distinguish Title (largest font), Authors, and Abstract headers. | **Poor**. Returns raw unstructured text streams without font size hierarchy. | **Good**. Extracts character metadata but is significantly slower on 20+ page academic papers. | **Excellent**. Returns structured markdown, but with high latency and network dependency. |
| **Speed & Resource Footprint** | Extremely fast (~10–50ms for a 15-page paper). Minimal memory footprint. | Moderate (~200ms). Low memory. | Slow (~1.5s–3s per paper). High CPU overhead. | Network-dependent (~3s–10s per request). |

#### Recommendation:
**PyMuPDF (`fitz`)** is the safest, fastest, and most privacy-preserving choice. It guarantees:
1. Complete local data privacy (no document contents ever leave the machine).
2. Zero arbitrary code execution or external network dependencies.
3. Access to font size metadata, which is critical for identifying the paper title, author list, and abstract from front-matter text.

---

## 4. Project Directory Structure

> **Note on Testing**: To support fast, incremental implementation, backend test suites in `tests/` will be systematically constructed and expanded in **Phase 8 (Testing, Debugging, and Code Review)**.

```
ai4se/
├── .env.example                # Template for environment variables (API keys, ports)
├── .gitignore                  # Git ignore for .env, db files, __pycache__, node_modules
├── AGENT_LOG.md                # Single incremental development log
├── README.md                   # Project overview, setup, and run instructions
├── docs/
│   └── architecture.md         # System architecture and design documentation
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py             # FastAPI entry point & CORS configuration
│   │   ├── config.py           # Pydantic Settings (env vars, defaults)
│   │   ├── database.py         # SQLAlchemy engine, session factory, base model
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── paper.py        # SQLAlchemy Paper, Summary, QAMessage models
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── paper.py        # Pydantic request/response schemas (with fallbacks)
│   │   │   ├── search.py       # Search query/result schemas
│   │   │   └── ai.py           # Summary and Q&A request/response schemas
│   │   ├── routers/
│   │   │   ├── __init__.py
│   │   │   ├── search.py       # /api/search routes (free arXiv / S2)
│   │   │   ├── papers.py       # /api/papers CRUD routes
│   │   │   ├── pdf.py          # /api/pdf upload and extraction routes
│   │   │   └── ai.py           # /api/ai/summarize and /api/ai/qa routes
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── search_service.py     # OpenAlex & arXiv clients
│   │       ├── pdf_service.py        # PyMuPDF text & font-heuristic parser
│   │       └── llm_service.py        # LLM prompt orchestration & provider adapter
│   ├── tests/                  # Focus of Phase 8
│   │   ├── __init__.py
│   │   ├── test_search.py
│   │   ├── test_papers_api.py
│   │   ├── test_pdf_extraction.py
│   │   └── test_llm_service.py
│   ├── requirements.txt        # Backend dependencies (fastapi, uvicorn, sqlalchemy, etc.)
│   └── data/                   # Git-ignored local storage (SQLite DB + uploaded PDFs)
│       └── pdfs/
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    └── src/
        ├── index.css           # Global design system (tokens, reset, typography, theme)
        ├── App.tsx             # Root component with navigation and notifications
        ├── main.tsx            # React DOM mounting
        ├── types/              # TypeScript interfaces matching backend schemas
        │   └── index.ts
        ├── services/           # API client functions (fetch wrappers)
        │   └── api.ts
        └── components/
            ├── Navbar.tsx      # Top bar with search, library toggle, theme switch
            ├── SearchPanel.tsx # Keyword search input, source toggles, results grid
            ├── LibraryView.tsx # Saved papers grid/list with filters, sort, and actions
            ├── PaperCard.tsx   # Reusable paper card with defensive fallback rendering
            ├── PaperReader.tsx # Dual-pane paper reader with tabs
            ├── SummaryView.tsx # Structured AI summary view with export/copy
            ├── QAChat.tsx      # Natural language Q&A chat interface
            ├── PDFUploader.tsx # Drag-and-drop PDF upload component with progress
            └── Toast.tsx       # UI notification toasts for success/error feedback
```

---

## 5. Database Schema & SQLAlchemy ORM Design

```
+----------------------------------------------------------------------+
|                               papers                                 |
+-----------------------------------+----------------------------------+
| id               INTEGER PRIMARY  | Unique internal identifier       |
| title            TEXT NOT NULL    | Paper title                      |
| authors          TEXT             | JSON-encoded list of author names|
| publication_year INTEGER          | Year of publication (or NULL)    |
| abstract         TEXT             | Abstract text (or NULL)          |
| url              TEXT             | Link to original paper (PDF/DOI) |
| doi              TEXT UNIQUE      | Digital Object Identifier        |
| arxiv_id         TEXT UNIQUE      | arXiv identifier (if applicable) |
| source           TEXT NOT NULL    | 'openalex' | 'arxiv' | 'upload'  |
| pdf_file_path    TEXT             | Local path if uploaded/cached    |
| full_text        TEXT             | Extracted raw body text          |
| created_at       DATETIME         | Timestamp when saved             |
| updated_at       DATETIME         | Timestamp when updated           |
+-----------------------------------+----------------------------------+
               | 1
               |
               +---------------+
               | 1             | 1
               v               v
+------------------------+  +------------------------------------------+
|       summaries        |  |               qa_messages                |
+------------------------+  +------------------------------------------+
| id         INTEGER PK  |  | id         INTEGER PRIMARY KEY           |
| paper_id   INTEGER FK  |  | paper_id   INTEGER FOREIGN KEY -> papers |
| summary    TEXT NOT NULL| | role       TEXT ('user' | 'assistant')   |
| key_points TEXT (JSON) |  | message    TEXT NOT NULL                 |
| model_used TEXT        |  | context_used TEXT                        |
| created_at DATETIME    |  | created_at DATETIME                      |
+------------------------+  +------------------------------------------+
```

### SQLAlchemy ORM Model Mapping & Cascades:
- **`Paper`**: Top-level entity. Has `relationship("Summary", back_populates="paper", cascade="all, delete-orphan", uselist=False)` and `relationship("QAMessage", back_populates="paper", cascade="all, delete-orphan")`.
- **`Summary`**: Stores structured summary markdown and parsed key points.
- **`QAMessage`**: Preserves conversational context across restarts.
- **Cascade Deletes**: When a user deletes a paper, SQLAlchemy automatically cascades deletion to associated summaries and chat messages, preventing orphaned records.

---

## 6. Backend API Endpoints & Contracts

### 6.1 Search API (100% Free, Zero Auth)
- **`GET /api/search`**
  - **Query Params**: `q` (string, required), `limit` (int, default: 10, max: 30), `source` (`openalex` | `arxiv` | `all`, default: `openalex`)
  - **Response (200)**:
    ```json
    {
      "query": "transformer attention",
      "count": 10,
      "results": [
        {
          "title": "Attention Is All You Need",
          "authors": ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar"],
          "publication_year": 2017,
          "abstract": "The dominant sequence transduction models...",
          "url": "https://arxiv.org/abs/1706.03762",
          "arxiv_id": "1706.03762",
          "doi": null,
          "source": "arxiv"
        }
      ]
    }
    ```

### 6.2 Papers Library API (CRUD)
- **`GET /api/papers`**: Retrieve all saved papers (supports `?sort=created_at&order=desc&search=...`).
- **`GET /api/papers/{paper_id}`**: Get full paper details including full text and cached summary.
- **`POST /api/papers`**: Save a paper to the persistent database (handles deduplication by `doi` and `arxiv_id`).
- **`DELETE /api/papers/{paper_id}`**: Remove paper and associated summaries/chat history from the database (and delete local PDF if uploaded).

### 6.3 PDF Upload & Extraction API
- **`POST /api/pdf/upload`**
  - **Payload**: `multipart/form-data` with `file` (PDF file, max 25MB)
  - **Processing**: Saves file locally to `data/pdfs/`, executes PyMuPDF text & font-heuristic metadata extraction.
  - **Response (201)**:
    ```json
    {
      "title": "Extracted Paper Title",
      "authors": ["Author One", "Author Two"],
      "publication_year": 2023,
      "abstract": "Extracted abstract paragraph...",
      "full_text": "Full extracted paper body text...",
      "pdf_file_path": "data/pdfs/abc-123.pdf",
      "page_count": 12,
      "source": "upload"
    }
    ```

### 6.4 AI Summarization & Q&A API
- **`POST /api/ai/summarize`**: Generates or retrieves cached structured summary.
- **`POST /api/ai/qa`**: Answers natural-language questions grounded strictly in paper full text.
- **`GET /api/ai/qa/{paper_id}`**: Retrieves chat history for the paper.
- **`DELETE /api/ai/qa/{paper_id}`**: Clears chat history for the paper.

---

## 7. Frontend Defensive UI & Fallback Strategy

To ensure a seamless user experience even when paper metadata is incomplete or APIs omit fields, the frontend implements strict defensive UI fallbacks:

| Metadata Field | Condition / Missing Value | Frontend Fallback UI Representation |
| :--- | :--- | :--- |
| **Authors** | Empty array `[]` or `null` | Displays *"Unknown Author(s)"* in muted italic text. |
| **Publication Year** | `null` or `0` | Displays a neutral *"Year N/A"* badge. |
| **Abstract** | Empty string `""` or `null` | Displays *"No abstract provided. Upload full PDF or generate AI summary."* |
| **Paper URL / DOI** | `null` or missing | Disables the "Open External" button with a tooltip *"No external link available"*. |
| **Full Text** | `null` or empty | Reader tab displays *"Full body text unavailable. Upload the PDF to enable full-text inspection."* |
| **Search Results** | Query returns 0 items | Displays an illustrated empty state: *"No research papers found. Try adjusting keywords or selecting another search source."* |
| **API Failures** | External API temporary unavailability | Auto-fallbacks between OpenAlex and arXiv seamlessly. |

---

## 8. Search-Paper Data Flow (Free APIs)

```
+-------------+         +------------------+         +-------------------------------+
| User Search | ------> | FastAPI Backend  | ------> | Free Public Academic APIs     |
| Query "RAG" |         | (/api/search)    |         | (OpenAlex & arXiv APIs)       |
+-------------+         +------------------+         +-------------------------------+
                               |                                    |
                               v                                    v
                     +-------------------+                +-------------------+
                     | Formatted Results | <------------- | Normalized Papers |
                     | (Defensive DTOs)  |                | (No Auth Required)|
                     +-------------------+                +-------------------+
                               |
                               v
                     +-------------------+
                     | Render Paper Cards|
                     | in React Frontend |
                     +-------------------+
```

---

## 9. PDF-Upload & Local Extraction Flow (PyMuPDF)

```
+--------------------+      +--------------------+      +--------------------+
| User Uploads PDF   | ---> | Backend validates  | ---> | PyMuPDF (fitz)     |
| (drag-and-drop/btn)|      | file size & MIME   |      | parses local bytes |
+--------------------+      +--------------------+      +--------------------+
                                                                   |
                                                                   v
+--------------------+      +--------------------+      +--------------------+
| Frontend displays  | <--- | Paper saved to DB  | <--- | Font-size Heuristic|
| extracted metadata |      | (source='upload')  |      | parses Title,      |
| with fallback UI   |      |                    |      | Authors, Abstract  |
+--------------------+      +--------------------+      +--------------------+
```

---

## 10. LLM Summarization Flow

```
+-------------------------+      +-------------------------+      +-------------------------+
| User clicks "Summarize" | ---> | Backend retrieves full  | ---> | LLM Service builds      |
| on selected paper       |      | text from SQLite DB     |      | structured prompt       |
+-------------------------+      +-------------------------+      +-------------------------+
                                                                               |
                                                                               v
+-------------------------+      +-------------------------+      +-------------------------+
| Frontend renders parsed | <--- | Summary saved to DB     | <--- | LLM Provider returns    |
| structured sections     |      | (cached for paper)      |      | Contributions, Methods, |
| (Key Findings/Limits)   |      |                         |      | Findings, Limitations   |
+-------------------------+      +-------------------------+      +-------------------------+
```

---

## 11. Q&A Flow

```
+-------------------------+      +-------------------------+      +-------------------------+
| User asks question in   | ---> | Backend retrieves full  | ---> | Prompt assembled with   |
| Paper Reader Q&A chat   |      | paper text & chat hist. |      | strict context citation |
+-------------------------+      +-------------------------+      +-------------------------+
                                                                               |
                                                                               v
+-------------------------+      +-------------------------+      +-------------------------+
| Frontend renders answer | <--- | Response logged to      | <--- | LLM Provider generates  |
| bubble with citations   |      | qa_messages table in DB |      | grounded answer         |
+-------------------------+      +-------------------------+      +-------------------------+
```

---

## 12. Error-Handling Strategy

### Backend Error Strategy
- **Standardized Error Envelope**:
  ```json
  {
    "error": {
      "code": "PAPER_NOT_FOUND",
      "message": "Paper with ID 42 was not found in the database.",
      "details": null
    }
  }
  ```
- **External Search Failures**: If one search provider fails, seamlessly fall back to the alternate provider (OpenAlex <-> arXiv) and return partial results with a warning flag instead of crashing.
- **Missing / Invalid LLM Key**: Check key presence early; return clear 400 Bad Request: *"LLM API key not configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in .env"*.
- **Malformed PDF / Corrupted File**: Return 422 Unprocessable Entity with human-friendly message: *"Unable to extract text from PDF. The file may be password protected or a scanned image without OCR text."*

### Frontend Error Strategy
- **Toast Notifications**: Non-intrusive floating toasts for transient network errors.
- **Component Error Boundaries**: Prevent whole-app white screen if a component fails to render.
- **Empty & Loading States**: Clean skeleton loaders during search/LLM generation and friendly empty states when search returns 0 matches.

---

## 13. Environment Variable Strategy

A single `.env` in `backend/`:

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `DATABASE_URL` | No | `sqlite:///./data/assistant.db` | SQLite database connection string |
| `PDF_STORAGE_DIR` | No | `./data/pdfs` | Directory for uploaded PDF files |
| `LLM_PROVIDER` | No | `gemini` | `gemini` or `openai` |
| `GEMINI_API_KEY` | Conditional | `""` | Google Gemini API key (if using Gemini) |
| `OPENAI_API_KEY` | Conditional | `""` | OpenAI API key (if using OpenAI) |
| `LLM_MODEL` | No | `gemini-1.5-flash` | Specific model identifier |
| `CORS_ORIGINS` | No | `http://localhost:5173,http://127.0.0.1:5173` | Allowed frontend origins |
| `PORT` | No | `8000` | Backend server port |

- `.env` will be strictly added to `.gitignore`.
- `.env.example` will be provided with clear descriptions and placeholders.

---

## 14. Testing Strategy (Formalized in Phase 8)

1. **Backend Unit & Integration Tests (`pytest`)** *(Implemented in Phase 8)*:
   - `test_search.py`: Mock external API responses to test parser normalization, error handling, and deduplication.
   - `test_papers_api.py`: Test SQLite CRUD operations (save, retrieve, list, delete, unique constraints).
   - `test_pdf_extraction.py`: Test PyMuPDF text extraction on sample PDF fixtures.
   - `test_llm_service.py`: Test prompt building, token truncation, and mocked LLM provider calls.
2. **Frontend Sanity & Build Verification**:
   - TypeScript compile check (`tsc --noEmit`).
   - Vite build check (`npm run build`).
   - Manual API verification via FastAPI interactive docs (`/docs`).

---

## 15. Incremental Development Phases

| Phase | Title | Focus / Deliverables |
| :---: | :--- | :--- |
| **0** | **Requirements & Architecture** | System specification, data schemas, API contracts, `docs/architecture.md`, `AGENT_LOG.md`. |
| **1** | **Project Setup** | Backend FastAPI skeleton, SQLite DB setup, Vite React frontend, `.gitignore`, `.env.example`, verification of dev servers. |
| **2** | **Research Paper Search** | Free OpenAlex & arXiv clients, `/api/search` endpoint, Search UI with cards, defensive fallback rendering. |
| **3** | **Persistent Paper Library** | SQLAlchemy Paper model, `/api/papers` CRUD, Save to Library button, Library View with filter/sort/delete. |
| **4** | **PDF Upload & Processing** | PyMuPDF integration & local font-heuristic extraction, `/api/pdf/upload`, upload UI modal. |
| **5** | **LLM Summarization** | LLM service provider adapter, `/api/ai/summarize`, structured prompt engineering, Summary viewer UI tab. |
| **6** | **Paper Q&A** | Grounded Q&A prompt with context injection, `/api/ai/qa`, chat message history, interactive chat UI drawer. |
| **7** | **UI/Integration Refinement** | Unified paper reader modal, responsive styling, dark/light theme polish, toast notifications, loading states. |
| **8** | **Testing, Debugging & Review**| Pytest test suite, error boundary validation, edge case fixes (rate limits, huge PDFs), code review cleanups. |
| **9** | **Deployment Preparation** | Production build scripts, Dockerfile / container setup, deployment guide (Render / Railway / Hugging Face). |

---

## 16. Potential Risks, Ambiguities, and Recommended Solutions

1. **PDFs with Scanned Images (No Text Layer)**:
   - *Risk*: PyMuPDF extracts empty text from scanned bitmap PDFs.
   - *Solution*: Detect if extracted text is under 100 characters; return a clear user alert explaining that the PDF is a scanned image without an embedded text layer.
2. **Missing or Incomplete Metadata in Search APIs & PDFs**:
   - *Risk*: Preprints or old papers often lack DOIs, abstracts, or precise publication dates.
   - *Solution*: Frontend applies defensive fallback strings (*"Unknown Author(s)"*, *"Year N/A"*, *"No abstract provided"*) so UI rendering never breaks or shows `null`.
3. **Very Long Papers Exceeding LLM Context Limits**:
   - *Risk*: Massive 50+ page review papers could exceed model token limits or increase latency/cost.
   - *Solution*: Implement a smart hierarchical extraction strategy: prioritize Abstract + Introduction + Methodology + Conclusion, or fit within context budget (e.g. Gemini 1.5 Flash supports 1M tokens, but we enforce a sensible 50k word limit).
4. **LLM Hallucination on Non-Content Metadata**:
   - *Risk*: Model summarizes from prior web knowledge rather than the paper text.
   - *Solution*: Explicit system prompt guardrails with few-shot format: instruct the model to state *"The provided paper does not discuss..."* if information is absent.

---

## 17. Deployment Approach

- **Free-Tier Deployment Ready**:
  - **Backend**: Can be deployed on **Render** (free tier Web Service) or **Hugging Face Spaces** (Docker/Python).
  - **Frontend**: Can be built as static assets and served directly by FastAPI (single-port deployment) or hosted on **Vercel / Netlify** with API proxying.
  - **Single Dockerfile Option**: Multi-stage build that compiles Vite frontend assets into `backend/app/static`, allowing single-container deployment on any free cloud host with zero CORS configuration needed.
