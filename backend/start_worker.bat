@echo off
echo Starting RepoLens Celery worker...
call .venv\Scripts\activate
.venv\Scripts\celery -A app.celery_app worker --loglevel=info --pool=solo
