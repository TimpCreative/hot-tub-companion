'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface SuperAdminUser {
  email: string;
  displayName: string | null;
  lastSignIn: string | null;
  createdAt: string | null;
}

interface SystemInfo {
  environment: string;
  version: string;
  apiUrl: string;
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [superAdmins, setSuperAdmins] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowedEmails, setAllowedEmails] = useState<string[]>([]);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch('/api/dashboard/super-admin/settings');
        const data = await res.json();
        if (data.success) {
          setSuperAdmins(data.data?.users || []);
          setAllowedEmails(data.data?.allowedEmails || []);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSettings();
  }, []);

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
          ) : (
            <div className="space-y-3">
              {/* Allowed emails from env */}
              {allowedEmails.length > 0 && (
                <div className="mb-4">
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

              {/* Registered users */}
              {superAdmins.length > 0 ? (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Registered Users</h4>
                  <div className="divide-y divide-gray-100">
                    {superAdmins.map((admin) => (
                      <div
                        key={admin.email}
                        className="py-3 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {admin.displayName || 'No name'}
                          </div>
                          <div className="text-xs text-gray-500">{admin.email}</div>
                        </div>
                        <div className="text-xs text-gray-400">
                          {admin.lastSignIn
                            ? `Last seen ${new Date(admin.lastSignIn).toLocaleDateString()}`
                            : 'Never signed in'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No registered Super Admin users found.</div>
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
