from __future__ import annotations

import json
import time
from enum import StrEnum
from typing import Any, AsyncGenerator, TypeVar

import httpx
from pydantic import BaseModel, ValidationError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from ..config import settings
from ..utils.logger import get_logger
from ..db import AsyncSessionFactory
from ..models import AiTokenLog
import asyncio
from ..db import AsyncSessionFactory
from ..models import AiTokenLog
import asyncio

logger = get_logger(__name__)

T = TypeVar("T", bound=BaseModel)


class LLMProvider(StrEnum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GROQ = "groq"
    GEMINI = "gemini"

    @property
    def is_openai_compatible(self) -> bool:
        """Groq and Gemini use OpenAI compatible API endpoints."""
        return self in (LLMProvider.OPENAI, LLMProvider.GROQ, LLMProvider.GEMINI)

    @property
    def chat_url_path(self) -> str:
        return "/chat/completions" if self.is_openai_compatible else "/messages"


class LLMCallMetrics:
    """Tracks token usage, latency, and estimated cost for an LLM call."""

    def __init__(self) -> None:
        self.input_tokens: int = 0
        self.output_tokens: int = 0
        self.latency_ms: int = 0
        self.estimated_cost_usd: float = 0.0

    def to_dict(self) -> dict[str, float | int]:
        return {
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "latency_ms": self.latency_ms,
            "estimated_cost_usd": self.estimated_cost_usd,
        }


# Approximate pricing per 1M tokens (USD) — update as needed
_PRICING: dict[str, dict[str, float]] = {
    "gpt-4o": {"input": 5.00, "output": 15.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "claude-3-sonnet-20240229": {"input": 3.00, "output": 15.00},
    "claude-3-haiku-20240307": {"input": 0.25, "output": 1.25},
    # Groq (Approximate or free tier)
    "llama-3.3-70b-versatile": {"input": 0.59, "output": 0.79},
    "llama-3.1-8b-instant": {"input": 0.05, "output": 0.08},
    # Gemini
    "gemini-2.5-flash": {"input": 0.075, "output": 0.30},
    "gemini-1.5-flash": {"input": 0.075, "output": 0.30},
    "gemini-2.0-flash": {"input": 0.10, "output": 0.40},
}


class LLMClient:
    """Unified async LLM client supporting OpenAI, Anthropic, Groq, and Gemini with structured outputs."""

    def __init__(
        self,
        provider: LLMProvider | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> None:
        self.provider = LLMProvider(provider or settings.default_llm_provider)
        self.model = model or settings.default_llm_model
        self.temperature = temperature if temperature is not None else settings.llm_temperature
        self.max_tokens = max_tokens if max_tokens is not None else settings.llm_max_tokens
        self.timeout = timeout if timeout is not None else settings.llm_timeout_seconds

        self._client: httpx.AsyncClient | None = None
        self._api_key: str | None = None
        self._base_url: str = ""
        self._headers: dict[str, str] = {}
        self._init_provider()

    def _init_provider(self) -> None:
        if self.provider == LLMProvider.OPENAI:
            self._api_key = settings.openai_api_key
            self._base_url = "https://api.openai.com/v1"
            if self._api_key:
                self._headers = {
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                }
        elif self.provider == LLMProvider.ANTHROPIC:
            self._api_key = settings.anthropic_api_key
            self._base_url = "https://api.anthropic.com/v1"
            if self._api_key:
                self._headers = {
                    "x-api-key": self._api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                }
        elif self.provider == LLMProvider.GROQ:
            self._api_key = settings.groq_api_key
            self._base_url = "https://api.groq.com/openai/v1"
            if self._api_key:
                self._headers = {
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                }
        elif self.provider == LLMProvider.GEMINI:
            self._api_key = settings.gemini_api_key or settings.openai_api_key
            self._base_url = "https://generativelanguage.googleapis.com/v1beta"
            if self._api_key:
                self._headers = {
                    "x-goog-api-key": self._api_key,
                    "Content-Type": "application/json",
                }
        else:
            raise ValueError(f"Unsupported LLM provider: {self.provider}")

        if not self._api_key:
            logger.warning(
                "llm_api_key_missing",
                extra={"provider": self.provider.value, "model": self.model},
            )

        self._client = httpx.AsyncClient(timeout=self.timeout, headers=self._headers)

    def _estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        model_pricing = _PRICING.get(self.model, _PRICING.get("gpt-4o-mini", {"input": 0.0, "output": 0.0}))
        input_cost = (input_tokens / 1_000_000) * model_pricing["input"]
        output_cost = (output_tokens / 1_000_000) * model_pricing["output"]
        return round(input_cost + output_cost, 6)

    def _save_telemetry(self, metrics: LLMCallMetrics, feature: str = "general") -> None:
        """Fire and forget task to save AI tokens telemetry."""
        async def save():
            try:
                async with AsyncSessionFactory() as session:
                    log = AiTokenLog(
                        model_name=self.model,
                        prompt_tokens=metrics.input_tokens,
                        completion_tokens=metrics.output_tokens,
                        total_cost=metrics.estimated_cost_usd,
                        feature_name=feature,
                        user_id=None,
                    )
                    session.add(log)
                    await session.commit()
            except Exception as e:
                logger.error(f"Failed to save AiTokenLog: {e}")
        
        asyncio.create_task(save())

    def _build_payload(
        self,
        messages: list[dict[str, str]],
        response_format: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        model_name = self.model
        if self.provider == LLMProvider.GROQ:
            _GROQ_MODEL_MAP = {
                "compound": "groq/compound-mini",
                "compound-mini": "groq/compound-mini",
                "groq/compound": "groq/compound-mini",
                "groq/compound-mini": "groq/compound-mini",
                "llama3": "groq/compound-mini",
                "llama-3": "groq/compound-mini",
                "mixtral": "groq/compound-mini",
            }
            model_name = _GROQ_MODEL_MAP.get(model_name, model_name)

        if self.provider == LLMProvider.GEMINI:
            _GEMINI_MODEL_MAP = {
                "gemini": "gemini-1.5-flash",
                "flash": "gemini-1.5-flash",
                "pro": "gemini-1.5-flash",
                "gemini-2.5-flash": "gemini-1.5-flash",
                "gemini-1.5-flash": "gemini-1.5-flash",
            }
            model_name = _GEMINI_MODEL_MAP.get(model_name, model_name)

        if self.provider == LLMProvider.GEMINI:
            contents = []
            system_instruction = None
            for msg in messages:
                role = msg.get("role")
                content = msg.get("content", "")
                if not content:
                    continue
                if role == "system":
                    system_instruction = {"parts": [{"text": content}]}
                else:
                    gemini_role = "model" if role in ("assistant", "model") else "user"
                    # Merge consecutive same-role contents if needed
                    if contents and contents[-1]["role"] == gemini_role:
                        contents[-1]["parts"][0]["text"] += "\n" + content
                    else:
                        contents.append({
                            "role": gemini_role,
                            "parts": [{"text": content}]
                        })
            gen_config: dict[str, Any] = {
                "temperature": self.temperature,
                "maxOutputTokens": self.max_tokens,
            }
            if response_format and response_format.get("type") == "json_object":
                gen_config["responseMimeType"] = "application/json"

            payload_data: dict[str, Any] = {
                "contents": contents,
                "generationConfig": gen_config,
            }
            if system_instruction:
                payload_data["systemInstruction"] = system_instruction
            return payload_data
        elif self.provider.is_openai_compatible:
            payload: dict[str, Any] = {
                "model": model_name,
                "messages": messages,
                "temperature": self.temperature,
                "max_tokens": self.max_tokens,
            }
            if response_format:
                payload["response_format"] = response_format
            return payload
        elif self.provider == LLMProvider.ANTHROPIC:
            system_msg = ""
            user_messages: list[dict[str, str]] = []
            for msg in messages:
                if msg.get("role") == "system":
                    system_msg = msg.get("content", "")
                else:
                    user_messages.append(msg)

            return {
                "model": model_name,
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
                "system": system_msg,
                "messages": user_messages,
            }
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")

    def _extract_response_text(self, response_json: dict[str, Any]) -> str:
        if self.provider == LLMProvider.GEMINI:
            candidates = response_json.get("candidates", [])
            if candidates:
                parts = candidates[0].get("content", {}).get("parts", [])
                if parts:
                    return parts[0].get("text", "")
            return ""
        elif self.provider.is_openai_compatible:
            choices = response_json.get("choices", [])
            if not choices:
                return ""
            return choices[0].get("message", {}).get("content", "") or ""
        elif self.provider == LLMProvider.ANTHROPIC:
            content_blocks = response_json.get("content", [])
            texts: list[str] = []
            for block in content_blocks:
                if block.get("type") == "text":
                    texts.append(block.get("text", ""))
            return "\n".join(texts)
        return ""

    def _extract_token_usage(self, response_json: dict[str, Any]) -> tuple[int, int]:
        if self.provider == LLMProvider.GEMINI:
            usage = response_json.get("usageMetadata", {})
            return (
                int(usage.get("promptTokenCount", 0)),
                int(usage.get("candidatesTokenCount", 0)),
            )
        usage = response_json.get("usage", {})
        if self.provider.is_openai_compatible:
            return (
                int(usage.get("prompt_tokens", 0)),
                int(usage.get("completion_tokens", 0)),
            )
        elif self.provider == LLMProvider.ANTHROPIC:
            return (
                int(usage.get("input_tokens", 0)),
                int(usage.get("output_tokens", 0)),
            )
        return 0, 0

    @retry(
        retry=retry_if_exception_type((httpx.HTTPStatusError, httpx.NetworkError, httpx.TimeoutException)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )
    async def generate(
        self,
        messages: list[dict[str, str]],
    ) -> tuple[str, LLMCallMetrics]:
        """Generate a free-text response. Returns (text, metrics)."""

        if not self._api_key:
            raise ValueError(f"API key missing for provider: {self.provider}")

        if self._client is None:
            raise RuntimeError("LLM client not initialized")

        if self.provider == LLMProvider.GEMINI:
            model_name = self.model
            if "/" in model_name:
                model_name = model_name.split("/", 1)[1]
            _GEMINI_MODEL_MAP = {
                "gemini": "gemini-1.5-flash",
                "flash": "gemini-1.5-flash",
                "pro": "gemini-1.5-flash",
                "gemini-2.5-flash": "gemini-1.5-flash",
                "gemini-1.5-flash": "gemini-1.5-flash",
            }
            model_name = _GEMINI_MODEL_MAP.get(model_name, "gemini-1.5-flash")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={self._api_key}"
            payload = self._build_payload(messages)
        else:
            url = f"{self._base_url}{self.provider.chat_url_path}"
            payload = self._build_payload(messages)

        started = time.perf_counter()
        try:
            response = await self._client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "llm_http_error",
                extra={
                    "provider": self.provider.value,
                    "model": self.model,
                    "status_code": exc.response.status_code,
                    "response": exc.response.text[:500],
                },
            )
            raise

        latency_ms = int((time.perf_counter() - started) * 1000)
        text = self._extract_response_text(data)
        input_tokens, output_tokens = self._extract_token_usage(data)

        metrics = LLMCallMetrics()
        metrics.input_tokens = input_tokens
        metrics.output_tokens = output_tokens
        metrics.latency_ms = latency_ms
        metrics.estimated_cost_usd = self._estimate_cost(input_tokens, output_tokens)

        logger.info(
            "llm_call_completed",
            extra={
                "provider": self.provider.value,
                "model": self.model,
                "latency_ms": latency_ms,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "estimated_cost_usd": metrics.estimated_cost_usd,
            },
        )
        self._save_telemetry(metrics, feature="text_generation")
        return text, metrics

    async def generate_stream(
        self,
        messages: list[dict[str, str]],
    ) -> AsyncGenerator[str, None]:
        """Generate a streaming response. Yields text chunks."""

        if not self._api_key:
            raise ValueError(f"API key missing for provider: {self.provider}")

        if self._client is None:
            raise RuntimeError("LLM client not initialized")

        if self.provider == LLMProvider.GEMINI:
            model_name = self.model
            if "/" in model_name:
                model_name = model_name.split("/", 1)[1]
            _GEMINI_MODEL_MAP = {
                "gemini": "gemini-1.5-flash",
                "flash": "gemini-1.5-flash",
                "pro": "gemini-1.5-flash",
                "gemini-2.5-flash": "gemini-1.5-flash",
                "gemini-1.5-flash": "gemini-1.5-flash",
            }
            model_name = _GEMINI_MODEL_MAP.get(model_name, "gemini-1.5-flash")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:streamGenerateContent?alt=sse&key={self._api_key}"
            payload = self._build_payload(messages)

            try:
                async with self._client.stream("POST", url, json=payload) as response:
                    if response.status_code != 200:
                        await response.aread()
                        response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        if line.startswith("data: "):
                            data_str = line[6:].strip()
                        else:
                            data_str = line.strip()
                        if not data_str:
                            continue
                        try:
                            clean_str = data_str.rstrip(",").lstrip("[").rstrip("]")
                            if not clean_str:
                                continue
                            data = json.loads(clean_str)
                            candidates = data.get("candidates", [])
                            if candidates:
                                parts = candidates[0].get("content", {}).get("parts", [])
                                for part in parts:
                                    text = part.get("text", "")
                                    if text:
                                        yield text
                        except json.JSONDecodeError:
                            continue
            except Exception as exc:
                logger.warning(f"gemini_stream_fallback_to_generate: {exc}")
                try:
                    text, _ = await self.generate(messages)
                    yield text
                except Exception as gen_exc:
                    logger.error(f"llm_stream_and_generate_failed: {gen_exc}")
                    raise gen_exc
            return

        url = f"{self._base_url}{self.provider.chat_url_path}"
        payload = self._build_payload(messages)
        payload["stream"] = True

        try:
            async with self._client.stream("POST", url, json=payload) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        try:
                            data = json.loads(data_str)
                            if self.provider.is_openai_compatible:
                                choices = data.get("choices", [])
                                if choices:
                                    delta = choices[0].get("delta", {})
                                    content = delta.get("content", "")
                                    if content:
                                        yield content
                        except json.JSONDecodeError:
                            continue
        except httpx.HTTPStatusError as exc:
            logger.error(
                "llm_stream_error",
                extra={
                    "provider": self.provider.value,
                    "status_code": exc.response.status_code,
                },
            )
            raise

    @retry(
        retry=retry_if_exception_type((httpx.NetworkError, httpx.TimeoutException)),
        stop=stop_after_attempt(2),
        wait=wait_exponential(multiplier=1, min=2, max=5),
        reraise=True,
    )
    async def generate_structured(
        self,
        messages: list[dict[str, str]],
        output_schema: type[T],
    ) -> tuple[T, LLMCallMetrics]:
        """Generate a Pydantic-validated structured response using JSON mode."""

        if not self._api_key:
            raise ValueError(f"API key missing for provider: {self.provider}")

        # Ensure messages content is strictly within Groq free-tier payload limits (< 1500 chars)
        safe_messages = []
        for m in messages:
            content = m.get("content", "")
            if len(content) > 1500:
                content = content[:1500] + "\n...(truncated for length)"
            safe_messages.append({"role": m.get("role", "user"), "content": content})

        if self.provider == LLMProvider.GEMINI:
            model_name = self.model
            if "/" in model_name:
                model_name = model_name.split("/", 1)[1]
            _GEMINI_MODEL_MAP = {
                "gemini": "gemini-1.5-flash",
                "flash": "gemini-1.5-flash",
                "pro": "gemini-1.5-flash",
                "gemini-2.5-flash": "gemini-1.5-flash",
                "gemini-1.5-flash": "gemini-1.5-flash",
            }
            model_name = _GEMINI_MODEL_MAP.get(model_name, "gemini-1.5-flash")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
            schema_instruction = (
                "\n\nYou MUST respond with valid JSON using this exact schema structure: "
                f"{json.dumps(output_schema.model_json_schema())}. "
                "Output raw JSON only without markdown formatting."
            )
            gemini_messages = []
            for i, msg in enumerate(safe_messages):
                if i == len(safe_messages) - 1:
                    gemini_messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "") + schema_instruction})
                else:
                    gemini_messages.append(msg)
            payload = self._build_payload(gemini_messages, response_format={"type": "json_object"})
        elif self.provider.is_openai_compatible:
            system_msg = (
                "You are an AI assistant that responds only with valid JSON. "
                "Do not include any markdown formatting, explanations, or code blocks. Output raw JSON."
            )
            json_messages = [{"role": "system", "content": system_msg}] + safe_messages
            response_format = {"type": "json_object"}

            payload = self._build_payload(json_messages, response_format=response_format)
            url = f"{self._base_url}{self.provider.chat_url_path}"
        else:
            # Anthropic fallback: append schema instructions to the last user message
            schema_instruction = (
                "\n\nYou must respond with valid JSON matching this schema: "
                f"{json.dumps(output_schema.model_json_schema())}. "
                "Respond with raw JSON only, no markdown."
            )
            modified_messages = []
            for i, msg in enumerate(safe_messages):
                if i == len(safe_messages) - 1 and msg.get("role") == "user":
                    modified_messages.append(
                        {"role": "user", "content": msg.get("content", "") + schema_instruction}
                    )
                else:
                    modified_messages.append(msg)
            payload = self._build_payload(modified_messages)
            url = f"{self._base_url}/messages"

        if self._client is None:
            raise RuntimeError("LLM client not initialized")

        started = time.perf_counter()
        try:
            response = await self._client.post(url, json=payload)
            if response.status_code == 413:
                logger.warning("llm_413_payload_too_large_retrying_truncated")
                for msg in payload.get("messages", []):
                    if isinstance(msg.get("content"), str) and len(msg["content"]) > 1000:
                        msg["content"] = msg["content"][:1000] + "\n...(truncated)"
                response = await self._client.post(url, json=payload)
            if response.status_code == 429:
                retry_after = int(response.headers.get("retry-after", "10"))
                logger.warning("llm_429_rate_limited_backing_off", extra={"retry_after_s": retry_after})
                await asyncio.sleep(retry_after)
                response = await self._client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "llm_structured_http_error",
                extra={
                    "provider": self.provider.value,
                    "model": self.model,
                    "status_code": exc.response.status_code,
                    "response": exc.response.text[:500],
                },
            )
            raise

        latency_ms = int((time.perf_counter() - started) * 1000)
        raw_text = self._extract_response_text(data)
        input_tokens, output_tokens = self._extract_token_usage(data)

        # Clean up markdown code fences if present
        cleaned = raw_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        try:
            parsed = json.loads(cleaned)
        except json.JSONDecodeError as exc:
            logger.error(
                "llm_json_parse_failed",
                extra={
                    "provider": self.provider.value,
                    "model": self.model,
                    "raw_text": raw_text[:1000],
                },
            )
            raise ValueError(f"Failed to parse LLM response as JSON: {exc}") from exc

        try:
            result = output_schema.model_validate(parsed)
        except ValidationError as exc:
            logger.warning(
                "llm_schema_validation_partial",
                extra={
                    "provider": self.provider.value,
                    "model": self.model,
                    "error": str(exc)[:300],
                    "parsed_json": json.dumps(parsed)[:500],
                },
            )
            # Try to salvage the response using lenient construction
            try:
                result = output_schema.model_validate(parsed, strict=False)
            except Exception:
                # Last resort: construct with whatever fields are available
                result = output_schema.model_construct(**{
                    k: v for k, v in parsed.items()
                    if k in output_schema.model_fields
                })

        metrics = LLMCallMetrics()
        metrics.input_tokens = input_tokens
        metrics.output_tokens = output_tokens
        metrics.latency_ms = latency_ms
        metrics.estimated_cost_usd = self._estimate_cost(input_tokens, output_tokens)

        logger.info(
            "llm_structured_call_completed",
            extra={
                "provider": self.provider.value,
                "model": self.model,
                "latency_ms": latency_ms,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "estimated_cost_usd": metrics.estimated_cost_usd,
            },
        )
        self._save_telemetry(metrics, feature="structured_generation")
        return result, metrics

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
