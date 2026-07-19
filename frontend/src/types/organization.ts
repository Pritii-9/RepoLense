export interface Organization {
  id: string;
  name: string;
  billing_status: string;
  created_at: string;
}

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'admin' | 'developer' | 'viewer';
  created_at: string;
}

export interface CreateOrganizationPayload {
  name: string;
}

export interface InviteMemberPayload {
  email: string;
  role: 'admin' | 'developer' | 'viewer';
}
