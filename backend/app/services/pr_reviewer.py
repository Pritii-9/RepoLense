"""PR Reviewer Service — fetches GitHub PR diffs, generates structured AI
code reviews, and posts them back as formatted GitHub comments.

Improvements over the original:
  - Structured review output (risk score, categorised findings, summary)
  - Token-aware diff truncation with a clear notice to the reviewer
  - Graceful fallback to plain-text if structured parsing fails
  - Bot signature with actionable footer
"""
from __future__ import annotations

import textwrap
from dataclasses import dataclass, field

import httpx
from pydantic import BaseModel, Field

from ..config import settings
from ..utils.logger import get_logger
from .llm_client import LLMClient

logger = get_logger(__name__)

# ── Structured output schema ──────────────────────────────────────────────────

class ReviewFinding(BaseModel):
    category: str = Field(description="One of: Bug, Security, Performance, Style, Best Practice, Suggestion")
    severity: str = Field(description="One of: Critical, High, Medium, Low, Info")
    file: str = Field(description="File path where the issue was found, or 'general'")
    description: str = Field(description="Concise explanation of the issue and how to fix it")


class StructuredPRReview(BaseModel):
    risk_score: int = Field(ge=0, le=100, description="Overall risk score 0-100 (100 = very risky)")
    summary: str = Field(description="1-2 sentence executive summary of the PR")
    findings: list[ReviewFinding] = Field(default_factory=list, description="List of specific issues found")
    positive_observations: list[str] = Field(default_factory=list, description="Things done well in this PR")
    merge_recommendation: str = Field(description="One of: APPROVE, REQUEST_CHANGES, NEEDS_DISCUSSION")


# ── GitHub API helpers ────────────────────────────────────────────────────────

MAX_DIFF_CHARS = 28_000  # ~7k tokens, safe for gpt-4o-mini context


async def fetch_pr_diff(repo_owner: str, repo_name: str, pr_number: int) -> str:
    """Fetches the unified diff of a GitHub Pull Request."""
    if not settings.github_token:
        logger.warning("pr_reviewer_no_token", extra={"repo": f"{repo_owner}/{repo_name}"})
        return ""

    url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/pulls/{pr_number}"
    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github.v3.diff",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, headers=headers)

    if response.status_code != 200:
        logger.error(
            "pr_diff_fetch_failed",
            extra={"status": response.status_code, "pr": pr_number, "repo": repo_name},
        )
        return ""

    return response.text


async def generate_ai_review(diff: str, repo_name: str) -> str | None:
    """Generates a structured AI code review from a git diff.

    Returns a markdown-formatted string ready to post as a GitHub comment.
    Falls back to a plain-text review if structured parsing fails.
    """
    if not diff or not diff.strip():
        return None

    truncated = False
    if len(diff) > MAX_DIFF_CHARS:
        diff = diff[:MAX_DIFF_CHARS]
        truncated = True

    system_prompt = textwrap.dedent("""
        You are an expert Senior Software Engineer performing a thorough code review.
        Analyse the git diff provided and return a structured JSON review.
        Focus on: bugs, security vulnerabilities, performance issues, bad practices,
        and missing error handling. Also note what was done well.
        Be specific: reference file names and line context where possible.
        Use severity levels: Critical, High, Medium, Low, Info.
    """).strip()

    user_prompt = (
        f"Review this Pull Request for the `{repo_name}` repository"
        + (" *(diff truncated to first 28k chars)*" if truncated else "")
        + f":\n\n```diff\n{diff}\n```"
    )

    llm = LLMClient(temperature=0.2)
    try:
        review_data, _ = await llm.generate_structured(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            output_schema=StructuredPRReview,
        )
        return _format_review_comment(review_data, repo_name, truncated)
    except Exception as exc:
        logger.warning("structured_review_failed_fallback", extra={"error": str(exc)})
        # Fallback: ask for plain markdown
        try:
            plain, _ = await llm.generate(
                messages=[
                    {"role": "system", "content": "You are a Senior SWE doing a code review. Use markdown. Be concise."},
                    {"role": "user", "content": user_prompt},
                ]
            )
            return plain
        except Exception as exc2:
            logger.error("pr_review_fallback_failed", extra={"error": str(exc2)})
            return None
    finally:
        await llm.close()


def _format_review_comment(review: StructuredPRReview, repo_name: str, truncated: bool) -> str:
    """Convert a StructuredPRReview into a rich GitHub markdown comment."""
    risk_emoji = (
        "🔴" if review.risk_score >= 70
        else "🟡" if review.risk_score >= 40
        else "🟢"
    )
    rec_emoji = {
        "APPROVE": "✅",
        "REQUEST_CHANGES": "🚫",
        "NEEDS_DISCUSSION": "💬",
    }.get(review.merge_recommendation, "💬")

    severity_order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3, "Info": 4}
    sorted_findings = sorted(
        review.findings, key=lambda f: severity_order.get(f.severity, 99)
    )

    lines: list[str] = [
        "## 🤖 RepoLense AI Code Review",
        "",
        f"> **Risk Score:** {risk_emoji} **{review.risk_score}/100** &nbsp;|&nbsp; "
        f"**Recommendation:** {rec_emoji} `{review.merge_recommendation}`",
        "",
        f"### 📋 Summary",
        review.summary,
        "",
    ]

    if truncated:
        lines += [
            "> ⚠️ *Note: The diff was large and was truncated to the first 28,000 characters for analysis.*",
            "",
        ]

    # Findings table
    if sorted_findings:
        lines += [
            "### 🔍 Findings",
            "",
            "| Severity | Category | File | Description |",
            "|----------|----------|------|-------------|",
        ]
        for f in sorted_findings:
            sev_icon = {"Critical": "🔴", "High": "🟠", "Medium": "🟡", "Low": "🔵", "Info": "⚪"}.get(f.severity, "⚪")
            desc = f.description.replace("|", "\\|").replace("\n", " ")
            lines.append(f"| {sev_icon} {f.severity} | {f.category} | `{f.file}` | {desc} |")
        lines.append("")

    # Positive observations
    if review.positive_observations:
        lines += ["### ✅ What's Done Well", ""]
        for obs in review.positive_observations:
            lines.append(f"- {obs}")
        lines.append("")

    lines += [
        "---",
        f"*🤖 Reviewed by [RepoLense](https://repo-lense-two.vercel.app) AI · "
        f"Powered by `{repo_name}`*",
    ]

    return "\n".join(lines)


async def post_pr_comment(
    repo_owner: str, repo_name: str, pr_number: int, comment: str
) -> bool:
    """Posts a markdown comment on a GitHub Pull Request issue thread."""
    if not settings.github_token:
        logger.warning("pr_comment_no_token")
        return False

    url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/issues/{pr_number}/comments"
    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(url, headers=headers, json={"body": comment})

    if response.status_code == 201:
        logger.info(
            "pr_comment_posted",
            extra={"repo": f"{repo_owner}/{repo_name}", "pr": pr_number},
        )
        return True

    logger.error(
        "pr_comment_post_failed",
        extra={"status": response.status_code, "body": response.text[:300]},
    )
    return False
