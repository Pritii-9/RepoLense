from app.routers.analysis import router as analysis_router
from app.routers.auth import router as auth_router
from app.routers.reports import router as reports_router

__all__ = ["analysis_router", "auth_router", "reports_router"]
