"""Tech-stack detector: inspects a cloned repository and returns a list of
technology badges (language / framework / tool names) by parsing manifest files
and counting file-extension frequencies.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

# ── Badge definitions ──────────────────────────────────────────────────────────
# Each entry: (display_label, color_class)
# color_class maps to a Tailwind colour used by the frontend badge component.

LANG_EXTENSIONS: dict[str, tuple[str, str]] = {
    ".py":    ("Python",      "blue"),
    ".js":    ("JavaScript",  "yellow"),
    ".ts":    ("TypeScript",  "blue"),
    ".jsx":   ("React/JSX",   "cyan"),
    ".tsx":   ("React/TSX",   "cyan"),
    ".java":  ("Java",        "orange"),
    ".go":    ("Go",          "teal"),
    ".rb":    ("Ruby",        "red"),
    ".php":   ("PHP",         "violet"),
    ".cs":    ("C#",          "indigo"),
    ".c":     ("C",           "slate"),
    ".cpp":   ("C++",         "slate"),
    ".rs":    ("Rust",        "orange"),
    ".swift": ("Swift",       "orange"),
    ".kt":    ("Kotlin",      "violet"),
    ".scala": ("Scala",       "red"),
    ".html":  ("HTML",        "orange"),
    ".css":   ("CSS",         "blue"),
    ".scss":  ("SCSS",        "pink"),
}

SKIP_DIRS = {
    ".git", ".venv", "venv", "__pycache__",
    "node_modules", "dist", "build", ".mypy_cache",
    ".pytest_cache", "coverage",
}


# ── Manifest-based detectors ──────────────────────────────────────────────────

def _detect_from_package_json(path: Path) -> list[tuple[str, str]]:
    """Parse package.json and detect JS/TS frameworks + tooling."""
    badges: list[tuple[str, str]] = []
    try:
        data = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
    except Exception:
        return badges

    all_deps: set[str] = set()
    for key in ("dependencies", "devDependencies", "peerDependencies"):
        all_deps.update(data.get(key, {}).keys())

    framework_rules: list[tuple[str, str, str]] = [
        ("react",          "React",      "cyan"),
        ("next",           "Next.js",    "slate"),
        ("vue",            "Vue.js",     "green"),
        ("nuxt",           "@nuxt",      "green"),
        ("svelte",         "Svelte",     "orange"),
        ("angular",        "Angular",    "red"),
        ("express",        "Express",    "slate"),
        ("fastify",        "Fastify",    "slate"),
        ("nestjs",         "NestJS",     "red"),
        ("vite",           "Vite",       "violet"),
        ("webpack",        "Webpack",    "blue"),
        ("tailwindcss",    "Tailwind CSS","cyan"),
        ("prisma",         "Prisma",     "teal"),
        ("mongoose",       "MongoDB",    "green"),
        ("sequelize",      "Sequelize",  "blue"),
        ("typeorm",        "TypeORM",    "orange"),
        ("graphql",        "GraphQL",    "pink"),
        ("vitest",         "Vitest",     "yellow"),
        ("jest",           "Jest",       "red"),
    ]

    for pkg_key, label, color in framework_rules:
        if any(pkg_key in dep for dep in all_deps):
            badges.append((label, color))

    # Detect TypeScript
    if "typescript" in all_deps or any(d.startswith("@types/") for d in all_deps):
        badges.append(("TypeScript", "blue"))

    return badges


def _detect_from_requirements_txt(path: Path) -> list[tuple[str, str]]:
    badges: list[tuple[str, str]] = []
    try:
        text = path.read_text(encoding="utf-8", errors="ignore").lower()
    except Exception:
        return badges

    rules: list[tuple[str, str, str]] = [
        (r"fastapi",       "FastAPI",      "teal"),
        (r"django",        "Django",       "green"),
        (r"flask",         "Flask",        "slate"),
        (r"starlette",     "Starlette",    "teal"),
        (r"sqlalchemy",    "SQLAlchemy",   "orange"),
        (r"alembic",       "Alembic",      "orange"),
        (r"celery",        "Celery",       "green"),
        (r"pydantic",      "Pydantic",     "blue"),
        (r"uvicorn",       "Uvicorn",      "teal"),
        (r"gunicorn",      "Gunicorn",     "slate"),
        (r"redis",         "Redis",        "red"),
        (r"httpx",         "HTTPX",        "blue"),
        (r"aiohttp",       "aiohttp",      "blue"),
        (r"pytest",        "pytest",       "blue"),
        (r"tensorflow",    "TensorFlow",   "orange"),
        (r"torch",         "PyTorch",      "red"),
        (r"numpy",         "NumPy",        "blue"),
        (r"pandas",        "Pandas",       "violet"),
        (r"scikit",        "scikit-learn", "orange"),
        (r"langchain",     "LangChain",    "green"),
        (r"openai",        "OpenAI SDK",   "slate"),
        (r"anthropic",     "Anthropic SDK","slate"),
    ]

    for pattern, label, color in rules:
        if re.search(pattern, text):
            badges.append((label, color))

    return badges


def _detect_from_pyproject(path: Path) -> list[tuple[str, str]]:
    """Very lightweight pyproject.toml parser (no external deps)."""
    try:
        text = path.read_text(encoding="utf-8", errors="ignore").lower()
    except Exception:
        return []
    return _detect_from_requirements_txt_text(text)


def _detect_from_requirements_txt_text(text: str) -> list[tuple[str, str]]:
    """Re-usable inner logic for any plain-text dependency list."""
    return _detect_from_requirements_txt_inner(text)


def _detect_from_requirements_txt_inner(text: str) -> list[tuple[str, str]]:
    badges: list[tuple[str, str]] = []
    rules: list[tuple[str, str, str]] = [
        (r"fastapi",       "FastAPI",      "teal"),
        (r"django",        "Django",       "green"),
        (r"flask",         "Flask",        "slate"),
        (r"sqlalchemy",    "SQLAlchemy",   "orange"),
        (r"alembic",       "Alembic",      "orange"),
        (r"celery",        "Celery",       "green"),
        (r"pydantic",      "Pydantic",     "blue"),
        (r"redis",         "Redis",        "red"),
        (r"pytest",        "pytest",       "blue"),
    ]
    for pattern, label, color in rules:
        if re.search(pattern, text):
            badges.append((label, color))
    return badges


def _detect_infra(root: Path) -> list[tuple[str, str]]:
    """Check for infra/tooling config files."""
    badges: list[tuple[str, str]] = []
    checks: list[tuple[str, str, str]] = [
        ("Dockerfile",          "Docker",        "blue"),
        ("docker-compose.yml",  "Docker Compose","blue"),
        (".github/workflows",   "GitHub Actions","slate"),
        ("kubernetes",          "Kubernetes",    "blue"),
        ("k8s",                 "Kubernetes",    "blue"),
        ("terraform",           "Terraform",     "violet"),
        (".terraform",          "Terraform",     "violet"),
        ("Makefile",            "Make",          "slate"),
        ("nginx.conf",          "Nginx",         "green"),
        ("jest.config",         "Jest",          "red"),
        ("vitest.config",       "Vitest",        "yellow"),
        ("eslint",              "ESLint",         "violet"),
        ("prettier",            "Prettier",       "slate"),
        ("alembic.ini",         "Alembic",        "orange"),
    ]
    for file_fragment, label, color in checks:
        candidate = root / file_fragment
        if candidate.exists():
            badges.append((label, color))
    return badges


def _detect_db(root: Path) -> list[tuple[str, str]]:
    """Detect databases via env files or config references."""
    badges: list[tuple[str, str]] = []
    env_files = list(root.glob(".env*")) + list(root.glob("**/.env*"))
    combined = ""
    for ef in env_files[:5]:  # cap to avoid huge scans
        try:
            combined += ef.read_text(encoding="utf-8", errors="ignore").lower()
        except Exception:
            pass

    if "postgresql" in combined or "postgres" in combined:
        badges.append(("PostgreSQL", "blue"))
    if "mongodb" in combined or "mongo" in combined:
        badges.append(("MongoDB", "green"))
    if "mysql" in combined:
        badges.append(("MySQL", "orange"))
    if "sqlite" in combined:
        badges.append(("SQLite", "slate"))
    if "redis" in combined:
        badges.append(("Redis", "red"))
    if "upstash" in combined:
        badges.append(("Upstash", "green"))
    if "s3" in combined or "aws_" in combined:
        badges.append(("AWS S3", "orange"))

    return badges


# ── Main entry point ───────────────────────────────────────────────────────────

def detect_tech_stack(repository_path: Path) -> list[dict[str, str]]:
    """Detect the tech stack of a cloned repository.

    Returns a list of badge dicts:
        [{"label": "FastAPI", "color": "teal"}, ...]

    The list is de-duplicated and sorted alphabetically.
    """
    badges: list[tuple[str, str]] = []
    ext_counts: dict[str, int] = {}

    for root, dirs, files in repository_path.walk() if hasattr(repository_path, "walk") else _walk(repository_path):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]  # type: ignore[assignment]
        for fname in files:
            fpath = Path(root) / fname
            suffix = fpath.suffix.lower()
            if suffix in LANG_EXTENSIONS:
                ext_counts[suffix] = ext_counts.get(suffix, 0) + 1

            # Manifest parsing
            if fname == "package.json":
                badges += _detect_from_package_json(fpath)
            elif fname in ("requirements.txt", "requirements-dev.txt"):
                badges += _detect_from_requirements_txt(fpath)
            elif fname == "pyproject.toml":
                badges += _detect_from_pyproject(fpath)

    # Add top-3 languages by file count
    top_langs = sorted(ext_counts.items(), key=lambda x: x[1], reverse=True)[:3]
    for ext, _ in top_langs:
        label, color = LANG_EXTENSIONS[ext]
        badges.append((label, color))

    # Infra & DB detection
    badges += _detect_infra(repository_path)
    badges += _detect_db(repository_path)

    # De-duplicate (preserve first occurrence, keep order)
    seen: set[str] = set()
    unique: list[dict[str, str]] = []
    for label, color in badges:
        if label not in seen:
            seen.add(label)
            unique.append({"label": label, "color": color})

    unique.sort(key=lambda b: b["label"])
    return unique


def _walk(path: Path):
    """Fallback os.walk-style iterator for Python < 3.12."""
    import os
    for root, dirs, files in os.walk(path):
        yield Path(root), dirs, files
