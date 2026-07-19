import asyncio
import sys
import os
from sqlalchemy import select

# Add the parent directory to the path so we can import 'app'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import AsyncSessionFactory
from app.models.user import User
from app.models.organization import Organization, OrganizationMember, OrganizationRole
from app.utils.password import hash_password

async def test_orgs():
    async with AsyncSessionFactory() as session:
        # 1. Create a test user
        user = User(
            email="test_org_admin2@example.com",
            full_name="Test Admin",
            password_hash=hash_password("password123"),
            is_verified=True
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
        print(f"[SUCCESS] Created User: {user.email} (ID: {user.id})")

        # 2. Create an organization
        org = Organization(name="Acme Corp")
        session.add(org)
        await session.flush()
        
        # 3. Add user as ADMIN
        member = OrganizationMember(
            user_id=user.id,
            organization_id=org.id,
            role=OrganizationRole.ADMIN
        )
        session.add(member)
        await session.commit()
        await session.refresh(org)
        print(f"[SUCCESS] Created Organization: {org.name} (ID: {org.id}) with Admin: {user.email}")

        # 4. Fetch to verify
        stmt = select(OrganizationMember).where(OrganizationMember.organization_id == org.id)
        result = await session.execute(stmt)
        members = result.scalars().all()
        print(f"[SUCCESS] Organization Members Count: {len(members)}")
        print(f"[SUCCESS] First Member Role: {members[0].role.value}")
        
        # Cleanup
        await session.delete(org)
        await session.delete(user)
        await session.commit()
        print("[SUCCESS] Cleanup successful")

if __name__ == "__main__":
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test_orgs())
