# AI Insights UNIQUE Constraint Fix

## Steps:

1. [ ] Edit `backend/app/models/ai_insight.py`: Remove `unique=True` from `analysis_id` mapped_column.
2. [ ] Generate new Alembic migration: `cd backend && alembic revision --autogenerate -m "fix_ai_insights_unique_constraint"`.
3. [ ] Verify/edit new migration file to ensure it drops old unique on `analysis_id` and adds composite `UniqueConstraint("analysis_id", "insight_type")`.
4. [ ] Run migration: `cd backend && alembic upgrade head`.
5. [ ] Restart server with venv: `cd backend && .venv\Scripts\activate && uvicorn app.main:app --reload --port 8000`.
6. [ ] Test: Trigger new analysis or retry failed one; confirm no IntegrityError and multiple insights created.

Current step: 1
