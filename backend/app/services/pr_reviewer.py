import httpx
from ..config import settings
from ..utils.logger import get_logger
from .llm_client import LLMClient

logger = get_logger(__name__)

async def fetch_pr_diff(repo_owner: str, repo_name: str, pr_number: int) -> str:
    """Fetches the raw diff of a Pull Request from GitHub."""
    if not settings.github_token:
        logger.warning("No GitHub token configured for PR reviewer.")
        return ""
        
    url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/pulls/{pr_number}"
    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github.v3.diff", # Request the raw diff format
        "X-GitHub-Api-Version": "2022-11-28"
    }

    async with httpx.AsyncClient() as client:
        response = await client.get(url, headers=headers)
        if response.status_code != 200:
            logger.error(f"Failed to fetch PR diff: {response.status_code} {response.text}")
            return ""
        return response.text

async def generate_ai_review(diff: str, repo_name: str) -> str | None:
    """Generates an AI code review based on the git diff."""
    if not diff or not diff.strip():
        return None

    # Truncate diff if it's monstrously huge to save tokens
    max_diff_len = 30000 
    if len(diff) > max_diff_len:
        diff = diff[:max_diff_len] + "\n... (diff truncated for length)"

    system_prompt = (
        "You are an expert Senior Software Engineer performing a Code Review on a Pull Request.\n"
        "You will be provided with a git diff.\n"
        "Your goal is to identify bugs, security vulnerabilities, performance issues, and bad practices.\n"
        "If the code looks good, praise the author. If there are issues, provide constructive, specific feedback.\n"
        "Use Markdown formatting. Be concise but thorough."
    )
    
    user_prompt = f"Please review this Pull Request for the repository `{repo_name}`:\n\n```diff\n{diff}\n```"

    llm = LLMClient(temperature=0.3)
    try:
        review, _ = await llm.generate([
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ])
        return review
    except Exception as e:
        logger.error(f"AI PR review generation failed: {e}")
        return None
    finally:
        await llm.close()

async def post_pr_comment(repo_owner: str, repo_name: str, pr_number: int, comment: str) -> bool:
    """Posts a comment on the GitHub Pull Request."""
    if not settings.github_token:
        logger.warning("No GitHub token configured to post PR comment.")
        return False

    url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/issues/{pr_number}/comments"
    headers = {
        "Authorization": f"Bearer {settings.github_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    
    # Add a signature so people know it's a bot
    body = comment + "\n\n---\n*🤖 Reviewed by RepoLense AI*"

    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json={"body": body})
        if response.status_code == 201:
            logger.info(f"Successfully posted PR review on {repo_owner}/{repo_name}#{pr_number}")
            return True
        else:
            logger.error(f"Failed to post PR comment: {response.status_code} {response.text}")
            return False
