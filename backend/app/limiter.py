from slowapi import Limiter
from slowapi.util import get_remote_address
from .config import settings

def get_client_identifier(request) -> str:
    """Identify clients behind reverse proxies (like Vercel or Cloudflare)."""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip
    return get_remote_address(request)

# Use Redis storage if redis_url is set and not localhost in production, else fallback to memory
storage_uri = settings.redis_url
if settings.environment.lower() != "development" and "localhost" in settings.redis_url:
    storage_uri = "memory://"

limiter = Limiter(
    key_func=get_client_identifier,
    storage_uri=storage_uri,
    storage_options={"ssl_cert_reqs": "none"} if "upstash" in storage_uri else {}
)
