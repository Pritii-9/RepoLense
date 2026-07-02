# RepoLense

> AI-powered GitHub repository analysis platform — delivering code health scores, architectural insights, semantic code search, and automated PR reviews.

**Live Demo:** [repo-lense-six.vercel.app](https://repo-lense-six.vercel.app)

---

## Overview

RepoLense is a full-stack SaaS application that performs deep static analysis on any public GitHub repository. Users submit a repository URL, and a background worker pipeline clones the repository, computes code quality metrics, generates AI-powered insights, detects the tech stack, and produces downloadable CSV and PDF reports — all surfaced through a real-time dashboard with WebSocket log streaming.

### Key Features

| Feature | Description |
|---|---|
| **Static Code Analysis** | Cyclomatic complexity, maintainability index, technical debt score, duplicate block detection |
| **AI-Powered Insights** | LLM-generated repository summary, code health score, architectural analysis (strengths, risks, recommendations) |
| **Tech Stack Detection** | Auto-detects languages, frameworks, and tooling from manifests and file structure |
| **Semantic Code Search** | RAG-based natural-language search over indexed repository files using ChromaDB vector embeddings |
| **AI PR Reviewer Bot** | Structured GitHub PR review with risk score, categorised findings table, and merge recommendation — posted as automated GitHub comments |
| **Real-time Log Streaming** | WebSocket-powered live terminal feed during analysis pipeline execution |
| **Telemetry Dashboard** | API request volume, latency metrics, AI token cost tracking, and slowest endpoint analytics |
| **GitHub OAuth** | One-click sign-in with GitHub; email/password auth with verification also supported |
| **Downloadable Reports** | CSV and PDF analysis reports stored in AWS S3 with signed download URLs |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Vercel (Frontend)                    │
│           React + TypeScript + Vite + Tailwind          │
└──────────────────────┬──────────────────────────────────┘
                       │  HTTPS / WebSocket
┌──────────────────────▼──────────────────────────────────┐
│                  AWS EC2 (Backend)                      │
│  ┌────────────────────────────────────────────────────┐ │
│  │  FastAPI (Uvicorn, 4 workers)                      │ │
│  │  • JWT + GitHub OAuth authentication               │ │
│  │  • Rate limiting (SlowAPI)                         │ │
│  │  • WebSocket manager                               │ │
│  │  • REST API + GitHub Webhook receiver              │ │
│  └──────────────────┬─────────────────────────────────┘ │
│                     │ Celery task dispatch              │
│  ┌──────────────────▼─────────────────────────────────┐ │
│  │  Celery Worker                                     │ │
│  │  • Clone repository (git)                          │ │
│  │  • Static analysis (radon)                         │ │
│  │  • Tech stack detection                            │ │
│  │  • LLM insight generation (OpenAI / Anthropic)     │ │
│  │  • ChromaDB vector indexing                        │ │
│  │  • S3 report upload                                │ │
│  │  • AI PR review generation & GitHub comment post   │ │
│  └────────────────────────────────────────────────────┘ │
└───────┬───────────────────────────┬─────────────────────┘
        │                           │
  ┌─────▼──────┐             ┌──────▼──────┐
  │ PostgreSQL  │             │ Upstash     │
  │ (RDS)       │             │ Redis       │
  └────────────┘             └─────────────┘
```

---

## Tech Stack

**Backend**
- [FastAPI](https://fastapi.tiangolo.com/) — async REST API and WebSocket server
- [Celery](https://docs.celeryq.dev/) — distributed background task queue
- [SQLAlchemy](https://www.sqlalchemy.org/) + [Alembic](https://alembic.sqlalchemy.org/) — async ORM with schema migrations
- [ChromaDB](https://www.trychroma.com/) — local vector store for semantic search (RAG)
- [Radon](https://radon.readthedocs.io/) — cyclomatic complexity and maintainability analysis
- [ReportLab](https://www.reportlab.com/) — PDF report generation
- [httpx](https://www.python-httpx.org/) — async GitHub API client
- PostgreSQL, Upstash Redis, AWS S3

**Frontend**
- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/) — utility-first styling
- [Recharts](https://recharts.org/) — metric trend charts
- [React Router v6](https://reactrouter.com/) — client-side routing

**Infrastructure**
- Docker + Docker Compose (production multi-service setup)
- GitHub Actions (CI pipeline)
- AWS EC2 (backend), Vercel (frontend)

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- PostgreSQL or SQLite (for local development)
- Redis (or [Upstash](https://upstash.com/) for managed Redis)

### Backend

```bash
cd backend

# 1. Create and activate virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
source .venv/bin/activate     # macOS / Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL, REDIS_URL, JWT_SECRET, GitHub tokens, etc.

# 4. Apply database migrations
alembic upgrade head

# 5. Start the API server
uvicorn app.main:app --reload --port 8000

# 6. Start the Celery worker (separate terminal)
celery -A app.celery_app worker --loglevel=info
```

Windows shortcut: run `start.bat` and `start_worker.bat` from the `backend` folder.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server starts at `http://localhost:5173`.

---

## Configuration

Copy `backend/.env.example` to `backend/.env` and populate the following:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (e.g. `postgresql+asyncpg://user:pass@host/db`) |
| `REDIS_URL` | Redis or Upstash connection URL |
| `JWT_SECRET` | Long random string for JWT signing |
| `GITHUB_TOKEN` | GitHub Personal Access Token (for cloning and PR API calls) |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `GITHUB_WEBHOOK_SECRET` | Secret set in GitHub repo → Settings → Webhooks |
| `AWS_ACCESS_KEY_ID` | AWS IAM key for S3 access |
| `AWS_SECRET_ACCESS_KEY` | AWS IAM secret |
| `S3_BUCKET_NAME` | S3 bucket for report storage |
| `OPENAI_API_KEY` | OpenAI key for LLM analysis (or use Anthropic/Groq) |
| `MAIL_*` | SMTP settings for email verification |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins |

---

## PR Reviewer Bot

RepoLense includes an AI-powered GitHub PR reviewer that automatically posts structured code review comments on Pull Requests.

### Automatic (via GitHub Webhook)

1. Go to your GitHub repository → **Settings → Webhooks → Add webhook**
2. Set the Payload URL to `https://your-ec2-ip/webhooks/github`
3. Set Content type to `application/json`
4. Set the Secret to the value of `GITHUB_WEBHOOK_SECRET` in your `.env`
5. Select the **Pull requests** event
6. Open or update a PR — the bot will post a review comment within ~30 seconds

### Manual Trigger (for testing / demos)

Use the API directly to fire a review on any public PR:

```bash
curl -X POST https://your-api/webhooks/github/trigger-review \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"repo_owner": "octocat", "repo_name": "Hello-World", "pr_number": 1}'
```

The bot will post a review comment with:
- **Risk score** (0–100)
- **Findings table** (Bug / Security / Performance / Style findings, each with severity)
- **Positive observations**
- **Merge recommendation** (APPROVE / REQUEST_CHANGES / NEEDS_DISCUSSION)

---

## API Reference

Base URL (local): `http://127.0.0.1:8000`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/health` | — | Health check |
| `POST` | `/auth/register` | — | Register with email + password |
| `POST` | `/auth/verify` | — | Verify email with OTP code |
| `POST` | `/auth/login` | — | Login, returns JWT |
| `GET` | `/auth/github` | — | GitHub OAuth login redirect |
| `POST` | `/analysis/submit` | ✅ | Submit a repository for analysis |
| `GET` | `/analysis/{id}/status` | ✅ | Poll analysis status and results |
| `DELETE` | `/analysis/{id}` | ✅ | Delete an analysis and its reports |
| `POST` | `/analysis/{id}/search` | ✅ | Semantic code search over indexed repo |
| `GET` | `/reports` | ✅ | List all reports |
| `POST` | `/cicd/pr-risk` | ✅ | CI/CD PR risk assessment from a diff |
| `POST` | `/webhooks/github` | Signature | GitHub webhook receiver |
| `POST` | `/webhooks/github/trigger-review` | ✅ | Manually trigger an AI PR review |
| `GET` | `/telemetry/metrics` | — | API and AI cost telemetry |

Full interactive API docs available at `/docs` (Swagger UI) when the server is running.

---

## Running Tests

**Backend:**
```bash
cd backend
python -m unittest discover -s tests -v
# or: run_tests.bat
```

**Frontend:**
```bash
cd frontend
npm test
```

---

## Production Deployment

The production setup uses Docker Compose with separate containers for the API (4 Uvicorn workers) and the Celery worker. Alembic migrations run automatically on startup.

```bash
# On your EC2 server
cd RepoLense/backend
git pull origin main
sudo docker compose -f docker-compose.prod.yml up -d --build
```

See [Architecture](#architecture) for the full infrastructure diagram.

> **Note:** The frontend (`/frontend`) is deployed independently to Vercel. The `vercel.json` rewrite rules proxy all `/api/*` requests to your EC2 backend, handling CORS transparently.

---

## Project Structure

```
RepoLense/
├── backend/
│   ├── app/
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── routers/         # FastAPI route handlers
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── services/        # Business logic (analyzer, LLM client, vector store, PR reviewer, stack detector)
│   │   └── utils/           # JWT, logging, password hashing
│   ├── alembic/             # Database migrations
│   ├── tests/               # Backend unit tests
│   ├── Dockerfile
│   ├── docker-compose.yml       # Local development
│   └── docker-compose.prod.yml  # Production
└── frontend/
    ├── src/
    │   ├── components/      # Reusable UI components
    │   ├── pages/           # Route-level page components
    │   ├── hooks/           # Custom React hooks
    │   ├── services/        # API client functions
    │   └── types/           # TypeScript interfaces
    ├── Dockerfile
    └── vercel.json
```

---

## Contributing

1. Fork the repository and create a feature branch.
2. Make changes with appropriate test coverage.
3. Open a pull request with a clear description of what changed and why.
4. The AI PR reviewer bot will automatically post a review on your PR.

---

## License

MIT
