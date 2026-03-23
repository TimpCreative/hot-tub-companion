'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';

interface SuperAdminUser {
  email: string;
  displayName: string | null;
  lastSignIn: string | null;
  createdAt: string | null;
  status: 'active' | 'not_registered' | 'error';
  source: 'env' | 'db';
  invitedAt?: string;
  error?: string;
}

interface Diagnostics {
  firebaseConfigured: boolean;
  firebaseInitError: string | null;
  firebaseKeyDebug?: Record<string, unknown>;
  envVarSet: boolean;
  emailCount: number;
  lookupErrors: string[];
}

interface SystemInfo {
  environment: string;
  version: string;
  apiUrl: string;
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const fetchWithAuth = useSuperAdminFetch();
  const [superAdmins, setSuperAdmins] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [usersExpanded, setUsersExpanded] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetchWithAuth('/api/dashboard/super-admin/settings');
      const data = await res.json();
      if (data.success) {
        setSuperAdmins(data.data?.users || []);
        setDiagnostics(data.data?.diagnostics || null);
      } else {
        setFetchError(data.error?.message || 'Failed to fetch settings');
      }
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setFetchError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleAddEmail = async () => {
    if (!newEmail.trim()) return;
    
    setAddingEmail(true);
    setActionMessage(null);
    
    try {
      const res = await fetchWithAuth('/api/dashboard/super-admin/whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newEmail.trim() }),
      });
      const data = await res.json();
      
      if (data.success) {
        setActionMessage({ type: 'success', text: `Added ${newEmail} to whitelist` });
        setNewEmail('');
        setShowAddModal(false);
        fetchSettings();
      } else {
        setActionMessage({ type: 'error', text: data.error?.message || 'Failed to add email' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Network error' });
    } finally {
      setAddingEmail(false);
    }
  };

  const handleSendInvite = async (email: string) => {
    setSendingInvite(email);
    setActionMessage(null);
    
    try {
      const res = await fetchWithAuth('/api/dashboard/super-admin/whitelist/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      
      if (data.success) {
        setActionMessage({ type: 'success', text: `Invite sent to ${email}` });
        fetchSettings();
      } else {
        setActionMessage({ type: 'error', text: data.error?.message || 'Failed to send invite' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Network error' });
    } finally {
      setSendingInvite(null);
    }
  };

  const handleRemoveEmail = async (email: string) => {
    if (!confirm(`Remove ${email} from the whitelist?`)) return;
    
    setActionMessage(null);
    
    try {
      const res = await fetchWithAuth(`/api/dashboard/super-admin/whitelist/${encodeURIComponent(email)}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      
      if (data.success) {
        setActionMessage({ type: 'success', text: `Removed ${email} from whitelist` });
        fetchSettings();
      } else {
        setActionMessage({ type: 'error', text: data.error?.message || 'Failed to remove email' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Network error' });
    }
  };

  const systemInfo: SystemInfo = {
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    apiUrl: process.env.NEXT_PUBLIC_API_URL || 'Not configured',
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Super Admin configuration and user management</p>
      </div>

      {/* Action message */}
      {actionMessage && (
        <div className={`mb-4 p-3 rounded-lg ${actionMessage.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          {actionMessage.text}
        </div>
      )}

      <div className="space-y-6">
        {/* Current User */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Account</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Email</span>
              <span className="text-sm font-medium text-gray-900">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Name</span>
              <span className="text-sm font-medium text-gray-900">
                {user?.firstName && user?.lastName 
                  ? `${user.firstName} ${user.lastName}` 
                  : user?.firstName || 'Not set'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Role</span>
              <Badge variant="info">Super Admin</Badge>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-200">
            <Button variant="secondary" onClick={() => logout()}>
              Sign Out
            </Button>
          </div>
        </div>

        {/* Super Admin Users - Accordion */}
        <div className="bg-white rounded-lg border border-gray-200">
          <button
            onClick={() => setUsersExpanded(!usersExpanded)}
            className="w-full p-6 flex items-center justify-between text-left"
          >
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Super Admin Users</h3>
              <p className="text-sm text-gray-500 mt-1">
                {superAdmins.length} user{superAdmins.length !== 1 ? 's' : ''} with access
              </p>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${usersExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {usersExpanded && (
            <div className="px-6 pb-6 border-t border-gray-100">
              {loading ? (
                <div className="animate-pulse space-y-3 pt-4">
                  <div className="h-10 bg-gray-100 rounded"></div>
                  <div className="h-10 bg-gray-100 rounded"></div>
                </div>
              ) : fetchError ? (
                <div className="p-4 mt-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="text-sm font-medium text-red-800">Error fetching settings</div>
                  <div className="text-xs text-red-600 mt-1">{fetchError}</div>
                </div>
              ) : (
                <div className="space-y-4 pt-4">
                  {/* Diagnostics (if there are issues) */}
                  {diagnostics && (diagnostics.lookupErrors.length > 0 || diagnostics.firebaseInitError) && (
                    <div className={`p-3 border rounded-lg ${diagnostics.firebaseInitError ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                      <div className={`text-sm font-medium mb-2 ${diagnostics.firebaseInitError ? 'text-red-800' : 'text-yellow-800'}`}>Diagnostics</div>
                      <div className={`text-xs space-y-1 ${diagnostics.firebaseInitError ? 'text-red-700' : 'text-yellow-700'}`}>
                        <div>Firebase configured: {diagnostics.firebaseConfigured ? '✓' : '✗'}</div>
                        {diagnostics.firebaseInitError && (
                          <div className="text-red-600 font-medium">
                            Firebase Error: {diagnostics.firebaseInitError}
                          </div>
                        )}
                        {diagnostics.lookupErrors.length > 0 && (
                          <div className="mt-2">
                            <div className="font-medium">Lookup errors:</div>
                            {diagnostics.lookupErrors.map((err, i) => (
                              <div key={i} className="text-red-600">• {err}</div>
                            ))}
                          </div>
                        )}
                        {diagnostics.firebaseKeyDebug && (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs font-medium">Key Debug Info</summary>
                            <div className="mt-1 p-2 bg-white/50 rounded text-xs font-mono">
                              {Object.entries(diagnostics.firebaseKeyDebug).map(([k, v]) => (
                                <div key={k}>{k}: {String(v)}</div>
                              ))}
                            </div>
                          </details>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Users list */}
                  <div className="divide-y divide-gray-100">
                    {superAdmins.map((admin) => (
                      <div
                        key={admin.email}
                        className="py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="text-sm font-medium text-gray-900 flex items-center gap-2">
                              {admin.displayName || admin.email}
                              {admin.source === 'db' && (
                                <span className="text-xs text-gray-400">(added via dashboard)</span>
                              )}
                            </div>
                            {admin.displayName && (
                              <div className="text-xs text-gray-500">{admin.email}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {admin.status === 'active' && (
                            <Badge variant="success" size="sm">Active</Badge>
                          )}
                          {admin.status === 'not_registered' && (
                            <>
                              <Badge variant="warning" size="sm">Not registered</Badge>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleSendInvite(admin.email)}
                                disabled={sendingInvite === admin.email}
                              >
                                {sendingInvite === admin.email ? 'Sending...' : 'Invite'}
                              </Button>
                            </>
                          )}
                          {admin.status === 'error' && (
                            <Badge variant="error" size="sm" title={admin.error}>Error</Badge>
                          )}
                          {admin.source === 'db' && (
                            <button
                              onClick={() => handleRemoveEmail(admin.email)}
                              className="text-gray-400 hover:text-red-500 p-1"
                              title="Remove from whitelist"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          <div className="text-xs text-gray-400 ml-2">
                            {admin.lastSignIn
                              ? `Last seen ${new Date(admin.lastSignIn).toLocaleDateString()}`
                              : admin.invitedAt
                              ? `Invited ${new Date(admin.invitedAt).toLocaleDateString()}`
                              : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add user button */}
                  <div className="pt-2">
                    <Button variant="secondary" onClick={() => setShowAddModal(true)}>
                      + Add User
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* System Information */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Information</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Environment</span>
              <Badge variant={systemInfo.environment === 'production' ? 'success' : 'warning'}>
                {systemInfo.environment}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">API URL</span>
              <span className="text-sm font-mono text-gray-600 truncate max-w-xs">
                {systemInfo.apiUrl}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Links</h3>
          <div className="grid grid-cols-2 gap-4">
            <a
              href="/super-admin/uhtd/audit-log"
              className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <div className="text-sm font-medium text-gray-900">Audit Log</div>
              <div className="text-xs text-gray-500">View all UHTD changes</div>
            </a>
            <a
              href="/super-admin/uhtd/review-queue"
              className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <div className="text-sm font-medium text-gray-900">Review Queue</div>
              <div className="text-xs text-gray-500">Pending compatibility records</div>
            </a>
            <a
              href="/super-admin/uhtd/import"
              className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <div className="text-sm font-medium text-gray-900">Bulk Import</div>
              <div className="text-xs text-gray-500">Import data from CSV</div>
            </a>
            <a
              href="/super-admin/tenants"
              className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
            >
              <div className="text-sm font-medium text-gray-900">Tenants</div>
              <div className="text-xs text-gray-500">Manage tenant organizations</div>
            </a>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Super Admin User">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Add an email to the Super Admin whitelist. They&apos;ll be able to register at the signup page.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEmail} disabled={addingEmail || !newEmail.trim()}>
              {addingEmail ? 'Adding...' : 'Add User'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
