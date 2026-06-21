# RepoLense

RepoLense helps you analyze code repositories and extract useful insights. It pairs a Python backend with a React frontend so you can run analyses locally, iterate quickly, and export reports.

Live demo: https://repo-lense-six.vercel.app/

Note about deployment: the frontend is hosted at the link above, but the project uses local file storage and a local database for development. That means some features that rely on persistent cloud storage (uploads, long-term artifacts, or background workers) may not work in the hosted preview — full production deployment requires configuring external storage and a production database.

## Quick project overview

- Purpose: analyze code repositories and surface metrics, reports, and AI-powered insights.
- Primary pieces: a Python backend (API + workers) and a React + TypeScript frontend (Vite).

## Workflow (developer)

1. Clone the repo and open it in your editor.
2. Backend (local dev):
   - `cd backend`
   - Create and activate a virtualenv (Windows example):

     ```powershell
     python -m venv .venv
     .venv\Scripts\activate
     pip install -r requirements.txt
     ```

   - Apply migrations (alembic is included):

     ```powershell
     alembic upgrade head
     ```

   - Start the API server:

     ```powershell
     uvicorn app.main:app --reload --port 8000
     ```

   - (Windows shortcut) you can also run `start.bat` from the `backend` folder.

3. Frontend (local dev):
   - `cd frontend`
   - `npm install`
   - `npm run dev` (starts Vite dev server)

4. Run tests:
   - Backend: from `backend` run `run_tests.bat` or `python -m unittest discover -s tests -v`.
   - Frontend: from `frontend` run `npm test`.

## Tech stack

- Backend: Python, FastAPI, SQLAlchemy, Alembic migrations
- Database: SQLite used for local development (migrations included). Configure a production DB (Postgres, etc.) for deployment.
- Frontend: React + TypeScript, Vite, Tailwind CSS
- Dev & infra: Docker / docker-compose files are included for local containers; CI/test scripts are in `scripts/` and the repo root.

## Deployment notes

- The frontend can be deployed independently (Vercel preview used for the demo link above).
- The current repo uses local filesystem storage and a local database for development — to fully deploy the app you should configure cloud storage (S3 or equivalent), a production database, and any background worker / scheduled job hosting required for long-running analyses.

## Contributing

- Open an issue with a short description and a reproduction case.
- For code changes: fork, branch, add tests, and open a pull request.

## Where to start

- To explore quickly: start the backend, then start the frontend and open the UI at the Vite address shown in the terminal. The API base URL is `http://127.0.0.1:8000` by default.

If you'd like, I can also add a short deployment checklist for moving from local dev to a cloud environment (S3 + Postgres + workers). 

Headers:

```text
Authorization: Bearer <paste-access-token-here>
```

### 8. Delete an analysis

Method:

```text
DELETE
```

URL:

```text
http://127.0.0.1:8000/analysis/<analysis-id>
```

Headers:

```text
Authorization: Bearer <paste-access-token-here>
```

Expected status:

```text
204 No Content
```

## Suggested Postman Order

1. `GET /health`
2. `POST /auth/register`
3. `POST /auth/verify`
4. `POST /auth/login`
5. copy the token
6. `POST /analysis/submit`
7. `GET /analysis/{analysis_id}/status`

## Notes

- Frontend tests use Vitest with Testing Library
- Backend tests use Python `unittest`, so no extra Python test dependency is required
- The auth API test uses a temporary SQLite database so it does not touch your real app data
- If frontend tests do not run immediately, run `npm install` inside `frontend` once to pull the new test packages
