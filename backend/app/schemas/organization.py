from pydantic import BaseModel, ConfigDict, EmailStr
from typing import List, Optional
from datetime import datetime

class OrganizationBase(BaseModel):
    name: str

class OrganizationCreate(OrganizationBase):
    pass

class OrganizationResponse(OrganizationBase):
    id: str
    billing_status: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class OrganizationMemberBase(BaseModel):
    user_id: str
    role: str

class OrganizationMemberResponse(OrganizationMemberBase):
    id: str
    organization_id: str
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class InviteMemberRequest(BaseModel):
    email: EmailStr
    role: str = "developer"
