from __future__ import annotations

import csv
import hashlib
import io
import os
import re
from collections import deque
from dataclasses import dataclass
from pathlib import Path

from radon.complexity import cc_visit
from radon.metrics import mi_visit
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from app.config import settings


SOURCE_EXTENSIONS = {
    ".py",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".java",
    ".go",
    ".rb",
    ".php",
    ".cs",
    ".c",
    ".cc",
    ".cpp",
    ".h",
    ".hpp",
    ".swift",
    ".kt",
    ".rs",
    ".scala",
}
PYTHON_EXTENSIONS = {".py"}
SKIP_DIRECTORIES = {
    ".git",
    ".venv",
    "venv",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".mypy_cache",
    ".pytest_cache",
}
WHITESPACE_PATTERN = re.compile(r"\s+")


@dataclass(slots=True)
class ComplexityHotspot:
    file_path: str
    entity_name: str
    complexity: int
    line_number: int


@dataclass(slots=True)
class RepositoryAnalysisResult:
    file_count: int
    line_count: int
    commit_count: int
    duplicate_block_count: int
    duplicate_line_count: int
    average_cyclomatic_complexity: float
    max_cyclomatic_complexity: int
    maintainability_index: float
    technical_debt_score: float
    hotspots: list[ComplexityHotspot]


@dataclass(slots=True)
class AnalysisArtifacts:
    metrics: RepositoryAnalysisResult
    csv_bytes: bytes
    pdf_bytes: bytes
    csv_file_name: str
    pdf_file_name: str


def _iter_source_files(repository_path: Path) -> list[Path]:
    source_files: list[Path] = []
    for root, directories, files in os.walk(repository_path):
        directories[:] = [item for item in directories if item not in SKIP_DIRECTORIES]
        for file_name in files:
            file_path = Path(root) / file_name
            if file_path.suffix.lower() not in SOURCE_EXTENSIONS:
                continue
            if file_path.stat().st_size > settings.max_file_size_bytes:
                continue
            source_files.append(file_path)
    return source_files


def _normalize_line(line: str) -> str:
    return WHITESPACE_PATTERN.sub(" ", line.strip())


def _calculate_duplicate_blocks(source_files: list[Path]) -> tuple[int, int]:
    window_size = settings.duplicate_window_lines
    fingerprints: dict[str, int] = {}

    for file_path in source_files:
        window: deque[str] = deque(maxlen=window_size)
        with file_path.open("r", encoding="utf-8", errors="ignore") as handle:
            for raw_line in handle:
                normalized = _normalize_line(raw_line)
                if not normalized:
                    continue
                window.append(normalized)
                if len(window) == window_size:
                    fingerprint = hashlib.sha1("\n".join(window).encode("utf-8")).hexdigest()
                    fingerprints[fingerprint] = fingerprints.get(fingerprint, 0) + 1

    duplicate_block_count = sum(count - 1 for count in fingerprints.values() if count > 1)
    duplicate_line_count = duplicate_block_count * window_size
    return duplicate_block_count, duplicate_line_count


def _calculate_python_quality_metrics(
    repository_path: Path,
    source_files: list[Path],
) -> tuple[float, int, float, list[ComplexityHotspot]]:
    complexity_values: list[int] = []
    maintainability_values: list[float] = []
    hotspots: list[ComplexityHotspot] = []

    for file_path in source_files:
        if file_path.suffix.lower() not in PYTHON_EXTENSIONS:
            continue

        content = file_path.read_text(encoding="utf-8", errors="ignore")
        if not content.strip():
            continue

        try:
            blocks = cc_visit(content)
            maintainability = float(mi_visit(content, True))
        except Exception:
            continue

        relative_path = str(file_path.relative_to(repository_path))
        maintainability_values.append(maintainability)
        for block in blocks:
            complexity = int(block.complexity)
            complexity_values.append(complexity)
            hotspots.append(
                ComplexityHotspot(
                    file_path=relative_path,
                    entity_name=str(block.name),
                    complexity=complexity,
                    line_number=int(block.lineno),
                )
            )

    hotspots.sort(key=lambda item: item.complexity, reverse=True)
    average_complexity = (
        round(sum(complexity_values) / len(complexity_values), 2)
        if complexity_values
        else 0.0
    )
    max_complexity = max(complexity_values, default=0)
    maintainability_index = (
        round(sum(maintainability_values) / len(maintainability_values), 2)
        if maintainability_values
        else 100.0
    )
    return (
        average_complexity,
        max_complexity,
        maintainability_index,
        hotspots[: settings.hotspot_limit],
    )


def _calculate_technical_debt_score(
    average_complexity: float,
    max_complexity: int,
    maintainability_index: float,
    duplicate_block_count: int,
) -> float:
    maintainability_penalty = max(0.0, 100.0 - maintainability_index)
    raw_score = (
        (average_complexity * 6.0)
        + (max_complexity * 1.5)
        + (maintainability_penalty * 0.7)
        + (duplicate_block_count * 0.8)
    )
    return round(min(100.0, raw_score), 2)


def _build_csv_report(
    repository_name: str,
    repository_url: str,
    metrics: RepositoryAnalysisResult,
) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer)

    writer.writerow(["repository_name", repository_name])
    writer.writerow(["repository_url", repository_url])
    writer.writerow([])
    writer.writerow(["metric", "value"])
    writer.writerow(["file_count", metrics.file_count])
    writer.writerow(["line_count", metrics.line_count])
    writer.writerow(["commit_count", metrics.commit_count])
    writer.writerow(["duplicate_block_count", metrics.duplicate_block_count])
    writer.writerow(["duplicate_line_count", metrics.duplicate_line_count])
    writer.writerow(
        ["average_cyclomatic_complexity", metrics.average_cyclomatic_complexity]
    )
    writer.writerow(["max_cyclomatic_complexity", metrics.max_cyclomatic_complexity])
    writer.writerow(["maintainability_index", metrics.maintainability_index])
    writer.writerow(["technical_debt_score", metrics.technical_debt_score])
    writer.writerow([])
    writer.writerow(["top_hotspots"])
    writer.writerow(["file_path", "entity_name", "complexity", "line_number"])
    for hotspot in metrics.hotspots:
        writer.writerow(
            [
                hotspot.file_path,
                hotspot.entity_name,
                hotspot.complexity,
                hotspot.line_number,
            ]
        )

    return buffer.getvalue().encode("utf-8")


def _build_pdf_report(
    repository_name: str,
    repository_url: str,
    metrics: RepositoryAnalysisResult,
) -> bytes:
    buffer = io.BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=A4, title=f"RepoLens - {repository_name}")
    styles = getSampleStyleSheet()
    story: list[object] = []

    story.append(Paragraph(f"RepoLens Analysis Report: {repository_name}", styles["Title"]))
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"Repository URL: {repository_url}", styles["BodyText"]))
    story.append(Spacer(1, 12))

    summary_rows = [
        ["Metric", "Value"],
        ["Files", str(metrics.file_count)],
        ["Lines", str(metrics.line_count)],
        ["Commits (shallow clone visible)", str(metrics.commit_count)],
        ["Duplicate blocks", str(metrics.duplicate_block_count)],
        ["Duplicate lines", str(metrics.duplicate_line_count)],
        [
            "Average cyclomatic complexity",
            f"{metrics.average_cyclomatic_complexity:.2f}",
        ],
        ["Max cyclomatic complexity", str(metrics.max_cyclomatic_complexity)],
        ["Maintainability index", f"{metrics.maintainability_index:.2f}"],
        ["Technical debt score", f"{metrics.technical_debt_score:.2f} / 100"],
    ]

    summary_table = Table(summary_rows, hAlign="LEFT", colWidths=[240, 220])
    summary_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1f2937")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f3f4f6")]),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(summary_table)
    story.append(Spacer(1, 18))
    story.append(Paragraph("Complexity Hotspots", styles["Heading2"]))

    hotspot_rows = [["File", "Entity", "Complexity", "Line"]]
    if metrics.hotspots:
        for hotspot in metrics.hotspots:
            hotspot_rows.append(
                [
                    hotspot.file_path,
                    hotspot.entity_name,
                    str(hotspot.complexity),
                    str(hotspot.line_number),
                ]
            )
    else:
        hotspot_rows.append(["No Python hotspots detected", "-", "-", "-"])

    hotspot_table = Table(hotspot_rows, hAlign="LEFT", colWidths=[180, 180, 80, 60])
    hotspot_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f766e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#ecfeff")]),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(hotspot_table)

    document.build(story)
    return buffer.getvalue()


def analyze_repository(
    repository_path: Path,
    repository_name: str,
    repository_url: str,
    commit_count: int,
) -> AnalysisArtifacts:
    """Analyze a cloned repository and generate report artifacts."""

    source_files = _iter_source_files(repository_path)
    file_count = len(source_files)

    line_count = 0
    for file_path in source_files:
        with file_path.open("r", encoding="utf-8", errors="ignore") as handle:
            line_count += sum(1 for _ in handle)

    duplicate_block_count, duplicate_line_count = _calculate_duplicate_blocks(source_files)
    (
        average_complexity,
        max_complexity,
        maintainability_index,
        hotspots,
    ) = _calculate_python_quality_metrics(repository_path, source_files)

    technical_debt_score = _calculate_technical_debt_score(
        average_complexity,
        max_complexity,
        maintainability_index,
        duplicate_block_count,
    )

    metrics = RepositoryAnalysisResult(
        file_count=file_count,
        line_count=line_count,
        commit_count=commit_count,
        duplicate_block_count=duplicate_block_count,
        duplicate_line_count=duplicate_line_count,
        average_cyclomatic_complexity=average_complexity,
        max_cyclomatic_complexity=max_complexity,
        maintainability_index=maintainability_index,
        technical_debt_score=technical_debt_score,
        hotspots=hotspots,
    )

    sanitized_name = repository_name.replace("/", "-")
    csv_bytes = _build_csv_report(repository_name, repository_url, metrics)
    pdf_bytes = _build_pdf_report(repository_name, repository_url, metrics)

    return AnalysisArtifacts(
        metrics=metrics,
        csv_bytes=csv_bytes,
        pdf_bytes=pdf_bytes,
        csv_file_name=f"{sanitized_name}-analysis-report.csv",
        pdf_file_name=f"{sanitized_name}-analysis-report.pdf",
    )
