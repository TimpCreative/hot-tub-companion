'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';

const LINK_TYPES = [
  { value: '', label: 'None' },
  { value: 'shop', label: 'Shop' },
  { value: 'product', label: 'Product' },
  { value: 'inbox', label: 'Inbox' },
  { value: 'dealer', label: 'Dealer' },
  { value: 'services', label: 'Services' },
  { value: 'home', label: 'Home' },
  { value: 'custom_url', label: 'Custom URL' },
] as const;

interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  send_at: string;
  sent_at: string | null;
  status: string;
  recipients_count: number;
  delivered_count: number;
  created_at: string;
  link_type?: string | null;
  link_id?: string | null;
  image_url?: string | null;
}

interface ProductOption {
  id: string;
  title: string;
}

function RetailerTimeDisplay({ timezone }: { timezone: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const formatted = now.toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
  return <span className="text-sm font-medium text-gray-700">{formatted}</span>;
}

export default function AdminNotificationsPage() {
  const { getIdToken } = useAuth();
  const { config } = useTenant();
  const api = useMemo(() => createTenantApiClient(async () => await getIdToken()), [getIdToken]);

  const retailerTimezone = config?.branding?.timezone ?? config?.timezone ?? 'America/Denver';

  const [statusFilter, setStatusFilter] = useState<'scheduled' | 'sent'>('scheduled');
  const [list, setList] = useState<ScheduledNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [composeTitle, setComposeTitle] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [composeSendAt, setComposeSendAt] = useState('');
  const [composeLinkType, setComposeLinkType] = useState<string>('');
  const [composeLinkId, setComposeLinkId] = useState('');
  const [composeImageUrl, setComposeImageUrl] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productSearching, setProductSearching] = useState(false);
  const [composeSending, setComposeSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await api.get(`/admin/notifications?status=${statusFilter}`)) as {
        data?: { notifications?: ScheduledNotification[] };
        error?: { message?: string };
      };
      if (res?.data?.notifications) {
        setList(res.data.notifications);
      } else if (res?.error) {
        setError(res.error.message ?? 'Failed to load');
        setList([]);
      }
    } catch (e: unknown) {
      const err = e as { error?: { message?: string }; message?: string };
      setError(err?.error?.message ?? err?.message ?? 'Failed to load');
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [api, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (composeLinkType !== 'product' || !productSearch.trim()) {
      setProductOptions([]);
      return;
    }
    let cancelled = false;
    setProductSearching(true);
    api
      .get(`/admin/products?search=${encodeURIComponent(productSearch)}&pageSize=20`)
      .then((res: any) => {
        if (cancelled) return;
        const body = res?.data ?? res;
        const rows = body?.data ?? body?.products ?? [];
        setProductOptions(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setProductOptions([]);
      })
      .finally(() => {
        if (!cancelled) setProductSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, composeLinkType, productSearch]);

  async function handleSchedule() {
    const title = composeTitle.trim();
    const body = composeBody.trim();
    if (!title || !body) {
      setError('Title and body are required');
      return;
    }
    if (title.length > 255) {
      setError('Title must be at most 255 characters');
      return;
    }
    if (body.length > 2000) {
      setError('Body must be at most 2000 characters');
      return;
    }

    let linkType: string | undefined;
    let linkId: string | undefined;
    if (composeLinkType === 'custom_url' && composeLinkId.trim()) {
      linkType = 'custom_url';
      linkId = composeLinkId.trim();
    } else if (composeLinkType === 'product' && composeLinkId.trim()) {
      linkType = 'product';
      linkId = composeLinkId.trim();
    } else if (composeLinkType && composeLinkType !== 'product' && composeLinkType !== 'custom_url') {
      linkType = composeLinkType;
      linkId = composeLinkType; // screen-only: app routes on linkType
    }

    setComposeSending(true);
    setError(null);
    setSuccess(null);
    try {
      const sendAt = composeSendAt.trim()
        ? new Date(composeSendAt).toISOString()
        : new Date().toISOString();
      await api.post('/admin/notifications', {
        title,
        body,
        sendAt,
        target: 'all_customers',
        linkType: linkType ?? null,
        linkId: linkId ?? null,
        imageUrl: composeImageUrl.trim() || null,
      });
      setSuccess('Notification scheduled');
      setComposeTitle('');
      setComposeBody('');
      setComposeSendAt('');
      setComposeLinkType('');
      setComposeLinkId('');
      setComposeImageUrl('');
      void load();
    } catch (e: unknown) {
      const err = e as { error?: { message?: string }; message?: string };
      setError(err?.error?.message ?? err?.message ?? 'Failed to schedule');
    } finally {
      setComposeSending(false);
    }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this scheduled notification?')) return;
    setError(null);
    try {
      await api.delete(`/admin/notifications/${id}/cancel`);
      setSuccess('Notification cancelled');
      void load();
    } catch (e: unknown) {
      const err = e as { error?: { message?: string }; message?: string };
      setError(err?.error?.message ?? err?.message ?? 'Failed to cancel');
    }
  }

  const primaryColor = config?.branding?.primaryColor ?? '#1B4D7A';

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Push Notifications</h2>
      <p className="text-gray-600 mb-6">
        Compose and schedule push notifications to customers with promotional preferences enabled.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-800">{success}</div>
      )}

      <div className="mb-8 rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Compose</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title (max 255)</label>
            <input
              type="text"
              value={composeTitle}
              onChange={(e) => setComposeTitle(e.target.value)}
              placeholder="e.g. Spring sale!"
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              maxLength={255}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body (max 2000)</label>
            <textarea
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              placeholder="e.g. 20% off all chemicals this weekend."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 min-h-[80px]"
              maxLength={2000}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deep link (optional)</label>
            <p className="text-xs text-gray-500 mb-2">
              Where to open when the user taps the notification.
            </p>
            <select
              value={composeLinkType}
              onChange={(e) => {
                setComposeLinkType(e.target.value);
                setComposeLinkId('');
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 mb-2"
            >
              {LINK_TYPES.map((opt) => (
                <option key={opt.value || 'none'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {composeLinkType === 'product' && (
              <div className="mt-2">
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 mb-2"
                />
                {productSearching && <p className="text-sm text-gray-500">Searching...</p>}
                {productOptions.length > 0 && (
                  <select
                    value={composeLinkId}
                    onChange={(e) => setComposeLinkId(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="">Select a product</option>
                    {productOptions.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            {composeLinkType === 'custom_url' && (
              <input
                type="url"
                value={composeLinkId}
                onChange={(e) => setComposeLinkId(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 mt-2"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image URL (optional)</label>
            <p className="text-xs text-gray-500 mb-2">
              Public image URL for rich notification. JPEG, PNG, under 1MB recommended.
            </p>
            <input
              type="url"
              value={composeImageUrl}
              onChange={(e) => setComposeImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Send at (leave empty for now)</label>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-xs text-gray-500">
                Retailer timezone: <strong>{retailerTimezone}</strong>
              </span>
              <span className="text-xs text-gray-400">•</span>
              <span className="text-xs text-gray-500">
                Current retailer time: <RetailerTimeDisplay timezone={retailerTimezone} />
              </span>
            </div>
            <input
              type="datetime-local"
              value={composeSendAt}
              onChange={(e) => setComposeSendAt(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2"
            />
            <p className="text-xs text-gray-500 mt-1">
              Time is in your browser&apos;s local timezone. Use retailer time above to confirm.
            </p>
          </div>
          <Button
            onClick={handleSchedule}
            disabled={composeSending || !composeTitle.trim() || !composeBody.trim()}
          >
            {composeSending ? 'Sending...' : composeSendAt ? 'Schedule' : 'Send Now'}
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setStatusFilter('scheduled')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            statusFilter === 'scheduled'
              ? 'text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          style={statusFilter === 'scheduled' ? { backgroundColor: primaryColor } : {}}
        >
          Scheduled
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('sent')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            statusFilter === 'sent'
              ? 'text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
          style={statusFilter === 'sent' ? { backgroundColor: primaryColor } : {}}
        >
          Sent
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-500">Loading...</div>
      ) : list.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          No {statusFilter} notifications.
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((n) => (
            <li
              key={n.id}
              className="rounded-lg border border-gray-200 bg-white p-4 flex justify-between items-start"
            >
              <div>
                <p className="font-medium text-gray-900">{n.title}</p>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{n.body}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {n.status === 'scheduled'
                    ? `Scheduled: ${new Date(n.send_at).toLocaleString('en-US', {
                        timeZone: retailerTimezone,
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZoneName: 'short',
                      })}`
                    : `Sent: ${n.sent_at ? new Date(n.sent_at).toLocaleString('en-US', {
                        timeZone: retailerTimezone,
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZoneName: 'short',
                      }) : '—'}`}
                  {n.recipients_count > 0 && ` • ${n.delivered_count}/${n.recipients_count} delivered`}
                </p>
              </div>
              {n.status === 'scheduled' && (
                <button
                  type="button"
                  onClick={() => handleCancel(n.id)}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
