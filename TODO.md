# Phase 1: LLM Foundation & AI-Powered Repository Summaries — Implementation Tracker

## Overview
Add a unified LLM client that can call OpenAI, Anthropic, or other providers, with support for structured (JSON/Pydantic) outputs. Generate AI-powered repository summaries as the first feature, with analytics (cost, tokens, latency) visible in the frontend.

---

## Steps

- [x] Step 0: Review codebase + AI integration guide
- [ ] Step 1: Add dependencies to `requirements.txt`
- [ ] Step 2: Add LLM settings to `config.py`
- [ ] Step 3: Create `backend/app/schemas/llm_outputs.py` — Pydantic schemas for structured outputs
- [ ] Step 4: Create `backend/app/services/prompts.py` — Prompt templates
- [ ] Step 5: Create `backend/app/services/llm_client.py` — Unified LLM client (OpenAI + Anthropic, retry, structured outputs, cost estimation)
- [ ] Step 6: Add `AiInsightType` enum to `backend/app/models/enums.py`
- [ ] Step 7: Create `backend/app/models/ai_insight.py` — SQLAlchemy model
- [ ] Step 8: Update `backend/app/models/analysis.py` — Add `ai_insights` relationship
- [ ] Step 9: Update `backend/app/models/__init__.py` — Export `AiInsight`
- [ ] Step 10: Create Alembic migration for `ai_insights` table
- [ ] Step 11: Update `backend/app/tasks.py` — Integrate AI summary generation into pipeline
- [ ] Step 12: Create `backend/app/routers/ai_insights.py` — GET endpoint
- [ ] Step 13: Update `backend/app/main.py` — Register new router
- [ ] Step 14: Update `backend/app/services/__init__.py` — Export new services
- [ ] Step 15: Update `frontend/src/types/api.ts` — Add AI insight types
- [ ] Step 16: Create `frontend/src/services/aiInsights.ts` — Fetch AI insights
- [ ] Step 17: Update `frontend/src/pages/AnalysisDetail.tsx` — Add AI Insights panel with analytics metadata (model, tokens, cost, latency)
- [ ] Step 18: Update `backend/app/schemas/analysis.py` — Include `ai_insights` in `AnalysisStatusResponse`
- [ ] Step 19: Final verification + README update

---

## Notes
- Analytics metadata (model used, input/output tokens, estimated cost USD, latency ms) must be visible in the frontend AI Insights panel.
- `instructor` library is not listed in requirements; implement structured outputs via JSON mode with Pydantic validation for simplicity and fewer dependencies.

