# Neravu - Cancer Care Financial Navigation & Assistance Platform

**Status**: Active development / Hackathon MVP  
**Repository**: https://github.com/HARINISAI-18/Neravu  

Neravu helps cancer patients and caregivers in India navigate financial and administrative assistance: discover programmes, understand possible eligibility, prepare documents, find official application routes, and ask questions in English, Telugu and Hindi. It is an information and preparation tool, not a medical diagnostic service, a guarantee of funding, or an authority that decides eligibility.

---

## Architecture Overview

```
Patient / Caregiver React UI (Vite)
       │
       ▼
   FastAPI Gateway (/api)
       │
       ├── Question Intent Router (Classifier)
       │     ├── Urgent Medical -> Direct Emergency Disclaimer
       │     ├── General Cancer Knowledge -> Safe Medical Knowledge Base
       │     ├── Scheme Eligibility -> Deterministic Rules Engine
       │     ├── Document Checklist -> Document Engine & Journey Steps
       │     └── Scheme Q&A -> Hybrid RAG (pgvector + BM25 FTS + BGE Reranker)
       │
       ├── Admin APIs (Bearer JWT / Role: admin)
       │     ├── Scheme CRUD (Draft -> Review -> Published)
       │     ├── Official Evidence Verification & Sources
       │     └── Publication Sync Indexer (Async Worker)
       │
       └── Database (Supabase PostgreSQL + pgvector)
             ├── published_schemes, programme_versions
             ├── published_knowledge_chunks (384-d E5 embeddings)
             └── verification_reviews & sync_jobs
```

---

## Frontend Setup & Run

From repository root:

```bash
npm install
npm run dev
```

Open the local Vite URL (`http://localhost:5173`). Vite proxies `/api` requests to `http://127.0.0.1:8000`.

### Production Build
```bash
npm run build
npm run preview
```

### Frontend Highlights
- **3D Cinematic Scroll Story**: Interactive GSAP ScrollTrigger timeline with articulated procedural characters representing the patient/caregiver journey (`src/scene/HospitalScene.jsx`).
- **Patient Assistance Platform**: Step-by-step assessment, review, dashboard, scheme explorer, local document checklist and tracker, profile/settings, and interactive assistant chat (`src/platform/*`).
- **Multilingual Support**: Supports English, Telugu, and Hindi UI copy and API interactions.
- **Privacy First**: Guest mode preserves patient privacy in local browser storage; cloud sync is opt-in with row-level security.

---

## Backend Setup & Run

### Prerequisites
- Python 3.11+
- PostgreSQL with `pgvector` extension (or Supabase project)

### Installation
From the workspace root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### Environment Configuration
Copy `backend/.env.example` to `backend/.env` and configure:
- `NERAVU_DB_TARGET=supabase` (or `local`)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_HOST`, `SUPABASE_DB_PORT`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`
- `SARVAM_API_KEY` (for Sarvam-2-105b Indic LLM generation)
- `GUEST_SESSION_SECRET` (32+ character random string for signing guest tokens)
- `DEV_ADMIN_TOKEN=1` (for Swagger testing in `APP_ENV=development`)

### Run Backend Server
```powershell
uvicorn app.main:app --reload --port 8000
```
- Interactive Swagger docs: `http://127.0.0.1:8000/docs`
- Health check: `http://127.0.0.1:8000/api/health`

### Run End-to-End Test Suite
```powershell
python backend/test_neravu_e2e.py
```

---

## API Summary

- **Chat**: `POST /api/chat` (Supports streaming SSE or JSON, with automatic intent routing across Urgent Medical, Cancer Knowledge, Scheme RAG, Eligibility, and Documents).
- **Guest Sessions**: `POST /api/guest-session` (Generates HMAC-signed guest session tokens).
- **Public Schemes**: `GET /api/schemes`, `GET /api/schemes/{scheme_id}`, `GET /api/schemes/{scheme_id}/journey`.
- **Eligibility Engine**: `POST /api/schemes/{scheme_id}/eligibility` (Deterministic tri-state rule evaluations).
- **Document Engine**: `POST /api/schemes/{scheme_id}/documents` (Evidence-backed document requirements).
- **Admin APIs**: `POST /api/admin/schemes`, `PUT /api/admin/schemes/{id}`, `POST /api/admin/schemes/{id}/evidence`, `POST /api/admin/schemes/{id}/reviews`, `POST /api/admin/schemes/{id}/publish`.
