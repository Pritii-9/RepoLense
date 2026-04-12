from __future__ import annotations

import asyncio
import re
import shutil
import tempfile
from pathlib import Path
from urllib.parse import quote

from app.config import settings


GITHUB_URL_PATTERN = re.compile(
    r"^(?:https://github\.com/|git@github\.com:)"
    r"(?P<owner>[A-Za-z0-9_.-]+)/(?P<repo>[A-Za-z0-9_.-]+?)(?:\.git)?/?$"
)


class RepositoryError(RuntimeError):
    """Raised when a repository cannot be cloned or inspected."""


def normalize_github_url(url: str) -> str:
    """Validate and normalize supported GitHub repository URLs."""

    cleaned_url = url.strip()
    match = GITHUB_URL_PATTERN.match(cleaned_url)
    if match is None:
        raise ValueError("Only valid GitHub repository URLs are supported.")
    owner = match.group("owner")
    repository = match.group("repo")
    return f"https://github.com/{owner}/{repository}"


def extract_repository_name(url: str) -> str:
    """Return the owner/repository slug for a GitHub URL."""

    normalized_url = normalize_github_url(url)
    return normalized_url.removeprefix("https://github.com/")


def _build_clone_url(url: str) -> str:
    normalized_url = normalize_github_url(url)
    repository_path = normalized_url.removeprefix("https://github.com/")
    if settings.github_token:
        token = quote(settings.github_token, safe="")
        return f"https://x-access-token:{token}@github.com/{repository_path}.git"
    return f"{normalized_url}.git"


async def _run_command(
    command: list[str],
    cwd: Path | None = None,
    timeout_seconds: int = 60,
) -> str:
    process = await asyncio.create_subprocess_exec(
        *command,
        cwd=str(cwd) if cwd else None,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            process.communicate(),
            timeout=timeout_seconds,
        )
    except asyncio.TimeoutError as exc:
        process.kill()
        await process.communicate()
        raise RepositoryError("Repository operation timed out.") from exc

    if process.returncode != 0:
        message = stderr.decode("utf-8", errors="ignore").strip() or stdout.decode(
            "utf-8",
            errors="ignore",
        ).strip()
        raise RepositoryError(message or "Repository operation failed.")
    return stdout.decode("utf-8", errors="ignore").strip()


async def clone_repository(repository_url: str, branch: str | None = None) -> Path:
    """Clone a repository shallowly into a temporary workspace."""

    workspace = Path(tempfile.mkdtemp(prefix="repolens-", dir=str(settings.temp_directory)))
    repository_path = workspace / "repository"

    command = [
        "git",
        "clone",
        "--depth",
        "1",
        "--single-branch",
        "--filter=blob:none",
    ]
    if branch:
        command.extend(["--branch", branch])
    command.extend([_build_clone_url(repository_url), str(repository_path)])

    await _run_command(command, timeout_seconds=settings.clone_timeout_seconds)
    return repository_path


async def get_commit_count(repository_path: Path) -> int:
    """Return the number of commits available in the shallow clone."""

    output = await _run_command(
        ["git", "rev-list", "--count", "HEAD"],
        cwd=repository_path,
        timeout_seconds=30,
    )
    return int(output or "0")


def cleanup_repository(repository_path: Path) -> None:
    """Remove the temporary repository workspace."""

    workspace = repository_path.parent if repository_path.name == "repository" else repository_path
    shutil.rmtree(workspace, ignore_errors=True)
