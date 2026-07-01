from celery import Celery
from .config import settings

celery_app = Celery(
    "repolens",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.tasks"]
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    broker_connection_retry_on_startup=True,
    
    # Isolate this project's tasks from your other project sharing the same Redis DB
    task_default_queue="repolense_tasks",
    broker_transport_options={"global_keyprefix": "repolense_"},
    result_backend_transport_options={"global_keyprefix": "repolense_"},
)
