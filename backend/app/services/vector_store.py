from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_text_splitters import Language, RecursiveCharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain_core.documents import Document

from ..config import settings
from ..utils.logger import get_logger

logger = get_logger(__name__)

# Map extensions to LangChain Language types
EXTENSION_MAP = {
    ".py": Language.PYTHON,
    ".js": Language.JS,
    ".jsx": Language.JS,
    ".ts": Language.TS,
    ".tsx": Language.TS,
    ".java": Language.JAVA,
    ".go": Language.GO,
    ".rb": Language.RUBY,
    ".rs": Language.RUST,
    ".c": Language.C,
    ".cpp": Language.CPP,
    ".h": Language.CPP,
}

class VectorStoreService:
    """Service to handle repository indexing and querying using ChromaDB."""

    def __init__(self, analysis_id: str) -> None:
        self.analysis_id = analysis_id
        self.persist_directory = str(settings.vector_store_directory / analysis_id)
        
        # Use OpenAI if key is present, otherwise fallback to local (or None)
        if settings.openai_api_key:
            self.embeddings = OpenAIEmbeddings(
                model=settings.embedding_model,
                openai_api_key=settings.openai_api_key,
            )
        else:
            logger.warning("openai_key_missing_using_local_embeddings")
            # This requires sentence-transformers. If not installed, this will fail.
            # For now, let's just set it to None and handle it in indexing/querying.
            self.embeddings = None

    def _get_vectorstore(self) -> Chroma:
        return Chroma(
            persist_directory=self.persist_directory,
            embedding_function=self.embeddings,
            collection_name=f"repo_{self.analysis_id.replace('-', '_')}",
        )

    async def index_repository(self, repo_path: Path) -> int:
        """Chunks and indexes all source files in the repository."""
        
        logger.info("indexing_repository_started", extra={"analysis_id": self.analysis_id})
        
        documents: list[Document] = []
        
        # Walk through the repository
        for root, _, files in os.walk(repo_path):
            # Skip hidden and ignored directories (re-use logic from code_analyzer or simplify)
            if any(part.startswith('.') or part in {"node_modules", "venv", "__pycache__"} for part in Path(root).parts):
                continue
                
            for file_name in files:
                file_path = Path(root) / file_name
                ext = file_path.suffix.lower()
                
                if ext not in EXTENSION_MAP:
                    continue
                
                try:
                    loader = TextLoader(str(file_path), encoding="utf-8")
                    file_docs = loader.load()
                    
                    # Add metadata
                    for doc in file_docs:
                        doc.metadata = {
                            "source": str(file_path.relative_to(repo_path)),
                            "file_name": file_name,
                            "extension": ext
                        }
                    
                    language = EXTENSION_MAP[ext]
                    splitter = RecursiveCharacterTextSplitter.from_language(
                        language=language,
                        chunk_size=1500,
                        chunk_overlap=200
                    )
                    
                    split_docs = splitter.split_documents(file_docs)
                    documents.extend(split_docs)
                    
                except Exception as e:
                    logger.warning(f"Failed to index file {file_path}: {e}")

        if not documents:
            logger.warning("no_documents_found_to_index", extra={"analysis_id": self.analysis_id})
            return 0

        # Create/Update vector store
        if not self.embeddings:
             logger.error("indexing_failed_no_embeddings")
             return 0

        vectorstore = Chroma.from_documents(
            documents=documents,
            embedding=self.embeddings,
            persist_directory=self.persist_directory,
            collection_name=f"repo_{self.analysis_id.replace('-', '_')}"
        )
        
        count = len(documents)
        logger.info("indexing_repository_completed", extra={"analysis_id": self.analysis_id, "chunks": count})
        return count

    async def query(self, question: str, k: int = 5) -> list[Document]:
        """Performs a similarity search for the given question."""
        if not os.path.exists(self.persist_directory) or not self.embeddings:
            logger.warning("query_failed_missing_index_or_embeddings", extra={"analysis_id": self.analysis_id})
            return []
            
        vectorstore = self._get_vectorstore()
        return vectorstore.similarity_search(question, k=k)
