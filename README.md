Status: Active development / hackathon MVP

Repository: https://github.com/HARINISAI-18/Neravu
This README is a handoff draft assembled from the development conversation and observed API/database outputs. It has not been merged into the live GitHub repository, and the repository tree was not audited. Confirm paths and dependency versions against the checked-out code before merging.

What Neravu does
Neravu helps cancer patients and caregivers in India navigate financial and administrative assistance: discover programmes, understand possible eligibility, prepare documents, find official application routes, and ask questions in English, Telugu and Hindi. It is an information and preparation tool, not a medical diagnostic service, a guarantee of funding, or an authority that decides eligibility.
Team split
Owner	Responsibilities
UI developer	React patient/caregiver UI; multilingual text chat; scheme explorer; checklists; accessible status and citation presentation; frontend integration; optional voice UI after API readiness
Backend/AI developer	FastAPI, Supabase data models, authenticated scheme management, evidence verification, publishing/versioning, sync jobs, RAG retrieval, Sarvam integration, rules/document/journey engines, tests, deployment
Shared	Agree API contracts, demo scope, privacy constraints, and acceptance tests; review high-risk content


Observed implementation status
Confirmed from logs / responses
- FastAPI starts with python -m uvicorn app.main:app --reload --port 8000.
- GET /health returned HTTP 200; /docs returned HTTP 200.
- POST /api/chat returned HTTP 200 with a Sarvam-generated answer, five source excerpts and verification_status: unverified.
- English and Telugu chat responses have been observed. Hindi remains to be validated.
- E5-small embedding model and BGE multilingual reranker weights loaded in the observed request.
- Supabase programmes query showed one record: PM-JAY, status draft, version 1. The previously discussed other three programmes are not confirmed imported.
- Supabase tables programme_versions, verification_reviews, sync_jobs exist, along with the original programme and RAG tables.
- PM-JAY ingestion earlier reported 70 knowledge chunks in Supabase.
Implemented or discussed, but needs verification
- GET /api/schemes and GET /api/schemes/{scheme_id} router code was provided. Swagger displayed the detail endpoint, but its request was seen loading; no successful detail response was confirmed.
- Generic eligibility rule evaluator files were previously created/tested; current integration and source verification not confirmed.
- SQL hybrid search function, full-text index and retrieval code were discussed/implemented; inspect live DB and repository for exact definitions.
Not built or not demonstrated
- Authenticated create/update/review/publish scheme APIs; admin dashboard; published-version isolation; background sync worker; claim-level factual validation; medical information collection; reliable application/document workflows; production security/deployment; full multilingual and safety regression tests.
Technology and architecture
Patient React UI                     Admin UI (planned)
       |                                    |
       +------------ FastAPI --------------+
                       |
                Question router (planned)
                 /       |          \
         Scheme RAG   Rules/docs    Medical RAG (planned)
          |                |                |
     Supabase PostgreSQL + pgvector + structured evidence
          |
   E5-small embeddings -> hybrid lexical/vector retrieval -> BGE reranker
          |
      Sarvam 105B answer generation -> claim validation (planned)
          |
      grounded response + citations + status + disclaimers

Admin draft -> official evidence -> human review -> published version
        -> sync jobs -> reindex/search + rules + document/journey data
- Backend: Python, FastAPI, SQLAlchemy, PostgreSQL/Supabase.
- Vector/lexical retrieval: pgvector (384-dimensional embeddings), PostgreSQL full-text search, reciprocal rank fusion (implementation should be verified).
- Embedding: intfloat/multilingual-e5-small; prefix documents with passage:  and questions with query: .
- Reranker: BAAI/bge-reranker-v2-m3 (large download/memory cost).
- LLM: Sarvam Token Factory OpenAI-compatible endpoint, model sarvam-105b.
- Frontend: React planned/in progress with UI owner; precise tooling not yet confirmed.
Known database tables
Existing:
- organizations
- programmes: id, programme_code, organization_id, official_name, programme_type, description, coverage JSONB, details JSONB, review_status, version, last_verified_at, timestamps.
- programme_sources: source title/URL, storage path, page reference, effective date, verified timestamp.
- eligibility_rules: programme ID, rule type/definition, explanation, source reference, verification status.
- document_requirements: document name, conditions, alternatives, source reference.
- knowledge_chunks: programme ID, source type/reference, chunk text, vector(384) embedding, model, timestamp, full-text fts.
Added and confirmed present:
- programme_versions: immutable snapshots per programme/version (intended).
- verification_reviews: pending/approved/rejected reviews and evidence.
- sync_jobs: pending/processing/completed/failed jobs for RAG, rules, documents and guidance.
Important: The presence of tables does not mean workflows or security policies have been tested. Review permissions, constraints, transactions and indexes.
Current record
programme_id:   3e1a22bf-fed3-4d06-9aae-6a00bd9daabe
programme_code: CSV-F64FDF5C58ACCF8E2112
name:           Ayushman Bharat Pradhan Mantri Jan Arogya Yojna (PMJAY)
review_status:  draft
version:        1
last_verified:  null
Local setup (Windows PowerShell)
The original developer used C:\Users\harini\Downloads\healthathon\backend and a Python virtual environment. Adapt the directory to your own clone.
git clone https://github.com/HARINISAI-18/Neravu.git
cd Neravu\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
# Use the repo's actual requirements file if present:
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
If requirements.txt is absent, the backend owner should generate and pin one from the tested environment. Do not assume the above command succeeds without inspecting the repository.

The existing services load .env from the project root (healthathon/.env, one level above backend). Create a local environment file with the variables expected by the code:
DATABASE_URL=postgresql://<db_user>:<db_password>@<db_host>:5432/<db_name>
SARVAM_API_KEY=<secret>
SARVAM_MODEL=sarvam-105b
SARVAM_BASE_URL=https://api.sarvam.ai/v2
Use the actual Supabase connection string and any pooler-specific port/settings supplied by Supabase. Never commit .env, credentials, patient identifiers or service-role keys. Confirm whether the app expects additional settings by inspecting the repository. Configure connection and statement timeouts; scheme GET requests were observed hanging/loading.
API contract — currently observed / expected
Method	Path	State
GET	/health	Confirmed HTTP 200
POST	/api/chat	Confirmed HTTP 200 for English and Telugu
GET	/api/schemes	Router provided; successful response not confirmed
GET	/api/schemes/{scheme_id}	Swagger registered; successful response not confirmed
POST/PATCH	/api/admin/schemes	Planned; admin auth required
POST	/api/admin/schemes/{id}/submit-review	Planned
POST	/api/admin/schemes/{id}/publish	Planned; only after evidence review


Chat request
{"question":"What financial assistance does PM-JAY provide?","language":"en"}
Supported language codes in current Pydantic model: en, te, hi. Response observed:
{
  "answer": "...",
  "language": "en",
  "sources": [{"chunk_id":"...","source_reference":"CSV-...","excerpt":"..."}],
  "verification_status": "unverified",
  "disclaimer": "This information is based on draft programme data..."
}
Frontend note: Do not assume a field called answer_status, intent, or a clickable source URL exists yet. Coordinate versioned contract changes with the backend developer.
Critical correctness issue already observed
An English answer misread source wording 70+ members as a household with 70 people rather than members aged 70 years or older. The Telugu response used age language but included loosely relevant banking information. This demonstrates that HTTP 200 and source citations do not prove factual correctness. Fix ambiguous source text, verify it against official evidence, regenerate affected embeddings, and test the same facts across languages. Do not publish draft content as verified.
Backend developer priorities
1. Audit repository and Supabase schema; reproduce GET and chat tests; resolve DB connection hangs.
2. Implement admin authentication/authorization, draft CRUD, audit trail and version snapshots.
3. Add evidence-level verification with human reviewer, source date, clause/page, review expiry, and publish gates.
4. Import remaining scheme records as drafts; verify authoritative evidence before publication.
5. Implement transactional publish + idempotent sync jobs + worker to refresh embeddings/rules/checklists; prevent stale content from serving as current.
6. Restrict patient-facing retrieval to approved published versions. Keep a separate explicit internal draft-test mode.
7. Improve chunk boundaries, hybrid search filters, relevance/abstention thresholds, citation linking and claim validation.
8. Add intent routing for scheme/eligibility/documents/journey/general medical information. General cancer education needs a separate curated source set and medical safety behavior; no diagnoses.
9. Test English/Telugu/Hindi and adversarial prompts, conflicting documents, absent evidence, outdated sources, and retrieval failure.
10. Implement rate limiting, secure logging, secrets management, backups, monitoring and deployment.
See Neravu_Backend_AI_Handoff.pdf for implementation sequence, acceptance criteria, and detailed ownership.
Definition of done for a reliable MVP
- A reviewer can create a draft, attach source evidence, approve or reject changes, and publish a new version.
- Patient search never treats drafts as verified; published content includes provenance and timestamps.
- Reindex jobs complete or expose a visible failed/pending state; old chunks do not silently remain active.
- Chat answers have citations that actually support key claims; missing evidence produces a safe unknown/abstention response.
- Critical numeric/age/eligibility facts match reviewed structured records in all supported languages.
- Backend API contracts are tested and stable enough for the UI owner.
- Privacy and safety requirements are tested before public deployment.
Collaboration
- Backend owner: keep API changes in OpenAPI/Swagger, supply sample JSON and error responses, notify UI owner of breaking changes.
- UI owner: build with mock fixtures for unfinished endpoints; clearly display draft/unknown states; do not show false verification badges.
- Agree a short daily integration checkpoint: routes, response schemas, deployment URLs, blockers, and test results.
Known limitations / next checks
- Only one scheme confirmed in programmes; additional schemes require import and review.
- Current chat answer uses draft questionnaire data, not approved public knowledge.
- The GitHub repository has not been inspected for this handoff; validate filenames, migrations, environment variables and current implementation before merge.
- Automated government application submission is not implemented; focus on application readiness and official navigation.