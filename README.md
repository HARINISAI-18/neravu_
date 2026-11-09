# Neravu - Cancer Care Financial Navigation & Assistance Platform

**Status**: Active development / Hackathon MVP  
**Repository**: https://github.com/HARINISAI-18/Neravu  

Neravu helps cancer patients and caregivers in India navigate financial and administrative assistance: discover programmes, understand possible eligibility, prepare documents, find official application routes, and ask questions in English, Telugu, or Hindi. It is an information and preparation tool, not a medical diagnostic service, a guarantee of funding, or an authority that decides eligibility.

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

### Deployment Architecture

- **Frontend (Vercel)**: Deployed as a high-performance Vite Single-Page Application (SPA). All client-side routes fallback to `/index.html` via `vercel.json`.
- **Backend (Render)**: Deployed as a dedicated Linux web service running FastAPI, Uvicorn, PyTorch, and Sentence-Transformers for hybrid RAG and voice features.
- **Connecting Frontend to Backend**: In your Vercel Project Settings &rarr; **Environment Variables**, set:
  ```env
  VITE_API_BASE_URL=https://<your-render-service-name>.onrender.com
  VITE_SUPABASE_URL=<your-supabase-url>
  VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
  ```

### Frontend Highlights
- **3D Cinematic Scroll Story**: Interactive GSAP ScrollTrigger timeline with articulated procedural characters representing the patient/caregiver journey (`src/scene/HospitalScene.jsx`).
- **Patient Assistance Platform**: Step-by-step assessment, review, dashboard, scheme explorer, local document checklist and tracker, profile/settings, and interactive assistant chat (`src/platform/*`).
- **Multilingual Support**: Offers the UI in English, Telugu, and Hindi.
- **Privacy First**: Guest mode preserves patient privacy in local browser storage; cloud sync is opt-in with row-level security.
- **Information Pages**: Public About, Security & Privacy, and Contact pages are available at `/about`, `/privacy`, and `/contact`. Contact opens a prefilled email draft; the site does not send the message.

### Generate UI translation drafts

The UI uses committed static catalogs. It does not call Azure Translator while a visitor uses the site. The English catalog is the source of truth; Telugu and Hindi translations already present in the source are retained, and Azure Translator fills missing strings for those supported languages.

Create an Azure AI Translator resource and configure its key and region only in your local shell. Never put Translator credentials in a `VITE_` variable, frontend file, or committed `.env` file:

```powershell
$env:AZURE_TRANSLATOR_TEXT_KEY = "your-translator-key"
$env:AZURE_TRANSLATOR_REGION = "your-resource-region"
npm run translate:ui
```

An optional `AZURE_TRANSLATOR_ENDPOINT` can be set for a non-default Translator endpoint. The command writes static catalogs to `src/platform/generatedTranslations.js`; review those machine-translated drafts with fluent speakers before release. The UI labels non-English catalogs as unreviewed drafts and falls back to English for any missing key.

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
- `SUPABASE_URL`, `SUPABASE_DATABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
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

### Index the scheme guide PDF
Apply the supplemental knowledge migration, then index the PDF stored at the root of the `neravu` Supabase Storage bucket:

```powershell
cd backend
alembic upgrade head
python ingest_storage_pdf.py
```

The backend environment must have `NERAVU_DB_TARGET=supabase`, `SUPABASE_DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` configured. Keep the service-role key server-side; never expose it in frontend environment variables. The script reads the private Storage object without saving it locally and records extracted PDF pages as **unverified** evidence until reviewed.

Scheme Q&A also retrieves from the legacy `knowledge_chunks` search function when available, plus the government scheme, NGO, state-research, source-register, and published-evidence tables. Unverified directory and legacy records are labeled in the supplied evidence and citations. Recommendation questions retrieve a broader comparison set and should not be treated as an eligibility decision.

### Scheme application guidance catalogue

The scheme explorer includes an offline, version-controlled catalogue built from the supplied scheme-journey and support-directory workbooks. It merges matching programme names and provides a dedicated detail page with the full 12 workbook application journeys, documents, contacts, official links, stuck-step guidance, source caveats, and the workbook's detailed research answers. Directory-only schemes are included too; the page identifies when the workbook did not provide numbered steps instead of inventing a procedure. The NGO directory includes all 16 workbook entries, supports offline search and filters, and merges live directory records when the API is available. NGO eligibility, restrictions, application/referral routes, verification and source notes are available on each card. Application-step checkmarks are saved with the user's existing local/cloud progress.

To rebuild the catalogue after updating either workbook, install `openpyxl` in a local Python environment and run:

```powershell
python scripts/import-scheme-workbooks.py `
  --journeys "C:\path\to\cancer_insurances_with_12_stepwise_procedures.xlsx" `
  --directory "C:\path\to\Neravu_India_Cancer_Support_Directory.xlsx" `
  --locale "mr=C:\path\to\cancer_insurances_with_12_stepwise_procedures marati.xlsx" `
  --locale "bn=C:\path\to\cancer_insurances_with_12_stepwise_procedures bengali.xlsx" `
  --locale "kn=C:\path\to\cancer_insurances_with_12_stepwise_procedures kannada.xlsx" `
  --locale "hi=C:\path\to\cancer_insurances_with_12_stepwise_procedures hindi.xlsx" `
  --locale "te=C:\path\to\cancer_insurances_with_12_stepwise_procedures telugu.xlsx" `
  --locale "ur=C:\path\to\cancer_insurances_with_12_stepwise_procedures urdu.xlsx" `
  --locale "pa=C:\path\to\cancer_insurances_with_12_stepwise_procedures punjabi.xlsx"
npm run test:scheme-guidance
```

The locale codes map to Marathi (`mr`), Bengali (`bn`), Kannada (`kn`), Hindi (`hi`), Telugu (`te`), Urdu (`ur`), and Punjabi (`pa`). The translated workbooks should contain the same sheet and row layout as the English journey workbook.

The importer writes a compact `src/platform/schemeCatalog.json` card index and one lazy-loaded JSON detail file per programme under `src/platform/schemeGuidance/`; it does not write to PostgreSQL or alter the published RAG index. Workbook entries are research aids, not an eligibility decision or guarantee of current funding. Review source-verification warnings and confirm current rules with the programme before advising applicants.

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
