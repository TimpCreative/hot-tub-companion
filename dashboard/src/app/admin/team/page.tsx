'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  support: 'Support',
  viewer: 'Viewer',
};

const PERMISSION_LABELS: Record<string, string> = {
  can_manage_users: 'Manage team & permissions',
  can_view_customers: 'View customers',
  can_view_orders: 'View orders',
  can_manage_products: 'Manage products',
  can_manage_content: 'Manage content',
  can_manage_service_requests: 'Manage service requests',
  can_send_notifications: 'Send notifications',
  can_view_analytics: 'View analytics',
  can_manage_subscriptions: 'Manage subscriptions',
  can_manage_settings: 'Manage settings',
};

interface TeamMember {
  id: string;
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  permissions: Record<string, boolean>;
  createdAt: string;
}

interface AuditEntry {
  id: string;
  action: string;
  actor_email: string | null;
  target_email: string | null;
  created_at: string;
}

export default function AdminTeamPage() {
  const { getIdToken } = useAuth();
  const { config } = useTenant();
  const { permissions, refetch } = useAdminPermissions();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState<{ role: string; permissions: Record<string, boolean> } | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('manager');
  const [inviteSending, setInviteSending] = useState(false);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);

  const api = useMemo(() => createTenantApiClient(() => getIdToken()), [getIdToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const teamRes = (await api.get('/admin/team')) as { data?: { members?: TeamMember[] }; error?: { message?: string } };
      if (teamRes?.data?.members) {
        setMembers(teamRes.data.members);
      } else if (teamRes?.error) {
        setError(teamRes.error.message ?? 'Failed to load team');
        setMembers([]);
      }
      try {
        const auditRes = (await api.get('/admin/team/audit?limit=10')) as { data?: { entries?: AuditEntry[] } };
        if (auditRes?.data?.entries) setAuditEntries(auditRes.data.entries);
      } catch {
        /* audit is optional */
      }
    } catch (e: unknown) {
      const err = e as { error?: { message?: string }; message?: string };
      setError(err?.error?.message ?? err?.message ?? 'Failed to load team');
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const openEdit = (m: TeamMember) => {
    setEditing(m);
    setEditForm({ role: m.role, permissions: { ...m.permissions } });
  };

  const closeEdit = () => {
    setEditing(null);
    setEditForm(null);
  };

  const applyRoleTemplate = (role: string) => {
    const template = {
      owner: Object.fromEntries(
        Object.keys(PERMISSION_LABELS).map((k) => [k, true])
      ) as Record<string, boolean>,
      manager: {
        can_manage_users: false,
        can_view_customers: true,
        can_view_orders: true,
        can_manage_products: true,
        can_manage_content: true,
        can_manage_service_requests: true,
        can_send_notifications: true,
        can_view_analytics: true,
        can_manage_subscriptions: true,
        can_manage_settings: true,
      },
      support: {
        can_manage_users: false,
        can_view_customers: true,
        can_view_orders: true,
        can_manage_products: false,
        can_manage_content: false,
        can_manage_service_requests: true,
        can_send_notifications: true,
        can_view_analytics: true,
        can_manage_subscriptions: false,
        can_manage_settings: false,
      },
      viewer: {
        can_manage_users: false,
        can_view_customers: true,
        can_view_orders: true,
        can_manage_products: false,
        can_manage_content: false,
        can_manage_service_requests: false,
        can_send_notifications: false,
        can_view_analytics: true,
        can_manage_subscriptions: false,
        can_manage_settings: false,
      },
    }[role];
    if (template && editForm) {
      setEditForm({ ...editForm, role, permissions: template });
    } else if (editForm) {
      setEditForm({ ...editForm, role });
    }
  };

  const togglePermission = (key: string) => {
    if (!editForm) return;
    setEditForm({
      ...editForm,
      permissions: { ...editForm.permissions, [key]: !editForm.permissions[key] },
    });
  };

  const saveEdit = async () => {
    if (!editing || !editForm) return;
    setSaving(true);
    setError(null);
    try {
      await api.put(`/admin/team/${editing.userId}`, {
        role: editForm.role,
        permissions: editForm.permissions,
      });
      await load();
      await refetch();
      closeEdit();
    } catch (e: unknown) {
      const err = e as { error?: { message?: string }; message?: string };
      setError(err?.error?.message ?? err?.message ?? 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (m: TeamMember) => {
    if (!confirm(`Remove ${m.email} from the team?`)) return;
    setRemoving(m.userId);
    setError(null);
    try {
      await api.delete(`/admin/team/${m.userId}`);
      await load();
      await refetch();
    } catch (e: unknown) {
      const err = e as { error?: { message?: string }; message?: string };
      setError(err?.error?.message ?? err?.message ?? 'Failed to remove');
    } finally {
      setRemoving(null);
    }
  };

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      setError('Email is required');
      return;
    }
    setInviteSending(true);
    setError(null);
    try {
      await api.post('/admin/team/invite', { email, role: inviteRole });
      await load();
      await refetch();
      setInviteOpen(false);
      setInviteEmail('');
      setInviteRole('manager');
    } catch (e: unknown) {
      const err = e as { error?: { message?: string }; message?: string };
      setError(err?.error?.message ?? err?.message ?? 'Failed to send invite');
    } finally {
      setInviteSending(false);
    }
  };

  if (!permissions?.can_manage_users) {
    return (
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-gray-900">Team</h1>
        <p className="mt-4 text-gray-600">You don&apos;t have permission to manage the team.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Team</h1>
          <p className="mt-1 text-gray-600">Manage admins and their permissions for {config?.name ?? 'this tenant'}.</p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>Invite admin</Button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-6 flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase text-gray-500">Role</th>
                <th className="px-6 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {m.firstName || m.lastName ? `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || m.email : m.email}
                    {m.email && (m.firstName || m.lastName) && (
                      <span className="block text-xs text-gray-500">{m.email}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                    {ROLE_LABELS[m.role] ?? m.role}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                    <button
                      onClick={() => openEdit(m)}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    <span className="mx-2 text-gray-300">|</span>
                    <button
                      onClick={() => removeMember(m)}
                      disabled={removing === m.userId}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      {removing === m.userId ? 'Removing…' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {members.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-500">No team members yet. Use Invite admin to add someone.</div>
          )}
        </div>
      )}

      {auditEntries.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Recent permission changes</h2>
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">When</th>
                  <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
                  <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">By</th>
                  <th className="px-6 py-2 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {auditEntries.map((e) => (
                  <tr key={e.id}>
                    <td className="px-6 py-2 text-sm text-gray-600">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-2 text-sm">{e.action.replace(/_/g, ' ')}</td>
                    <td className="px-6 py-2 text-sm">{e.actor_email || '—'}</td>
                    <td className="px-6 py-2 text-sm">{e.target_email || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Invite admin</h2>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="admin@example.com"
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setInviteOpen(false); setInviteEmail(''); setError(null); }}>
                Cancel
              </Button>
              <Button onClick={sendInvite} disabled={inviteSending}>
                {inviteSending ? 'Sending…' : 'Send invite'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {editing && editForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold">Edit {editing.email}</h2>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                value={editForm.role}
                onChange={(e) => applyRoleTemplate(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                {Object.entries(ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Permissions</label>
              <div className="mt-2 space-y-2">
                {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!editForm.permissions[key]}
                      onChange={() => togglePermission(key)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={closeEdit}>
                Cancel
              </Button>
              <Button onClick={saveEdit} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
