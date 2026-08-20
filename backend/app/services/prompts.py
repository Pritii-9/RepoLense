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

Metrics: {file_count} files, {line_count} lines, avg complexity {avg_complexity}, max complexity {max_complexity}, maintainability {maintainability}/100, debt {debt_score}/100, {duplicate_blocks} duplicate blocks.

Top hotspots:
{hotspots}

Respond ONLY with JSON using these exact keys:
{{"overview": "2-3 sentence summary", "strengths": ["..."], "risks": ["..."], "top_recommendations": ["..."], "code_health_score": 0-100, "critical_issue": "..."}}\n""",
    variables=[
        "repo_name", "repo_url", "file_count", "line_count",
        "avg_complexity", "max_complexity", "maintainability",
        "debt_score", "duplicate_blocks", "hotspots",
    ],
)


ARCHITECTURE_ANALYSIS_PROMPT = PromptTemplate(
    name="architecture_analysis",
    version="1.0",
    template="""You are an expert software architect.

Repository: {repo_name} ({repo_url})
Metrics: avg complexity {avg_complexity}, maintainability {maintainability}/100, debt {debt_score}/100.

Files sample:
{file_list}

Respond ONLY with JSON using these exact keys:
{{"tech_stack": {{"frontend": "...", "backend": "...", "database": "...", "devops": "..."}}, "design_patterns": ["..."], "scalability_score": 0-100, "modularization_description": "...", "architectural_notes": "..."}}\n""",
    variables=["repo_name", "repo_url", "file_list", "avg_complexity", "maintainability", "debt_score"],
)


CODE_CHAT_PROMPT = """You are a senior software engineer who has fully read and understands the repository: **{repo_name}** (URL: {repo_url}).
Your job is to answer questions about this specific repository's code, architecture, and tech stack.

Use the provided code context snippets below to form your answer.
If the context below contains relevant code, base your answer on it directly.
If the context is empty or says "No code context indexed yet", use the repository name, URL, and file structure patterns to make an educated, specific inference. Do NOT give a generic answer. Always name specific technologies you can infer from the repository name and URL.

Code Context (from indexed files):
{context}

Question: {question}

Answer (use Markdown formatting, be specific and helpful):"""


PR_RISK_ANALYSIS_PROMPT = PromptTemplate(
    name="pr_risk_analysis",
    version="1.0",
    template="""You are an expert DevSecOps engineer and senior code reviewer.
Analyze the following pull request diff and predict its risk level.

Repository: {repo_url}
Branch: {branch}

Diff:
```diff
{diff_text}
```

Evaluate the diff for:
1. Potential bugs or logic errors.
2. Security vulnerabilities (e.g., hardcoded secrets, injection risks).
3. Performance regressions (e.g., N+1 queries, memory leaks).
4. Code quality and maintainability.

Provide a structured analysis following the exact JSON schema requested.
Determine a risk score from 0 (completely safe) to 100 (highly critical/dangerous).
Assign a risk level: "Low", "Medium", or "High".
Provide a brief summary and a list of specific potential issues found.
Suggest the type of engineers who should review this (e.g., "Security Team", "Database Expert", "Frontend Lead").
""",
    variables=[
        "repo_url",
        "branch",
        "diff_text",
    ],
)
