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


ARCHITECTURE_ANALYSIS_PROMPT = PromptTemplate(
    name="architecture_analysis",
    version="1.0",
    template="""You are an expert software architect. Analyze the provided repository metrics and file list to infer the system architecture, design patterns, and tech stack.

Repository: {repo_name}
URL: {repo_url}

Files in Repository:
{file_list}

Static Analysis Metrics:
- Average Complexity: {avg_complexity}
- Maintainability Index: {maintainability}
- Technical Debt Score: {debt_score}/100

Provide a deep architectural breakdown:
1. Primary Tech Stack (Backend, Frontend, DB, DevOps).
2. Design Patterns identified (e.g., MVC, Repository, Microservices, Monolith).
3. System Scalability and Performance assessment based on complexity hotspots.
4. Modularization Strategy (how the code is organized).

Respond with valid JSON following the requested schema.
""",
    variables=[
        "repo_name",
        "repo_url",
        "file_list",
        "avg_complexity",
        "maintainability",
        "debt_score",
    ],
)


CODE_CHAT_PROMPT = """You are a senior developer who knows this repository inside and out.
Use the provided context from the codebase to answer the user's question.

If the answer is not in the context, say you don't know, but try to infer based on common patterns in the repo if possible.

Context:
{context}

Question: {question}

Response (Markdown):"""

