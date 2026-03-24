'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export default function SuperAdminAnnouncementsPage() {
  const fetchWithAuth = useSuperAdminFetch();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [target, setTarget] = useState<'all_customers' | 'tenant_customers'>('all_customers');
  const [targetTenantId, setTargetTenantId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function loadTenants() {
      try {
        const res = await fetchWithAuth('/api/dashboard/super-admin/tenants');
        const data = await res.json();
        if (data.success && data.data?.tenants) {
          setTenants(data.data.tenants);
        }
      } catch {
        // ignore
      }
    }
    loadTenants();
  }, [fetchWithAuth]);

  async function handleSend() {
    const t = title.trim();
    const b = body.trim();
    if (!t || !b) {
      setError('Title and body are required');
      return;
    }
    if (target === 'tenant_customers' && !targetTenantId) {
      setError('Select a tenant when targeting tenant customers');
      return;
    }

    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetchWithAuth('/api/dashboard/super-admin/announcements/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          targetTenantId: target === 'tenant_customers' ? targetTenantId : undefined,
          title: t,
          body: b,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const sent = data.data?.sent ?? 0;
        const failed = data.data?.failed ?? 0;
        setSuccess(`Sent to ${sent} devices.${failed > 0 ? ` ${failed} failed.` : ''}`);
        setTitle('');
        setBody('');
      } else {
        setError(data.error?.message ?? 'Failed to send');
      }
    } catch (err: unknown) {
      const e = err instanceof Error ? err : { message: 'Failed to send' };
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Global Push Announcements</h2>
      <p className="text-gray-600 mb-6">
        Send push notifications to all customers or to a specific tenant&apos;s customers.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-800">{success}</div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Target</label>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value as 'all_customers' | 'tenant_customers')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="all_customers">All customers (all tenants)</option>
            <option value="tenant_customers">Specific tenant&apos;s customers</option>
          </select>
        </div>

        {target === 'tenant_customers' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tenant</label>
            <select
              value={targetTenantId}
              onChange={(e) => setTargetTenantId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Select tenant</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. System maintenance"
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            maxLength={255}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="e.g. Scheduled maintenance tonight 11pm–1am MT."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 min-h-[100px]"
            maxLength={2000}
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={sending || !title.trim() || !body.trim() || (target === 'tenant_customers' && !targetTenantId)}
        >
          {sending ? 'Sending...' : 'Send Now'}
        </Button>
      </div>
    </div>
  );
}
