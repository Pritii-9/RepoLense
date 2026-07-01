from slowapi import Limiter
from slowapi.util import get_remote_address
from .config import settings

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=settings.redis_url,
    storage_options={"ssl_cert_reqs": "none"} if "upstash" in settings.redis_url else {}
)
