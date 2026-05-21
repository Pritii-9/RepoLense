import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Enum
from sqlalchemy.orm import relationship

from .base import Base


class ApiTelemetry(Base):
    __tablename__ = "api_telemetry"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    path = Column(String(255), nullable=False)
    method = Column(String(10), nullable=False)
    status_code = Column(Integer, nullable=False)
    latency_ms = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)

    # Optional: relate back to User if we want to trace a user's API calls
    user = relationship("User", backref="api_logs")


class AiTokenLog(Base):
    __tablename__ = "ai_token_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    model_name = Column(String(100), nullable=False)
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_cost = Column(Float, nullable=False, default=0.0)
    feature_name = Column(String(100), nullable=False)  # e.g. "repository_analysis", "chat"
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)

    user = relationship("User", backref="ai_logs")
