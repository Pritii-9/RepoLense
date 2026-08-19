import { useState, useEffect, type FormEvent } from 'react'
import { organizationApi } from '@/services/organizationApi'
import type { Organization, OrganizationMember } from '@/types/organization'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { Input } from '@/components/Input'
import { useToast } from '@/hooks/useToast'
import { EmptyState } from '@/components/EmptyState'
import { getErrorMessage } from '@/services/api'
import { formatDateTime } from '@/utils/dateHelpers'

export function OrganizationsPage() {
  const { pushToast } = useToast()
  
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null)
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  const [isCreatingOrg, setIsCreatingOrg] = useState(false)
  const [newOrgName, setNewOrgName] = useState('')
  
  const [isInviting, setIsInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'developer' | 'viewer'>('developer')

  useEffect(() => {
    fetchOrganizations()
  }, [])

  const fetchOrganizations = async () => {
    try {
      setIsLoading(true)
      const orgs = await organizationApi.listOrganizations()
      setOrganizations(orgs)
      const firstOrg = orgs[0]
      if (firstOrg && !selectedOrg) {
        handleSelectOrg(firstOrg)
      }
    } catch (err) {
      pushToast({
        title: 'Error fetching organizations',
        description: getErrorMessage(err),
        tone: 'error',
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSelectOrg = async (org: Organization) => {
    setSelectedOrg(org)
    try {
      const orgMembers = await organizationApi.getMembers(org.id)
      setMembers(orgMembers)
    } catch (err) {
      pushToast({
        title: 'Error fetching members',
        description: getErrorMessage(err),
        tone: 'error',
      })
    }
  }

  const handleCreateOrg = async (e: FormEvent) => {
    e.preventDefault()
    if (!newOrgName.trim()) return
    
    try {
      setIsCreatingOrg(true)
      const newOrg = await organizationApi.createOrganization({ name: newOrgName.trim() })
      setOrganizations((prev) => [...prev, newOrg])
      setNewOrgName('')
      handleSelectOrg(newOrg)
      pushToast({
        title: 'Organization created',
        description: `Successfully created ${newOrg.name}.`,
        tone: 'success',
      })
    } catch (err) {
      pushToast({
        title: 'Creation failed',
        description: getErrorMessage(err),
        tone: 'error',
      })
    } finally {
      setIsCreatingOrg(false)
    }
  }

  const handleInviteMember = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedOrg || !inviteEmail.trim()) return

    try {
      setIsInviting(true)
      const newMember = await organizationApi.inviteMember(selectedOrg.id, {
        email: inviteEmail.trim(),
        role: inviteRole,
      })
      setMembers((prev) => [...prev, newMember])
      setInviteEmail('')
      pushToast({
        title: 'Member invited',
        description: `${inviteEmail} has been added to the organization.`,
        tone: 'success',
      })
    } catch (err) {
      pushToast({
        title: 'Invite failed',
        description: getErrorMessage(err),
        tone: 'error',
      })
    } finally {
      setIsInviting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">Organizations</h1>
          <p className="mt-1 text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
            Manage your teams, roles, and workspaces for B2B collaboration.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <div className="space-y-6">
          <Card title="Your Organizations" className="flex flex-col h-full min-h-[400px]">
            {organizations.length === 0 ? (
              <EmptyState title="No organizations" description="You don't belong to any organizations yet." />
            ) : (
              <div className="space-y-2 mb-6">
                {organizations.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => handleSelectOrg(org)}
                    className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                      selectedOrg?.id === org.id
                        ? 'border-indigo-600 bg-indigo-50 dark:border-indigo-500 dark:bg-indigo-950/40'
                        : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900'
                    }`}
                  >
                    <div>
                      <p className={`font-medium text-sm ${selectedOrg?.id === org.id ? 'text-indigo-700 dark:text-indigo-300 font-bold' : 'text-zinc-900 dark:text-zinc-100'}`}>
                        {org.name}
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">
                        {org.billing_status} Plan
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-auto pt-6 border-t border-zinc-200 dark:border-zinc-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">Create New Organization</h3>
              <form onSubmit={handleCreateOrg} className="space-y-3">
                <Input
                  label="Organization Name"
                  placeholder="Acme Corp"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  required
                />
                <Button type="submit" isLoading={isCreatingOrg} className="w-full">
                  Create Organization
                </Button>
              </form>
            </div>
          </Card>
        </div>

        <div>
          {selectedOrg ? (
            <div className="space-y-6">
              <Card title={`Members of ${selectedOrg.name}`}>
                <div className="mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">Invite Team Member</h3>
                  <form onSubmit={handleInviteMember} className="flex flex-col sm:flex-row items-end gap-3">
                    <div className="flex-1 w-full">
                      <Input
                        label="Email Address"
                        type="email"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="w-full sm:w-40">
                      <label className="block text-sm font-semibold mb-2 text-zinc-900 dark:text-zinc-200">Role</label>
                      <select
                        value={inviteRole}
                        onChange={(e) => setInviteRole(e.target.value as 'admin' | 'developer' | 'viewer')}
                        className="w-full h-10 px-3 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="admin">Admin</option>
                        <option value="developer">Developer</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                    <Button type="submit" isLoading={isInviting} className="w-full sm:w-auto">
                      Invite Member
                    </Button>
                  </form>
                </div>

                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-950">
                  <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                    <thead className="bg-zinc-50 dark:bg-zinc-950">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">User ID</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">Joined</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-zinc-900 divide-y divide-zinc-200 dark:divide-zinc-800 text-sm">
                      {members.map((member) => (
                        <tr key={member.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap font-mono text-zinc-700 dark:text-zinc-300">
                            {member.user_id.split('-')[0]}...
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium capitalize border ${
                              member.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800' :
                              member.role === 'developer' ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' :
                              'bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                            }`}>
                              {member.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-zinc-500 dark:text-zinc-400">
                            {formatDateTime(member.created_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-12 bg-white dark:bg-zinc-900">
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">Select an organization from the left to manage team members.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
