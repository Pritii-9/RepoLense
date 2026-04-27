# RepoLense AI Integration Architecture Guide

## Table of Contents
1. [Current Architecture Overview](#1-current-architecture-overview)
2. [AI Integration Strategy](#2-ai-integration-strategy)
3. [Phase 1: LLM Foundation & Structured Outputs](#phase-1-llm-foundation--structured-outputs)
4. [Phase 2: Embeddings & RAG Pipeline](#phase-2-embeddings--rag-pipeline)
5. [Phase 3: Prompt Engineering & Structured Outputs](#phase-3-prompt-engineering--structured-outputs)
6. [Phase 4: LLM Orchestration (LangChain/LangGraph/CrewAI)](#phase-4-llm-orchestration)
7. [Phase 5: AI Coding Assistants Integration](#phase-5-ai-coding-assistants-integration)
8. [Phase 6: AI Quality Metrics, Monitoring & Guardrails](#phase-6-ai-quality-metrics-monitoring--guardrails)
9. [Phase 7: Cost & Latency Optimization](#phase-7-cost--latency-optimization)
10. [Implementation Roadmap](#implementation-roadmap)
11. [Appendix: Code Examples](#appendix-code-examples)

---

## 1. Current Architecture Overview

### 1.1 System Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              REPOLENSE ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  FRONTEND (React + TypeScript + Vite + Tailwind + Recharts)                 │
│  ├── Dashboard.tsx        → Submit repos, view analysis history              │
│  ├── AnalysisDetail.tsx   → View metrics, charts, hotspots, trends           │
│  ├── Auth.tsx             → Login, register, email verification              │
│  └── Reports.tsx          → Download CSV/PDF reports                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  BACKEND (FastAPI + SQLAlchemy Async + Alembic + S3)                        │
│  ├── Routers                                                                              │
│  │   ├── auth_fixed.py    → JWT auth, email verification                     │
│  │   ├── analysis.py      → Submit analysis, check status                    │
│  │   └── reports.py       → Download reports, export metrics                 │
│  ├── Services                                                                             │
│  │   ├── code_analyzer.py → Static analysis (radon: complexity, MI, dupes)   │
│  │   ├── github_fetcher.py→ Clone repos shallowly from GitHub                │
│  │   ├── s3_handler.py    → Upload/download reports to S3                    │
│  │   └── report_exporter.py→ Generate CSV/JSON exports                       │
│  ├── Tasks                                                                                │
│  │   └── tasks.py         → Background pipeline: clone → analyze → upload    │
│  ├── Models                                                                               │
│  │   ├── analysis.py      → Analysis job metadata                            │
│  │   ├── code_metric.py   → Computed metrics (files, lines, complexity, etc) │
│  │   ├── report.py        → S3 report references                             │
│  │   └── user.py          → User accounts with is_verified flag              │
│  └── Config                                                                               │
│      └── config.py        → Settings (DB, JWT, AWS, GitHub token)            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Analysis Pipeline Flow

```
User submits repo URL
        ↓
[POST /analysis/submit]
        ↓
Create Analysis record (status=PENDING)
        ↓
Background task: run_analysis_pipeline()
        ↓
┌─────────────────┐
│ 1. clone_repository()  → Shallow git clone to temp dir
│ 2. get_commit_count()  → Count visible commits
│ 3. analyze_repository()→ Static code analysis
│    ├── _iter_source_files()      → Find source files
│    ├── _calculate_duplicate_blocks() → Detect code duplication
│    ├── _calculate_python_quality_metrics() → Radon complexity + MI
│    └── _calculate_technical_debt_score() → Weighted scoring
│ 4. Upload CSV/PDF to S3
│ 5. Persist CodeMetric + Report records
│ 6. Update Analysis status=COMPLETED
└─────────────────┘
        ↓
Frontend polls /analysis/{id}/status every 5s
        ↓
Display metrics, charts, hotspots in AnalysisDetail
```

### 1.3 Data Model

```
User (1) ───< Analysis (N) ───(1) CodeMetric
                    │
                    └──< Report (N)
```

**Current Metrics Computed:**
- `file_count`, `line_count`, `commit_count`
- `duplicate_block_count`, `duplicate_line_count`
- `average_cyclomatic_complexity`, `max_cyclomatic_complexity`
- `maintainability_index` (Python only, via radon)
- `technical_debt_score` (weighted formula)
- `hotspots[]` (top complex functions/classes)

### 1.4 Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend Framework | FastAPI 0.115 |
| ORM | SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Database | SQLite (dev) / PostgreSQL (prod via asyncpg) |
| Auth | python-jose + bcrypt |
| Email | fastapi-mail |
| Static Analysis | radon |
| PDF Generation | reportlab |
| Cloud Storage | boto3 (S3) |
| Frontend | React 18 + TypeScript + Vite |
| Styling | Tailwind CSS |
| Charts | Recharts |
| State | React Context + localStorage |

---

## 2. AI Integration Strategy

### 2.1 Why Add AI to RepoLense?

Current static analysis tells you **what** the code looks like (complexity, duplication) but not **why** it matters or **how** to fix it. AI integration adds:

| Capability | Value |
|-----------|-------|
| **Semantic Understanding** | Understand code intent, not just syntax |
| **Contextual Recommendations** | "This 47-complexity function violates SRP — split into 3 functions" |
| **Natural Language Q&A** | "What authentication pattern does this repo use?" |
| **Security Analysis** | Detect vulnerabilities static analyzers miss |
| **Documentation Gap Detection** | Find undocumented public APIs |
| **Architecture Review** | Identify design patterns, coupling, cohesion |
| **Trend Explanation** | "Technical debt increased 15% because of X commits" |

### 2.2 Integration Philosophy

**Principle: AI augments, not replaces, static analysis.**

Static analysis is fast, deterministic, and cheap. LLMs are slow, probabilistic, and expensive. The optimal architecture:

1. **Static analysis runs first** (fast, always works)
2. **LLM analysis runs in parallel/after** (rich insights, optional)
3. **User can view results independently** — static metrics load instantly, AI insights stream in
4. **AI features are gated** — rate limits, opt-in, clear cost indicators

### 2.3 High-Level Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TARGET: AI-ENHANCED REPOLENSE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  FRONTEND                                                                   │
│  ├── Dashboard (existing)                                                   │
│  ├── AnalysisDetail                                                         │
│  │   ├── Metrics & Charts (existing)                                        │
│  │   ├── AI Insights Panel     ← NEW: LLM-generated summary                 │
│  │   ├── Ask Repo Chat         ← NEW: RAG-based Q&A                        │
│  │   ├── Security Audit        ← NEW: Vulnerability findings                │
│  │   └── Code Suggestions      ← NEW: Copilot/Claude-style improvements     │
│  └── Reports (existing)                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  BACKEND                                                                    │
│  ├── Routers (existing + new)                                               │
│  │   ├── auth_fixed.py, analysis.py, reports.py                             │
│  │   ├── ai_insights.py       ← NEW: Get AI-generated insights              │
│  │   ├── rag.py               ← NEW: Semantic search + Q&A                  │
│  │   └── ai_chat.py           ← NEW: Streaming chat endpoint                │
│  ├── Services (existing + new)                                              │
│  │   ├── code_analyzer.py, github_fetcher.py, s3_handler.py                 │
│  │   ├── llm_client.py        ← NEW: Unified LLM client                     │
│  │   ├── prompts.py           ← NEW: Prompt templates                       │
│  │   ├── embedding_service.py ← NEW: Code → embeddings                      │
│  │   ├── vector_store.py      ← NEW: Vector DB interface                    │
│  │   ├── rag_pipeline.py      ← NEW: Retrieve + Generate                    │
│  │   ├── ai_monitoring.py     ← NEW: Track usage, cost, quality             │
│  │   ├── guardrails.py        ← NEW: Safety & validation                    │
│  │   └── orchestration/       ← NEW: LangGraph/CrewAI workflows             │
│  ├── Tasks                                                                  │
│  │   └── tasks.py             ← MODIFIED: Add AI analysis step              │
│  ├── Models                                                                 │
│  │   ├── analysis.py, code_metric.py, report.py, user.py                    │
│  │   ├── ai_insight.py        ← NEW: Store LLM outputs                      │
│  │   ├── llm_usage.py         ← NEW: Track token/cost per call              │
│  │   └── vector_embedding.py  ← NEW: Code chunk embeddings                  │
│  └── Config                                                                 │
│      └── config.py            ← MODIFIED: Add LLM API keys                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: LLM Foundation & Structured Outputs

### 1.1 Goal
Add a unified LLM client that can call OpenAI, Anthropic, or other providers, with support for structured (JSON/Pydantic) outputs. Generate AI-powered repository summaries as the first feature.

### 1.2 New Files

#### `backend/app/services/llm_client.py`

**Purpose:** Single interface for all LLM calls. Handles:
- Provider switching (OpenAI ↔ Anthropic)
- Retry logic with exponential backoff
- Timeout handling
- Token/cost tracking (pass to monitoring service)
- Structured output mode via `instructor`

**Design Pattern:** Strategy + Factory

```python
# ARCHITECTURE (pseudocode)

class LLMProvider(StrEnum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"

class LLMClient:
    def __init__(self, provider: LLMProvider, model: str):
        self.provider = provider
        self.model = model
        self._client = self._init_client()
        # Patch with instructor for structured outputs
        self._structured_client = instructor.from_openai(self._client)  # or anthropic equivalent

    async def generate(
        self,
        messages: list[dict],
        temperature: float = 0.3,
        max_tokens: int = 2000,
        timeout: float = 60.0,
    ) -> str:
        """Generate free-text response."""
        # Wrap with tenacity retry
        # Track latency, tokens, cost
        # Return text

    async def generate_structured(
        self,
        messages: list[dict],
        output_schema: type[T],
        temperature: float = 0.2,
        max_tokens: int = 4000,
    ) -> T:
        """Generate Pydantic-validated structured response."""
        # Use instructor to constrain output to schema
        # Track metrics
        # Return validated Pydantic object

    def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Return estimated USD cost for the call."""
```

**Key Decisions:**
- Use `temperature=0.2-0.3` for analysis tasks (more deterministic)
- Use `temperature=0.7` for creative suggestions
- Default to `gpt-4o` or `claude-3-sonnet` for analysis
- Use `gpt-4o-mini` or `claude-3-haiku` for simple summarization

#### `backend/app/services/prompts.py`

**Purpose:** Centralized prompt templates with versioning and A/B testing support.

```python
# ARCHITECTURE (pseudocode)

class PromptTemplate:
    name: str
    version: str
    template: str
    variables: list[str]

REPO_SUMMARY_PROMPT = PromptTemplate(
    name="repo_summary",
    version="1.0",
    template="""
You are a senior software engineer reviewing a codebase.

Repository: {repo_name}
URL: {repo_url}

Static Analysis Metrics:
- Files: {file_count}
- Lines: {line_count}
- Average Complexity: {avg_complexity}
- Max Complexity: {max_complexity}
- Maintainability Index: {maintainability}
- Technical Debt Score: {debt_score}/100
- Duplicate Blocks: {duplicate_blocks}

Top Complexity Hotspots:
{hotspots}

Provide a concise summary (max 300 words) covering:
1. Overall code health assessment
2. The most critical issue to address
3. One specific, actionable recommendation
""",
    variables=["repo_name", "repo_url", "file_count", "line_count", ...]
)

SECURITY_AUDIT_PROMPT = PromptTemplate(...)
ARCHITECTURE_REVIEW_PROMPT = PromptTemplate(...)
```

**Prompt Engineering Best Practices for RepoLense:**
1. **Include static metrics in context** — LLM needs quantitative grounding
2. **Use few-shot examples** for structured outputs (show expected JSON format)
3. **Chain-of-thought for complex analysis** — "First, identify patterns. Then, assess risks."
4. **Constrain output length** — Prevents token waste and improves latency
5. **Version prompts** — Track which prompt version produced which insight

#### `backend/app/schemas/llm_outputs.py`

**Purpose:** Pydantic schemas for structured LLM outputs. These define the contract between AI and the application.

```python
# ARCHITECTURE (pydantic schemas)

class SecurityIssue(BaseModel):
    severity: Literal["critical", "high", "medium", "low"]
    category: str  # e.g., "sql_injection", "hardcoded_secret"
    file_path: str
    line_number: int | None
    description: str
    remediation: str

class SecurityAuditResult(BaseModel):
    overall_risk_score: float = Field(ge=0, le=100)
    issues: list[SecurityIssue]
    summary: str = Field(max_length=500)

class ArchitecturePattern(BaseModel):
    pattern_name: str
    evidence: str
    assessment: Literal["well_implemented", "partial", "missing", "anti_pattern"]

class ArchitectureReview(BaseModel):
    patterns: list[ArchitecturePattern]
    tech_debt_areas: list[str]
    recommendations: list[str]
    coupling_assessment: str = Field(max_length=300)

class AiRepositorySummary(BaseModel):
    overview: str = Field(max_length=400, description="High-level repo description")
    strengths: list[str] = Field(max_length=5)
    risks: list[str] = Field(max_length=5)
    top_recommendations: list[str] = Field(max_length=3)
    code_health_score: float = Field(ge=0, le=100)
```

**Why Structured Outputs Matter:**
- Frontend can render components without parsing free text
- Enables database storage of specific fields (e.g., `overall_risk_score`)
- Allows filtering and sorting ("show only critical security issues")
- Reduces hallucination by constraining the output space

#### `backend/app/models/ai_insight.py`

**Purpose:** Store AI-generated insights linked to analyses.

```python
# ARCHITECTURE (SQLAlchemy model)

class AiInsight(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ai_insights"

    analysis_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("analyses.id", ondelete="CASCADE"), unique=True
    )
    insight_type: Mapped[str] = mapped_column(String(50))  # "summary", "security", "architecture"
    model_used: Mapped[str] = mapped_column(String(100))  # "gpt-4o", "claude-3-sonnet"
    prompt_version: Mapped[str] = mapped_column(String(20))

    # Structured data stored as JSON
    structured_data: Mapped[dict] = mapped_column(JSON, default=dict)

    # Raw text fallback
    raw_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Cost tracking
    input_tokens: Mapped[int] = mapped_column(Integer, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, default=0)
    estimated_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)

    analysis = relationship("Analysis", back_populates="ai_insights")
```

### 1.3 Modified Files

#### `backend/requirements.txt` — Add Dependencies

```
# LLM Clients
openai>=1.30.0
anthropic>=0.28.0
instructor>=1.0.0

# Retry & HTTP
httpx>=0.27.0
tenacity>=8.3.0

# Embeddings (Phase 2)
sentence-transformers>=3.0.0
chromadb>=0.5.0

# Orchestration (Phase 4)
langchain>=0.2.0
langchain-openai>=0.1.0
langgraph>=0.1.0
crewai>=0.30.0

# Monitoring & Guardrails (Phase 6)
presidio-analyzer>=2.2.0
presidio-anonymizer>=2.2.0

# Caching (Phase 7)
redis>=5.0.0
```

#### `backend/app/config.py` — Add LLM Settings

```python
class Settings(BaseSettings):
    # ... existing settings ...

    # LLM Configuration
    openai_api_key: str | None = Field(default=None, alias="OPENAI_API_KEY")
    anthropic_api_key: str | None = Field(default=None, alias="ANTHROPIC_API_KEY")
    default_llm_provider: str = Field(default="openai", alias="DEFAULT_LLM_PROVIDER")
    default_llm_model: str = Field(default="gpt-4o", alias="DEFAULT_LLM_MODEL")
    llm_max_tokens: int = Field(default=4000, alias="LLM_MAX_TOKENS")
    llm_timeout_seconds: float = Field(default=60.0, alias="LLM_TIMEOUT_SECONDS")
    llm_temperature: float = Field(default=0.3, alias="LLM_TEMPERATURE")

    # Feature Flags
    enable_ai_analysis: bool = Field(default=True, alias="ENABLE_AI_ANALYSIS")
    enable_ai_chat: bool = Field(default=True, alias="ENABLE_AI_CHAT")
    ai_rate_limit_per_hour: int = Field(default=50, alias="AI_RATE_LIMIT_PER_HOUR")

    # Vector DB (Phase 2)
    vector_db_path: str = Field(default="./vector_db", alias="VECTOR_DB_PATH")
    embedding_model: str = Field(default="text-embedding-3-small", alias="EMBEDDING_MODEL")
    embedding_dimensions: int = Field(default=1536, alias="EMBEDDING_DIMENSIONS")

    # Cost Controls
    max_ai_cost_per_analysis_usd: float = Field(default=0.50, alias="MAX_AI_COST_PER_ANALYSIS")
```

#### `backend/app/tasks.py` — Integrate AI Analysis

```python
# MODIFIED PIPELINE

async def run_analysis_pipeline(analysis_id: str) -> None:
    # ... existing static analysis ...

    # After static analysis completes, trigger AI analysis (non-blocking)
    if settings.enable_ai_analysis:
        background_tasks.add_task(
            run_ai_analysis,
            analysis_id=analysis_id,
            repository_path=repository_path,
            metrics=artifacts.metrics,
        )

async def run_ai_analysis(
    analysis_id: str,
    repository_path: Path,
    metrics: RepositoryAnalysisResult,
) -> None:
    """Run LLM-powered analysis on the repository."""
    llm = LLMClient(
        provider=LLMProvider(settings.default_llm_provider),
        model=settings.default_llm_model,
    )

    # 1. Generate Repository Summary
    summary_prompt = REPO_SUMMARY_PROMPT.format(
        repo_name=analysis.repository_name,
        repo_url=analysis.repository_url,
        file_count=metrics.file_count,
        line_count=metrics.line_count,
        avg_complexity=metrics.average_cyclomatic_complexity,
        max_complexity=metrics.max_cyclomatic_complexity,
        maintainability=metrics.maintainability_index,
        debt_score=metrics.technical_debt_score,
        duplicate_blocks=metrics.duplicate_block_count,
        hotspots=format_hotspots(metrics.hotspots),
    )

    summary = await llm.generate_structured(
        messages=[{"role": "user", "content": summary_prompt}],
        output_schema=AiRepositorySummary,
    )

    # 2. Security Audit (if Python files exist)
    security_prompt = SECURITY_AUDIT_PROMPT.format(
        file_list=get_top_files(repository_path, limit=20),
        code_snippets=get_critical_snippets(repository_path, metrics.hotspots),
    )

    security = await llm.generate_structured(
        messages=[{"role": "user", "content": security_prompt}],
        output_schema=SecurityAuditResult,
    )

    # 3. Store results
    async with AsyncSessionFactory() as session:
        session.add(AiInsight(
            analysis_id=analysis_id,
            insight_type="summary",
            model_used=llm.model,
            prompt_version=REPO_SUMMARY_PROMPT.version,
            structured_data=summary.model_dump(),
            input_tokens=summary.usage.prompt_tokens,
            output_tokens=summary.usage.completion_tokens,
            estimated_cost_usd=llm.estimate_cost(...),
            latency_ms=summary.latency_ms,
        ))
        # ... store security audit ...
        await session.commit()
```

### 1.4 Frontend Changes

#### `frontend/src/types/api.ts` — Add AI Types

```typescript
export interface AiInsightResponse {
  id: string
  analysis_id: string
  insight_type: 'summary' | 'security' | 'architecture' | 'documentation'
  model_used: string
  prompt_version: string
  structured_data: Record<string, unknown>
  raw_text: string | null
  input_tokens: number
  output_tokens: number
  estimated_cost_usd: number
  latency_ms: number
  created_at: string
  updated_at: string
}

export interface AiRepositorySummary {
  overview: string
  strengths: string[]
  risks: string[]
  top_recommendations: string[]
  code_health_score: number
}

export interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  file_path: string
  line_number: number | null
  description: string
  remediation: string
}

export interface SecurityAuditResult {
  overall_risk_score: number
  issues: SecurityIssue[]
  summary: string
}
```

#### `frontend/src/pages/AnalysisDetail.tsx` — Add AI Insights Panel

```tsx
// NEW SECTION in AnalysisDetail

<section className="grid gap-6">
  <Card title="AI Insights" description="Generated by {insight.model_used}">
    {aiInsights ? (
      <div className="space-y-4">
        {/* Code Health Score */}
        <div className="flex items-center gap-4">
          <CircularProgress value={summary.code_health_score} />
          <div>
            <p className="font-semibold">Code Health Score</p>
            <p className="text-sm text-slate-500">{summary.overview}</p>
          </div>
        </div>

        {/* Strengths */}
        <div>
          <h4 className="font-medium text-emerald-700">Strengths</h4>
          <ul className="mt-2 space-y-1">
            {summary.strengths.map((s) => (
              <li key={s} className="text-sm text-slate-600">• {s}</li>
            ))}
          </ul>
        </div>

        {/* Risks */}
        <div>
          <h4 className="font-medium text-rose-700">Risks</h4>
          <ul className="mt-2 space-y-1">
            {summary.risks.map((r) => (
              <li key={r} className="text-sm text-slate-600">• {r}</li>
            ))}
          </ul>
        </div>

        {/* Recommendations */}
        <div className="rounded-panel bg-primary-50 p-4">
          <h4 className="font-medium text-primary-800">Top Recommendations</h4>
          <ol className="mt-2 space-y-2">
            {summary.top_recommendations.map((rec, i) => (
              <li key={i} className="text-sm text-primary-700">
                {i + 1}. {rec}
              </li>
            ))}
          </ol>
        </div>

        {/* Cost indicator */}
        <p className="text-xs text-slate-400">
          Generated in {insight.latency_ms}ms • ~${insight.estimated_cost_usd.toFixed(4)}
        </p>
      </div>
    ) : (
      <EmptyState title="AI analysis pending" description="Insights will appear after analysis completes." />
    )}
  </Card>
</section>
```

---

## Phase 2: Embeddings & RAG Pipeline

### 2.1 Goal
Enable semantic code search and natural language Q&A over repositories. Users can ask: "How does authentication work?" or "Find all database query patterns."

### 2.2 Concept: RAG for Code

**RAG (Retrieval-Augmented Generation)** combines:
1. **Retrieval:** Find relevant code snippets using semantic similarity (embeddings)
2. **Generation:** LLM answers the question using retrieved snippets as context

**Why RAG for RepoLense?**
- LLMs have limited context windows (128K-200K tokens)
- Large repos exceed this limit
- RAG ensures the LLM only sees relevant code, improving accuracy and reducing cost

### 2.3 New Files

#### `backend/app/services/embedding_service.py`

**Purpose:** Convert code into vector embeddings.

```python
# ARCHITECTURE

class CodeChunker:
    """Split source code into semantically meaningful chunks."""

    def chunk_file(self, file_path: Path, content: str) -> list[CodeChunk]:
        """
        Strategy:
        1. Split by top-level definitions (functions, classes)
        2. For each definition, include docstring + signature + body (truncated)
        3. Add file-level metadata (imports, module docstring)
        4. Chunk size: ~1000 tokens per chunk (configurable)
        """

class EmbeddingService:
    """Generate embeddings for code chunks."""

    def __init__(self, model: str = "text-embedding-3-small"):
        self.client = openai.AsyncOpenAI()
        self.model = model

    async def embed_chunks(self, chunks: list[CodeChunk]) -> list[EmbeddingVector]:
        """Batch embed chunks. Returns list of (chunk_id, vector, metadata)."""
        # Batch size: 100 chunks per API call (OpenAI limit)
        # Use asyncio.gather for parallel batches

    async def embed_query(self, query: str) -> EmbeddingVector:
        """Embed a user query for similarity search."""
```

**Chunking Strategy for Code:**

| Chunk Type | Content | Max Tokens |
|-----------|---------|-----------|
| Function/Method | Signature + Docstring + First 50 lines of body | 800 |
| Class | Class signature + Docstring + Method signatures | 1000 |
| Module | Imports + Module docstring + Global constants | 600 |
| File Header | File path + Language + First 20 lines | 400 |

**Metadata per chunk:**
```python
class CodeChunk(BaseModel):
    id: str  # UUID
    file_path: str
    language: str  # python, javascript, etc.
    chunk_type: Literal["function", "class", "module", "file_header"]
    start_line: int
    end_line: int
    content: str
    entity_name: str | None  # Function/class name
    parent_class: str | None  # For methods
```

#### `backend/app/services/vector_store.py`

**Purpose:** Abstract vector database for storing and querying embeddings.

```python
# ARCHITECTURE

class VectorStore(ABC):
    """Abstract vector store interface."""

    @abstractmethod
    async def upsert(self, analysis_id: str, chunks: list[EmbeddedChunk]) -> None:
        """Store embeddings for an analysis."""

    @abstractmethod
    async def search(
        self,
        analysis_id: str,
        query_vector: list[float],
        top_k: int = 5,
        filters: dict | None = None,
    ) -> list[SearchResult]:
        """Semantic search within an analysis."""

    @abstractmethod
    async def delete(self, analysis_id: str) -> None:
        """Remove all embeddings for an analysis."""

class ChromaVectorStore(VectorStore):
    """ChromaDB implementation (local, no external service needed)."""
    # Uses chromadb.PersistentClient
    # One collection per analysis_id

class PineconeVectorStore(VectorStore):
    """Pinecone implementation (cloud, scalable)."""
    # Uses pinecone-client
    # Namespace per analysis_id
```

**Why ChromaDB for RepoLense?**
- Zero external dependencies (local SQLite-backed)
- Good for <100K chunks (typical for single-repo analysis)
- Easy to embed in Docker container
- Can migrate to Pinecone later without code changes (interface abstraction)

#### `backend/app/services/rag_pipeline.py`

**Purpose:** End-to-end RAG: query → embed → retrieve → generate answer.

```python
# ARCHITECTURE

class RAGPipeline:
    def __init__(
        self,
        embedding_service: EmbeddingService,
        vector_store: VectorStore,
        llm_client: LLMClient,
    ):
        self.embedding = embedding_service
        self.vector_store = vector_store
        self.llm = llm_client

    async def ask(
        self,
        analysis_id: str,
        question: str,
        chat_history: list[ChatMessage] | None = None,
    ) -> RAGResponse:
        """
        1. Embed the question
        2. Retrieve top-k relevant code chunks
        3. Build context window with chunks + question
        4. Generate answer with citations
        5. Return answer + source chunks
        """

    async def search(
        self,
        analysis_id: str,
        query: str,
        top_k: int = 10,
        language_filter: str | None = None,
    ) -> list[SearchResult]:
        """Pure semantic search (no LLM generation)."""
```

**RAG Prompt Template:**

```
