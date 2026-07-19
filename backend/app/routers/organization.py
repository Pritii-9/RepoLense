from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Annotated, List

from ..db import get_async_session
from ..models.user import User
from ..models.organization import Organization, OrganizationMember, OrganizationRole
from ..schemas.organization import (
    OrganizationCreate,
    OrganizationResponse,
    OrganizationMemberResponse,
    InviteMemberRequest
)
from ..utils.jwt import get_current_user
from ..utils.logger import get_logger

router = APIRouter(prefix="/organizations", tags=["organizations"])
logger = get_logger(__name__)

@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)]
):
    org = Organization(name=payload.name)
    session.add(org)
    await session.flush()
    
    member = OrganizationMember(
        user_id=current_user.id,
        organization_id=org.id,
        role=OrganizationRole.ADMIN
    )
    session.add(member)
    await session.commit()
    await session.refresh(org)
    
    return org

@router.get("", response_model=List[OrganizationResponse])
async def list_organizations(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)]
):
    stmt = select(Organization).join(OrganizationMember).where(OrganizationMember.user_id == current_user.id)
    result = await session.execute(stmt)
    orgs = result.scalars().all()
    return list(orgs)

@router.post("/{org_id}/invite", response_model=OrganizationMemberResponse)
async def invite_member(
    org_id: str,
    payload: InviteMemberRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)]
):
    member_stmt = select(OrganizationMember).where(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == current_user.id,
        OrganizationMember.role == OrganizationRole.ADMIN
    )
    result = await session.execute(member_stmt)
    admin_member = result.scalar_one_or_none()
    
    if not admin_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only organization admins can invite members."
        )
        
    user_stmt = select(User).where(User.email == payload.email.lower())
    result = await session.execute(user_stmt)
    invited_user = result.scalar_one_or_none()
    
    if not invited_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found with this email."
        )
        
    exist_stmt = select(OrganizationMember).where(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == invited_user.id
    )
    result = await session.execute(exist_stmt)
    existing_member = result.scalar_one_or_none()
    
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this organization."
        )
        
    new_member = OrganizationMember(
        user_id=invited_user.id,
        organization_id=org_id,
        role=payload.role
    )
    session.add(new_member)
    await session.commit()
    await session.refresh(new_member)
    
    return new_member

@router.get("/{org_id}/members", response_model=List[OrganizationMemberResponse])
async def get_members(
    org_id: str,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_async_session)]
):
    exist_stmt = select(OrganizationMember).where(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == current_user.id
    )
    result = await session.execute(exist_stmt)
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this organization."
        )
        
    stmt = select(OrganizationMember).where(OrganizationMember.organization_id == org_id)
    result = await session.execute(stmt)
    return list(result.scalars().all())
