@echo off
echo Starting RepoLens backend with venv uvicorn...
call .venv\Scripts\activate
.venv\Scripts\uvicorn app.main:app --reload --port 8000
