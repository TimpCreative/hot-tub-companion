'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface SuperAdminUser {
  email: string;
  displayName: string | null;
  lastSignIn: string | null;
  createdAt: string | null;
  status: 'active' | 'not_registered' | 'error';
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
  const { user, logout, getIdToken } = useAuth();
  const [superAdmins, setSuperAdmins] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) {
        setFetchError('Not authenticated');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/dashboard/super-admin/settings', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (data.success) {
        setSuperAdmins(data.data?.users || []);
        setAllowedEmails(data.data?.allowedEmails || []);
        setDiagnostics(data.data?.diagnostics || null);
      } else {
        setFetchError(data.error?.message || 'Failed to fetch settings');
      }
    } catch (err: any) {
      console.error('Error fetching settings:', err);
      setFetchError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [getIdToken]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

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

        {/* Super Admin Users */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Super Admin Users</h3>
          <p className="text-sm text-gray-500 mb-4">
            Users with Super Admin access to the platform. To add new users, update the{' '}
            <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">SUPER_ADMIN_EMAILS</code>{' '}
            environment variable in the API.
          </p>
          
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-10 bg-gray-100 rounded"></div>
              <div className="h-10 bg-gray-100 rounded"></div>
            </div>
          ) : fetchError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm font-medium text-red-800">Error fetching settings</div>
              <div className="text-xs text-red-600 mt-1">{fetchError}</div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Diagnostics (if there are issues) */}
              {diagnostics && (diagnostics.lookupErrors.length > 0 || !diagnostics.envVarSet || diagnostics.firebaseInitError) && (
                <div className={`p-3 border rounded-lg ${diagnostics.firebaseInitError ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <div className={`text-sm font-medium mb-2 ${diagnostics.firebaseInitError ? 'text-red-800' : 'text-yellow-800'}`}>Diagnostics</div>
                  <div className={`text-xs space-y-1 ${diagnostics.firebaseInitError ? 'text-red-700' : 'text-yellow-700'}`}>
                    <div>Firebase configured: {diagnostics.firebaseConfigured ? '✓' : '✗'}</div>
                    {diagnostics.firebaseInitError && (
                      <div className="text-red-600 font-medium">
                        Firebase Error: {diagnostics.firebaseInitError}
                      </div>
                    )}
                    <div>SUPER_ADMIN_EMAILS set: {diagnostics.envVarSet ? `✓ (${diagnostics.emailCount} emails)` : '✗ Not set'}</div>
                    {diagnostics.lookupErrors.length > 0 && (
                      <div className="mt-2">
                        <div className="font-medium">Lookup errors:</div>
                        {diagnostics.lookupErrors.map((err, i) => (
                          <div key={i} className="text-red-600">• {err}</div>
                        ))}
                      </div>
                    )}
                    {diagnostics.firebaseKeyDebug && (
                      <div className="mt-2 p-2 bg-white/50 rounded text-xs font-mono">
                        <div className="font-medium mb-1">Key Debug Info:</div>
                        {Object.entries(diagnostics.firebaseKeyDebug).map(([k, v]) => (
                          <div key={k}>{k}: {String(v)}</div>
                        ))}
                      </div>
                    )}
                    {diagnostics.firebaseInitError && (
                      <div className="mt-3 p-2 bg-white/50 rounded text-xs">
                        <strong>How to fix:</strong> Check the <code className="bg-gray-100 px-1 rounded">FIREBASE_PRIVATE_KEY</code> environment variable in Railway. 
                        The key should NOT have surrounding quotes, and newlines should be represented as literal <code className="bg-gray-100 px-1 rounded">\n</code> characters.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Allowed emails from env */}
              {allowedEmails.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Allowed Emails (from config)</h4>
                  <div className="flex flex-wrap gap-2">
                    {allowedEmails.map((email) => (
                      <span
                        key={email}
                        className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full"
                      >
                        {email}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Users list */}
              {superAdmins.length > 0 ? (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Users</h4>
                  <div className="divide-y divide-gray-100">
                    {superAdmins.map((admin) => (
                      <div
                        key={admin.email}
                        className="py-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {admin.displayName || admin.email}
                            </div>
                            {admin.displayName && (
                              <div className="text-xs text-gray-500">{admin.email}</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {admin.status === 'active' && (
                            <Badge variant="success" size="sm">Active</Badge>
                          )}
                          {admin.status === 'not_registered' && (
                            <Badge variant="warning" size="sm">Not registered</Badge>
                          )}
                          {admin.status === 'error' && (
                            <Badge variant="error" size="sm" title={admin.error}>Error</Badge>
                          )}
                          <div className="text-xs text-gray-400">
                            {admin.lastSignIn
                              ? `Last seen ${new Date(admin.lastSignIn).toLocaleDateString()}`
                              : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  No Super Admin users configured. Set the SUPER_ADMIN_EMAILS environment variable.
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
    </div>
  );
}
