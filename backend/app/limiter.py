from slowapi import Limiter
from slowapi.util import get_remote_address
from .config import settings

# Use Redis storage if redis_url is set and not localhost in production, else fallback to memory
storage_uri = settings.redis_url
if settings.environment.lower() != "development" and "localhost" in settings.redis_url:
    storage_uri = "memory://"

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=storage_uri,
    storage_options={"ssl_cert_reqs": "none"} if "upstash" in storage_uri else {}
)
