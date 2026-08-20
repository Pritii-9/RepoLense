# RepoLense 🚀

[![Live Demo](https://img.shields.io/badge/Live%20Demo-repo--lense--two.vercel.app-blueviolet?style=for-the-badge&logo=vercel)](https://repo-lense-two.vercel.app)
[![Watch Demo Video](https://img.shields.io/badge/Demo%20Video-Google%20Drive-FF0000?style=for-the-badge&logo=googledrive)](https://drive.google.com/file/d/12k2Pr2A539v8wMihy5g9NyNqL5lCtYyx/view?usp=sharing)
[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

> **AI-Powered GitHub Repository Analysis & Code Intelligence Platform**  
> RepoLense performs deep static analysis on public GitHub repositories, offering real-time telemetry, cyclomatic complexity scores, RAG-based semantic code search, automated AI PR reviews, and instant PDF/CSV report generation.

---

## 🎬 Demo Video & Platform Screenshots

[![Watch Demo Video](https://img.shields.io/badge/▶%20Watch%20Demo%20Video-Google%20Drive-red?style=for-the-badge&logo=googledrive)](https://drive.google.com/file/d/12k2Pr2A539v8wMihy5g9NyNqL5lCtYyx/view?usp=sharing)

> 📹 **[Click here to watch the full RepoLense demo video on Google Drive](https://drive.google.com/file/d/12k2Pr2A539v8wMihy5g9NyNqL5lCtYyx/view?usp=sharing)**

### 🖥️ 1. Dashboard Overview
Submit GitHub repository URLs, monitor active/queued background tasks, and view recent analyses.

![Dashboard Overview](docs/screenshots/dashboard-overview.png)

### 📊 2. Repository Deep Dive & Code Metrics
Explore detailed metrics: files scanned, maintainability index, technical debt ratio, commit count, and detected tech stack tags.

![Repository Metrics](docs/screenshots/repository-metrics.png)

### 🧠 3. AI Insights & Architectural Analysis
LLM-generated code health scores, key repository strengths, maintenance risks, refactoring recommendations, design patterns, and architect's notes.

![AI Insights & Architecture](docs/screenshots/ai-insights-architecture.png)


---

## ✨ Core Features

| Feature | Description |
|---|---|
| 📊 **Static Code Quality Analysis** | Computes cyclomatic complexity, maintainability index, technical debt ratio, and duplicate code blocks using Radon. |
| 🤖 **AI-Powered Insights** | Generates executive summaries, health scores, architectural strengths, potential risks, and actionable refactoring suggestions. |
| 📦 **Tech Stack Detection** | Automatically detects underlying programming languages, frameworks, runtime environments, and tooling from package manifests and repository structure. |
| 🔍 **Semantic Code Search (RAG)** | Natural-language query search over indexed repository source code powered by **ChromaDB** vector embeddings. |
| 🤖 **Automated AI PR Reviewer** | Analyzes GitHub Pull Request diffs, posts risk assessments, bug & security finding tables, and merge recommendations directly onto GitHub PRs as comments. |
| ⚡ **Live Log Streaming** | WebSocket-driven live terminal logs giving real-time feedback during repository analysis and processing. |
| 📈 **Telemetry & AI Analytics** | Tracks API request volumes, latency distributions, token costs, and slowest endpoints via a rich visual telemetry dashboard. |
| 🔑 **OAuth & Email Auth** | Seamless 1-click GitHub OAuth sign-in along with email/password registration with OTP code verification. |
| 📄 **Exportable Reports** | Instant CSV & PDF report creation with secure download links stored in AWS S3. |

---

## 🏗️ System Architecture

```
                                  ┌─────────────────────────────────────────┐
                                  │            Vercel (Frontend)            │
                                  │      React + TypeScript + Vite +        │
                                  │     Tailwind CSS + Recharts + Lucide    │
                                  └────────────────────┬────────────────────┘
                                                       │  HTTPS / WebSockets
                                  ┌────────────────────▼────────────────────┐
                                  │            AWS EC2 (Backend)            │
                                  │  ┌───────────────────────────────────┐  │
                                  │  │  FastAPI (Uvicorn Async API)      │  │
                                  │  │  • JWT & GitHub OAuth Auth       │  │
                                  │  │  • Rate Limiting (SlowAPI)        │  │
                                  │  │  • WebSocket Log Manager          │  │
                                  │  │  • REST API & Webhooks Handler    │  │
                                  │  └─────────────────┬─────────────────┘  │
                                  │                    │ Task Queue          │
                                  │  ┌─────────────────▼─────────────────┐  │
                                  │  │  Celery Worker                    │  │
                                  │  │  • Git Repo Ingestion             │  │
                                  │  │  • Radon Static Metrics           │  │
                                  │  │  • OpenAI / Anthropic LLM Engine  │  │
                                  │  │  • ChromaDB Vector Store          │  │
                                  │  │  • ReportLab PDF / CSV Exporter   │  │
                                  │  │  • AWS S3 Storage Handler         │  │
                                  │  └───────────────────────────────────┘  │
                                  └──────┬──────────────────────┬───────────┘
                                         │                      │
                                  ┌──────▼──────┐        ┌──────▼──────┐
                                  │ PostgreSQL  │        │   Redis     │
                                  │ DB (RDS)    │        │ (Task Queue)│
                                  └─────────────┘        └─────────────┘
```

---

## 💻 Tech Stack

### Backend
- **Framework:** [FastAPI](https://fastapi.tiangolo.com/) (Python 3.11+)
- **Task Queue:** [Celery](https://docs.celeryq.dev/) + [Redis](https://redis.io/)
- **Database & ORM:** [PostgreSQL](https://www.postgresql.org/) + [SQLAlchemy](https://www.sqlalchemy.org/) + [Alembic](https://alembic.sqlalchemy.org/)
- **Vector Database (RAG):** [ChromaDB](https://www.trychroma.com/)
- **Code Analysis:** [Radon](https://radon.readthedocs.io/)
- **PDF Generation:** [ReportLab](https://www.reportlab.com/)
- **LLM Integrations:** OpenAI GPT-4o / Anthropic Claude / Groq via LangChain

### Frontend
- **Framework:** [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) + Glassmorphism UX
- **Data Visualization:** [Recharts](https://recharts.org/) + 3D Visualizer
- **Icons & UI:** Lucide React, Framer Motion

### DevOps & Infrastructure
- **Containers:** Docker & Docker Compose
- **Hosting:** AWS EC2 (Backend), Vercel (Frontend), AWS S3 (Report Storage)
- **CI/CD:** GitHub Actions

---

## 🚀 Quick Start Guide

### Option 1: Running with Docker Compose (Recommended)

Spins up the entire application stack (Frontend, FastAPI Backend, Celery Worker, PostgreSQL, and Redis) with a single command:

```bash
# 1. Clone the repository
git clone https://github.com/Pritii-9/RepoLense.git
cd RepoLense

# 2. Configure environment variables
cp backend/.env.example backend/.env

# 3. Start all services using Docker Compose
docker compose up --build
```

Access the applications:
- **Frontend Dashboard:** `http://localhost:4173`
- **FastAPI API Documentation:** `http://localhost:8000/docs`

---

### Option 2: Manual Local Development

#### Prerequisites
- **Python:** 3.11 or 3.12
- **Node.js:** v18 or later
- **PostgreSQL:** Server running locally or remote instance
- **Redis:** Server running locally or remote instance

#### 1. Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate environment
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create local environment configuration
cp .env.example .env
# Edit backend/.env with your DATABASE_URL, REDIS_URL, OPENAI_API_KEY, GITHUB_TOKEN, etc.

# Run database migrations
alembic upgrade head

# Start FastAPI API server
uvicorn app.main:app --reload --port 8000
```

In a separate terminal tab, activate `.venv` and start the background Celery worker:

```bash
cd backend
celery -A app.celery_app worker --loglevel=info
```

*(Windows developers can double-click `start.bat` and `start_worker.bat` in the `backend` folder).*

#### 2. Frontend Setup

```bash
cd frontend

# Install npm packages
npm install

# Start Vite development server
npm run dev
```

The frontend will start at `http://localhost:5173`.

---

## ⚙️ Environment Configuration

Copy `backend/.env.example` to `backend/.env` and specify the required configurations:

| Key | Mandatory | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (`postgresql+asyncpg://user:pass@host/db`) |
| `REDIS_URL` | Yes | Redis connection URL (`redis://localhost:6379/0`) |
| `SECRET_KEY` | Yes | Secret key used for JWT signing and session security |
| `OPENAI_API_KEY` | Yes | OpenAI API Key for AI static analysis & PR reviews |
| `GITHUB_TOKEN` | Yes | GitHub Personal Access Token for repository fetching & API access |
| `GITHUB_CLIENT_ID` | Optional | GitHub OAuth Client ID for 1-click login |
| `GITHUB_CLIENT_SECRET` | Optional | GitHub OAuth Client Secret |
| `GITHUB_WEBHOOK_SECRET` | Optional | Secret key for validating incoming GitHub webhook payloads |
| `AWS_ACCESS_KEY_ID` | Optional | AWS IAM Key ID for S3 report storage |
| `AWS_SECRET_ACCESS_KEY` | Optional | AWS IAM Secret Key |
| `S3_BUCKET_NAME` | Optional | Name of S3 bucket storing PDF/CSV exports |

---

## 🤖 GitHub PR Reviewer Bot Integration

RepoLense can automatically comment structured code reviews on incoming GitHub Pull Requests.

### Setting Up Webhooks
1. Open your GitHub Repository → **Settings** → **Webhooks** → **Add webhook**.
2. **Payload URL:** `https://<YOUR_API_DOMAIN>/webhooks/github`
3. **Content type:** `application/json`
4. **Secret:** Set to `GITHUB_WEBHOOK_SECRET` from your `.env`.
5. **Event trigger:** Select **Pull requests**.
6. Submit PR — RepoLense will automatically perform an AI review and post findings directly as a GitHub PR comment.

### Manual API Trigger
To test the PR review bot manually on any public repository PR:

```bash
curl -X POST http://localhost:8000/webhooks/github/trigger-review \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "repo_owner": "octocat",
    "repo_name": "Hello-World",
    "pr_number": 1
  }'
```

---

## 📖 API Endpoint Reference

Interactive documentation is accessible at `http://localhost:8000/docs` (Swagger UI).

| Method | Route | Description |
|---|---|---|
| `GET` | `/health` | API service health check |
| `POST` | `/auth/register` | User signup with email + password |
| `POST` | `/auth/verify` | Email verification using OTP |
| `POST` | `/auth/login` | User login (returns JWT token) |
| `GET` | `/auth/github` | Initiates GitHub OAuth authentication |
| `POST` | `/analysis/submit` | Enqueues a GitHub repository for deep analysis |
| `GET` | `/analysis/{id}/status` | Retrieves status & metrics for an analysis job |
| `DELETE` | `/analysis/{id}` | Deletes analysis record & associated files |
| `POST` | `/analysis/{id}/search` | Semantic RAG code search over analyzed repo |
| `GET` | `/reports` | Lists generated PDF/CSV reports |
| `POST` | `/cicd/pr-risk` | Evaluates PR risk from diff content |
| `POST` | `/webhooks/github` | Webhook listener for GitHub PR events |
| `GET` | `/telemetry/metrics` | Returns system request latency and token telemetry |

---

## 🧪 Testing

### Backend Unit Tests
```bash
cd backend
python -m unittest discover -s tests -v
```

### Frontend Build Validation
```bash
cd frontend
npm run build
```

---

## 📂 Directory Structure

```
RepoLense/
├── RepoLensDemo.mp4           # Demo video
├── docker-compose.yml         # Root Docker Compose orchestrator
├── README.md                  # Project documentation
├── backend/
│   ├── app/
│   │   ├── models/            # Database ORM models (SQLAlchemy)
│   │   ├── routers/           # FastAPI API routes & Webhooks
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── services/          # Analyzer, RAG vector store, PR bot, task recovery
│   │   └── utils/             # Security, JWT, logging utilities
│   ├── alembic/               # Database migrations
│   ├── tests/                 # Unit & integration test suite
│   ├── Dockerfile             # Backend container image build
│   └── requirements.txt       # Python dependencies
└── frontend/
    ├── src/
    │   ├── components/        # Dashboard, terminal, search & chart components
    │   ├── contexts/          # React Auth & Analysis Contexts
    │   ├── hooks/             # Custom React hooks
    │   ├── pages/             # Dashboard, Analysis detail, History pages
    │   └── services/          # API & WebSocket client
    ├── Dockerfile             # Frontend container image build
    └── package.json           # Node dependencies
```

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
