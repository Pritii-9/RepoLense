from __future__ import annotations

import os
from pathlib import Path

from ..config import settings
from ..utils.logger import get_logger

logger = get_logger(__name__)

# Map extensions to LangChain Language types (strings to avoid importing langchain at startup)
EXTENSION_MAP = {
    ".py": "python",
    ".js": "js",
    ".jsx": "js",
    ".ts": "ts",
    ".tsx": "ts",
    ".java": "java",
    ".go": "go",
    ".rb": "ruby",
    ".rs": "rust",
    ".c": "c",
    ".cpp": "cpp",
    ".h": "cpp",
}


class VectorStoreService:
    """Service to handle repository indexing and querying using ChromaDB.

    All heavy ML imports (chromadb, langchain, openai) are deferred until
    the first actual call, keeping startup memory well below 512 MB on
    Render's free tier.
    """

    def __init__(self, analysis_id: str) -> None:
        self.analysis_id = analysis_id
        self.persist_directory = str(settings.vector_store_directory / analysis_id)

    def _get_embeddings(self):
        """Lazily create and return the embeddings instance."""
        if settings.openai_api_key:
            from langchain_openai import OpenAIEmbeddings
            return OpenAIEmbeddings(
                model=settings.embedding_model,
                openai_api_key=settings.openai_api_key,
            )
        # Fallback — requires sentence-transformers to be installed locally
        logger.warning("openai_key_missing_using_local_embeddings")
        from langchain_community.embeddings import HuggingFaceEmbeddings
        return HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")

    def _get_vectorstore(self, embeddings):
        from langchain_community.vectorstores import Chroma
        return Chroma(
            persist_directory=self.persist_directory,
            embedding_function=embeddings,
            collection_name=f"repo_{self.analysis_id.replace('-', '_')}",
        )

    async def index_repository(self, repo_path: Path) -> int:
        """Chunks and indexes all source files in the repository."""
        # Defer all heavy imports to here
        from langchain_community.vectorstores import Chroma
        from langchain_community.document_loaders import TextLoader
        from langchain_core.documents import Document
        from langchain_text_splitters import Language, RecursiveCharacterTextSplitter

        _LANG_MAP = {
            "python": Language.PYTHON,
            "js": Language.JS,
            "ts": Language.TS,
            "java": Language.JAVA,
            "go": Language.GO,
            "ruby": Language.RUBY,
            "rust": Language.RUST,
            "c": Language.C,
            "cpp": Language.CPP,
        }

        logger.info("indexing_repository_started", extra={"analysis_id": self.analysis_id})

        documents: list[Document] = []

        for root, _, files in os.walk(repo_path):
            if len(documents) >= 150:
                break

            try:
                rel_path = Path(root).relative_to(repo_path)
            except ValueError:
                continue

            if rel_path != Path('.') and any(
                part.startswith('.') or part in {"node_modules", "venv", ".venv", "__pycache__", "dist", "build", "coverage", "vendor", "static"}
                for part in rel_path.parts
            ):
                continue

            for file_name in files:
                if len(documents) >= 150:
                    break
                file_path = Path(root) / file_name
                ext = file_path.suffix.lower()

                if ext not in EXTENSION_MAP:
                    continue

                try:
                    loader = TextLoader(str(file_path), encoding="utf-8")
                    file_docs = loader.load()

                    for doc in file_docs:
                        doc.metadata = {
                            "source": str(file_path.relative_to(repo_path)),
                            "file_name": file_name,
                            "extension": ext,
                        }

                    lang_key = EXTENSION_MAP[ext]
                    language = _LANG_MAP.get(lang_key)
                    if language:
                        splitter = RecursiveCharacterTextSplitter.from_language(
                            language=language,
                            chunk_size=1500,
                            chunk_overlap=200,
                        )
                    else:
                        splitter = RecursiveCharacterTextSplitter(
                            chunk_size=1500,
                            chunk_overlap=200,
                        )

                    split_docs = splitter.split_documents(file_docs)
                    documents.extend(split_docs)

                except Exception as e:
                    logger.warning(f"Failed to index file {file_path}: {e}")

        if not documents:
            logger.warning("no_documents_found_to_index", extra={"analysis_id": self.analysis_id})
            return 0

        embeddings = self._get_embeddings()

        vectorstore = Chroma.from_documents(
            documents=documents,
            embedding=embeddings,
            persist_directory=self.persist_directory,
            collection_name=f"repo_{self.analysis_id.replace('-', '_')}",
        )

        count = len(documents)
        logger.info("indexing_repository_completed", extra={"analysis_id": self.analysis_id, "chunks": count})
        return count

    async def query(self, question: str, k: int = 5):
        """Performs a similarity search for the given question."""
        if not os.path.exists(self.persist_directory):
            logger.warning("query_failed_missing_index", extra={"analysis_id": self.analysis_id})
            return []

        embeddings = self._get_embeddings()
        vectorstore = self._get_vectorstore(embeddings)
        return vectorstore.similarity_search(question, k=k)
