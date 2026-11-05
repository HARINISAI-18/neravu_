

## Install and run

From this folder:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Production build

```bash
npm run build
npm run preview
```

## Notes

- The procedural characters now have articulated torsos, heads, arms, elbows, hands, legs and feet. Scroll-linked gestures cover bedside hand-holding and breathing, the caregiver's reception walk and question, an overwhelmed pose, guidance gestures, and the final bedside moment.
- These are still stylized procedural characters, not photorealistic humans. Film-quality anatomy, nuanced facial expression and natural cloth movement require licensed rigged GLB/GLTF character assets and authored motion-capture or keyframe animation.
- The GSAP ScrollTrigger timeline lives in `src/scene/HospitalScene.jsx`.
- The existing navigation, hero, feature section and human-support section are retained in `src/App.jsx`.

## Patient assistance platform

The existing React + Vite application now includes guest onboarding, a step-by-step assessment and review, a dashboard, scheme and NGO demo catalogues, a local document checklist and tracker, profile/settings pages, optional demo-mode login/signup screens, and an AI-assistant integration surface. The 3D landing-page story remains in place.

- In guest mode, assessment answers, language preference, checklist ticks and tracker progress are stored in this browser's local storage. This is not encrypted or an account backup; avoid using a shared device for sensitive information. Clear saved data from **My profile**.
- Scheme and NGO content is illustrative discovery data, not verified eligibility, availability, referral or application guidance. Confirm current details with the official programme or organization.
- Without Supabase environment variables, login/signup stays in demo mode and does not create accounts or send credentials. When configured, the login/signup screens use Supabase Auth.
- To enable accounts, create a Supabase project, run [`supabase/schema.sql`](./supabase/schema.sql) in its SQL Editor, copy `.env.example` to `.env.local`, and set the project URL and browser-safe publishable key (`sb_publishable_…`) or legacy anon key from **Project Settings → API**. Restart Vite after changing environment variables. Never put a secret key (`sb_secret_…`) or legacy `service_role` key in a `VITE_` variable or browser code; Vite embeds `VITE_` values in the client bundle. If a secret key was exposed, rotate it in Supabase.
- Email password reset, Google OAuth, and phone OTP sign-in/signup are available on the auth pages. Configure Google under **Authentication → Providers**, set the OAuth consent screen, and add Supabase’s callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) to the authorized redirect URIs in Google Cloud. In Supabase **Authentication → URL Configuration → Redirect URLs**, allow the local and deployed Neravu URLs (including `/login` and `/reset-password`). Enable Phone under **Authentication → Providers** and configure an SMS provider. Enter phone numbers in international E.164 format (for example `+919876543210`). Provider credentials and SMS costs/settings are managed in Supabase, not in Vite environment variables.
- Supabase Auth manages email/password credentials. Neravu does not create a password table. After sign-in, users must consent before progress sync; records are isolated with row-level security. Guest data remains in local browser storage until sync is enabled. If both cloud and device progress exist, the user chooses which copy to keep. Signing out clears the local copy but keeps account data. Chat transcripts are not synced to Supabase.
- Assessment answers include sensitive health information. Review the project’s privacy, consent, retention, access, hosting-region and applicable regulatory requirements before using real patient data. This initial client-side setup does not by itself establish healthcare or regulatory compliance.
- The AI assistant sends requests to Neravu's FastAPI backend only. Dify keys are server-side and are never placed in Vite variables or browser storage.

### Dify and FastAPI setup

The project has no prior FastAPI backend; the Dify proxy is in `backend/`. It calls Dify using `DIFY_APP_TYPE=advanced-chat` (`POST /chat-messages`) or `DIFY_APP_TYPE=workflow` (`POST /workflows/run`), with each mode's own request shape. Workflow apps execute independently and do not support Dify chat conversation continuity; use a Chatflow/Advanced Chat app when follow-up context is required.

1. Copy `backend/.env.example` to `backend/.env`.
2. Set `DIFY_API_BASE_URL` to `https://api.dify.ai/v1` for Dify Cloud, or your self-hosted API base URL; set `DIFY_API_KEY` to the app API key (not a knowledge-base API key); and set `DIFY_APP_TYPE` to `advanced-chat` or `workflow`.
3. In your Dify Chatflow, add a text input variable matching `DIFY_LANGUAGE_INPUT` (default: `language`) and use it in the answer-generation instructions. Require source-grounded answers in that language, preserve official scheme names/URLs/amounts/document names, state when the knowledge base is silent, never promise eligibility or funding, and direct medical emergencies to clinicians. Do not have the model translate or alter official URLs.
4. Set `GUEST_SESSION_SECRET` to a random secret of at least 32 characters. To allow signed-in sessions, also set `SUPABASE_URL` and the browser-safe `SUPABASE_ANON_KEY`; the backend verifies bearer access tokens with Supabase Auth and uses the verified UUID as Dify's `user`. Unauthenticated development chats receive a signed, stable guest identity.
5. Set `CORS_ORIGINS` to the exact deployed frontend origins. No credentials or wildcard origins are required for guest requests.
6. Install and start the backend from PowerShell:

   ```powershell
   cd backend
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   Copy-Item .env.example .env
   uvicorn app.main:app --reload
   ```

7. Start the frontend separately with `npm run dev`. Vite proxies `/api` to `http://127.0.0.1:8000`. For a separately hosted API, set the non-secret `VITE_API_BASE_URL` in the frontend `.env` to that API's origin and configure backend CORS. Never set `DIFY_API_KEY` in a `VITE_` variable.

`POST /api/chat` accepts `{ "message": "...", "conversation_id": null, "language": "en", "stream": true }`. Streaming uses Neravu SSE `delta`, `done`, and `error` events; `stream:false` returns JSON with `answer`, `conversation_id`, `message_id`, `sources`, and `status`. Dify conversation IDs are kept in tab session storage under the authenticated/guest identity; chat transcripts remain in memory and are not written to local storage or the Supabase progress table. Dify scopes each conversation using the verified per-user `user` ID. Starting a new chat clears that ID.

API checks: open `http://127.0.0.1:8000/docs` or `GET /api/health`; send a first PM-JAY query with `conversation_id: null`, then send a follow-up with the returned ID. Repeat with NGO, Telugu (`te`), Hindi (`hi`), and an out-of-KB question to confirm Dify responds in the configured language and admits when information is unavailable. Test `stream:false` for debugging and inspect `sources` only when Dify provides retrieval metadata. Use a deliberately invalid Dify key and a short `DIFY_READ_TIMEOUT_SECONDS` to verify sanitized credential/timeout errors. Use separate Supabase accounts to check that Dify receives different verified user IDs. Live provider behavior requires your Dify, Supabase and SMS/OAuth configuration; the local build cannot verify those credentials.

### Multilingual safety and translation status

Language preference is stored in the existing application state, synced with consented account progress, and sent on every Dify request. Assessment answers remain canonical internal values; translations affect labels only, so rules do not vary by language. The supplied scheme guide is English-only and was not present in the current workspace for structured extraction. The UI has partial English/Telugu/Hindi strings; Tamil, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi and Urdu currently fall back to English. A persistent notice identifies non-English copy as an unreviewed draft. Do not use translated scheme eligibility, amounts, exclusions or application requirements for patient decisions until the English source is matched and qualified translations are reviewed. There is currently no separate translation provider or translation API configured.
