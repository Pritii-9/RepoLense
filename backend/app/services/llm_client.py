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

logger = get_logger(__name__)

T = TypeVar("T", bound=BaseModel)


class LLMProvider(StrEnum):
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GROQ = "groq"

    @property
    def is_openai_compatible(self) -> bool:
        """Groq uses the same API format as OpenAI."""
        return self in (LLMProvider.OPENAI, LLMProvider.GROQ)

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
}


class LLMClient:
    """Unified async LLM client supporting OpenAI and Anthropic with structured outputs."""

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

    def _build_payload(
        self,
        messages: list[dict[str, str]],
        response_format: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if self.provider.is_openai_compatible:
            payload: dict[str, Any] = {
                "model": self.model,
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
                "model": self.model,
                "max_tokens": self.max_tokens,
                "temperature": self.temperature,
                "system": system_msg,
                "messages": user_messages,
            }
        else:
            raise ValueError(f"Unsupported provider: {self.provider}")

    def _extract_response_text(self, response_json: dict[str, Any]) -> str:
        if self.provider.is_openai_compatible:
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
                            elif self.provider == LLMProvider.ANTHROPIC:
                                # Anthropic streaming format is different
                                # For simplicity in this PR, we assume OpenAI/Groq compatibility
                                # (which covers GPT-4o, Groq Llama)
                                pass
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

    async def generate_structured(
        self,
        messages: list[dict[str, str]],
        output_schema: type[T],
    ) -> tuple[T, LLMCallMetrics]:
        """Generate a Pydantic-validated structured response using JSON mode."""

        if not self._api_key:
            raise ValueError(f"API key missing for provider: {self.provider}")

        if self.provider.is_openai_compatible:
            system_msg = (
                "You are a helpful assistant that always responds with valid JSON "
                f"matching this schema: {json.dumps(output_schema.model_json_schema())}. "
                "Do not include any markdown formatting, explanations, or code blocks. "
                "Respond with raw JSON only."
            )
            json_messages = [{"role": "system", "content": system_msg}] + messages
            # Note: Groq supports json_object mode too
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
            for i, msg in enumerate(messages):
                if i == len(messages) - 1 and msg.get("role") == "user":
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
            logger.error(
                "llm_schema_validation_failed",
                extra={
                    "provider": self.provider.value,
                    "model": self.model,
                    "parsed_json": json.dumps(parsed)[:1000],
                },
            )
            raise ValueError(f"LLM response failed schema validation: {exc}") from exc

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

        return result, metrics

    async def close(self) -> None:
        if self._client is not None:
            await self._client.aclose()
