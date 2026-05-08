#!/usr/bin/env python3
"""
Delete all un‑verified user accounts from the database.
Run this script inside the project's virtual‑environment:

    cd d:\flask-react\RepoLense\backend
    python scripts/cleanup_unverified.py

The script:
* Loads the async engine from `app.db`.
* Executes a single DELETE statement for users where `is_verified` is False.
* Prints how many rows were removed.
"""

import asyncio
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

# Import the shared engine & Base models
from app.db import engine
from app.models.user import User  # type: ignore  # noqa: F401


async def delete_unverified() -> int:
    """
    Perform the DELETE and return the number of rows removed.
    """
    async with AsyncSession(engine) as session:
        # Count rows first (optional, just for reporting)
        result = await session.execute(select(User).where(User.is_verified.is_(False)))
        rows_to_delete = result.scalars().all()
        count = len(rows_to_delete)

        if count == 0:
            return 0

        # Delete in one bulk operation
        await session.execute(delete(User).where(User.is_verified.is_(False)))
        await session.commit()
        return count


def main() -> None:
    count = asyncio.run(delete_unverified())
    if count == 0:
        print("✅ No un‑verified users found – nothing to delete.")
    else:
        print(f"🧹 Deleted {count} un‑verified user{'s' if count > 1 else ''} from the database.")


if __name__ == "__main__":
    main()

