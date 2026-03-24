'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { Button } from '@/components/ui/Button';

interface PlatformUser {
  id: string;
  email: string;
  platform_role: string;
  tenant_scope: string[] | null;
  added_by: string | null;
  created_at: string;
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export default function PlatformUsersPage() {
  const fetchWithAuth = useSuperAdminFetch();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState<'super_admin' | 'tenant_admin'>('super_admin');
  const [addScope, setAddScope] = useState<string[]>([]);
  const [addSaving, setAddSaving] = useState(false);
  const [editing, setEditing] = useState<PlatformUser | null>(null);
  const [editRole, setEditRole] = useState<'super_admin' | 'tenant_admin'>('super_admin');
  const [editScope, setEditScope] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersRes, tenantsRes] = await Promise.all([
        fetchWithAuth('/api/dashboard/super-admin/platform-users'),
        fetchWithAuth('/api/dashboard/super-admin/tenants'),
      ]);
      const usersData = await usersRes.json();
      const tenantsData = await tenantsRes.json();
      if (usersData.success && usersData.data?.users) {
        setUsers(usersData.data.users);
      }
      if (tenantsData.success && tenantsData.data?.tenants) {
        setTenants(tenantsData.data.tenants);
      }
      if (!usersData.success) {
        setError(usersData.error?.message || 'Failed to load platform users');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setAddEmail('');
    setAddRole('super_admin');
    setAddScope([]);
    setAddOpen(true);
    setError(null);
  };

  const openEdit = (u: PlatformUser) => {
    setEditing(u);
    setEditRole(u.platform_role as 'super_admin' | 'tenant_admin');
    setEditScope(Array.isArray(u.tenant_scope) ? [...u.tenant_scope] : []);
    setError(null);
  };

  const toggleScope = (id: string, scope: string[], setScope: (s: string[]) => void) => {
    setScope(scope.includes(id) ? scope.filter((x) => x !== id) : [...scope, id]);
  };

  const handleAdd = async () => {
    const email = addEmail.trim().toLowerCase();
    if (!email) {
      setError('Email is required');
      return;
    }
    setAddSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/dashboard/super-admin/platform-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          platform_role: addRole,
          tenant_scope: addRole === 'tenant_admin' && addScope.length > 0 ? addScope : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAddOpen(false);
        load();
      } else {
        setError(data.error?.message || 'Failed to add');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAddSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editing) return;
    setEditSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/dashboard/super-admin/platform-users/${editing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform_role: editRole,
          tenant_scope: editRole === 'tenant_admin' && editScope.length > 0 ? editScope : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditing(null);
        load();
      } else {
        setError(data.error?.message || 'Failed to update');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    } finally {
      setEditSaving(false);
    }
  };

  const handleRemove = async (u: PlatformUser) => {
    if (!confirm(`Remove ${u.email} from platform users?`)) return;
    setRemoving(u.id);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/dashboard/super-admin/platform-users/${u.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        load();
      } else {
        setError(data.error?.message || 'Failed to remove');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setRemoving(null);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Platform Users</h2>
        <Button onClick={openAdd}>Add Platform User</Button>
      </div>

      <p className="mb-4 text-gray-600">
        Super admins and tenant admins. These users can access the super admin dashboard and/or any tenant admin
        dashboard. Env vars (SUPER_ADMIN_EMAILS, TENANT_ADMIN_EMAILS) still work as fallback.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Scope</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-6 py-4 text-sm text-gray-900">{u.email}</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                        u.platform_role === 'super_admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {u.platform_role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {!u.tenant_scope || u.tenant_scope.length === 0
                      ? 'All tenants'
                      : `${u.tenant_scope.length} tenant(s)`}
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={() => openEdit(u)}
                      className="text-blue-600 hover:text-blue-800 mr-4"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleRemove(u)}
                      disabled={removing === u.id}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50"
                    >
                      {removing === u.id ? 'Removing…' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-500">No platform users yet.</div>
          )}
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Add Platform User</h3>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as 'super_admin' | 'tenant_admin')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="super_admin">Super Admin</option>
                <option value="tenant_admin">Tenant Admin</option>
              </select>
            </div>
            {addRole === 'tenant_admin' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">
                  Tenant Scope (leave empty for all)
                </label>
                <div className="mt-2 max-h-40 overflow-y-auto space-y-2">
                  {tenants.map((t) => (
                    <label key={t.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={addScope.includes(t.id)}
                        onChange={() => toggleScope(t.id, addScope, setAddScope)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{t.name} ({t.slug})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={addSaving}>{addSaving ? 'Adding…' : 'Add'}</Button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">Edit {editing.email}</h3>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value as 'super_admin' | 'tenant_admin')}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="super_admin">Super Admin</option>
                <option value="tenant_admin">Tenant Admin</option>
              </select>
            </div>
            {editRole === 'tenant_admin' && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">
                  Tenant Scope (leave empty for all)
                </label>
                <div className="mt-2 max-h-40 overflow-y-auto space-y-2">
                  {tenants.map((t) => (
                    <label key={t.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={editScope.includes(t.id)}
                        onChange={() => toggleScope(t.id, editScope, setEditScope)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm">{t.name} ({t.slug})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleEdit} disabled={editSaving}>{editSaving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
