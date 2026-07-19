import { api } from './api'
import type { 
  Organization, 
  OrganizationMember, 
  CreateOrganizationPayload, 
  InviteMemberPayload 
} from '../types/organization'

export const organizationApi = {
  /**
   * List all organizations the user belongs to
   */
  async listOrganizations(): Promise<Organization[]> {
    const { data } = await api.get<Organization[]>('/organizations')
    return data
  },

  /**
   * Create a new organization
   */
  async createOrganization(payload: CreateOrganizationPayload): Promise<Organization> {
    const { data } = await api.post<Organization>('/organizations', payload)
    return data
  },

  /**
   * Get all members of an organization
   */
  async getMembers(orgId: string): Promise<OrganizationMember[]> {
    const { data } = await api.get<OrganizationMember[]>(`/organizations/${orgId}/members`)
    return data
  },

  /**
   * Invite a user to an organization
   */
  async inviteMember(orgId: string, payload: InviteMemberPayload): Promise<OrganizationMember> {
    const { data } = await api.post<OrganizationMember>(`/organizations/${orgId}/invite`, payload)
    return data
  }
}
