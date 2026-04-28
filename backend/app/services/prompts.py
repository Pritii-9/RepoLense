from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class PromptTemplate:
    """Immutable prompt template with versioning metadata."""

    name: str
    version: str
    template: str
    variables: list[str]

    def format(self, **kwargs: object) -> str:
        """Substitute variables into the template."""
        return self.template.format(**kwargs)


REPO_SUMMARY_PROMPT = PromptTemplate(
    name="repo_summary",
    version="1.0",
    template="""You are a senior software engineer reviewing a codebase.

Repository: {repo_name}
URL: {repo_url}

Static Analysis Metrics:
- Files: {file_count}
- Lines: {line_count}
- Average Complexity: {avg_complexity}
- Max Complexity: {max_complexity}
- Maintainability Index: {maintainability}
- Technical Debt Score: {debt_score}/100
- Duplicate Blocks: {duplicate_blocks}

Top Complexity Hotspots:
{hotspots}

Provide a structured analysis following the exact JSON schema requested.
Be concise, specific, and actionable. Base your assessment on the metrics provided.
""",
    variables=[
        "repo_name",
        "repo_url",
        "file_count",
        "line_count",
        "avg_complexity",
        "max_complexity",
        "maintainability",
        "debt_score",
        "duplicate_blocks",
        "hotspots",
    ],
)

