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
  schedule_mode?: string | null;
  send_at_time?: string | null;
}

interface ProductOption {
  id: string;
  title: string;
}

function formatDateTime(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const tz = timeZone && timeZone.trim() ? timeZone.trim() : 'UTC';
    return d.toLocaleString('en-US', {
      timeZone: tz,
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return '—';
  }
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
  return <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{formatted}</span>;
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
  const [composeScheduleMode, setComposeScheduleMode] = useState<'retailer_time' | 'user_local_time'>('retailer_time');
  const [composePastHandling, setComposePastHandling] = useState<'send_immediately' | 'push_next_day'>('send_immediately');
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
      const sendAtTime =
        composeScheduleMode === 'user_local_time' && composeSendAt.trim()
          ? composeSendAt.trim().includes('T')
            ? composeSendAt.trim().split('T')[1]?.slice(0, 5) || '09:00'
            : '09:00'
          : undefined;

      const res = (await api.post('/admin/notifications', {
        title,
        body,
        sendAt,
        target: 'all_customers',
        linkType: linkType ?? null,
        linkId: linkId ?? null,
        imageUrl: composeImageUrl.trim() || null,
        scheduleMode: composeScheduleMode,
        sendAtTime: sendAtTime ?? undefined,
        pastTimezoneHandling: composeScheduleMode === 'user_local_time' ? composePastHandling : undefined,
      })) as { data?: { status?: string }; error?: { message?: string } };
      const status = res?.data?.status;
      setSuccess(status === 'sent' ? 'Notification sent' : 'Notification scheduled');
      setComposeTitle('');
      setComposeBody('');
      setComposeSendAt('');
      setComposeScheduleMode('retailer_time');
      setComposePastHandling('send_immediately');
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
      <h2 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Push Notifications</h2>
      <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>
        Compose and schedule push notifications to customers with promotional preferences enabled.
      </p>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
      )}
      {success && (
        <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-800">{success}</div>
      )}

      <div className="card mb-8 rounded-lg p-6">
        <h3 className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>Compose</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Title (max 255)</label>
            <input
              type="text"
              value={composeTitle}
              onChange={(e) => setComposeTitle(e.target.value)}
              placeholder="e.g. Spring sale!"
              className="w-full rounded-lg border px-3 py-2"
              maxLength={255}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Body (max 2000)</label>
            <textarea
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
              placeholder="e.g. 20% off all chemicals this weekend."
              className="w-full rounded-lg border px-3 py-2 min-h-[80px]"
              maxLength={2000}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Deep link (optional)</label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              Where to open when the user taps the notification.
            </p>
            <select
              value={composeLinkType}
              onChange={(e) => {
                setComposeLinkType(e.target.value);
                setComposeLinkId('');
              }}
              className="w-full rounded-lg border px-3 py-2 mb-2"
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
                  className="w-full rounded-lg border px-3 py-2 mb-2"
                />
                {productSearching && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Searching...</p>}
                {productOptions.length > 0 && (
                  <select
                    value={composeLinkId}
                    onChange={(e) => setComposeLinkId(e.target.value)}
                    className="w-full rounded-lg border px-3 py-2"
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
                className="w-full rounded-lg border px-3 py-2 mt-2"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Image URL (optional)</label>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
              Public image URL for rich notification. JPEG, PNG, under 1MB recommended.
            </p>
            <input
              type="url"
              value={composeImageUrl}
              onChange={(e) => setComposeImageUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Schedule</label>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Retailer timezone: <strong>{retailerTimezone}</strong>
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>•</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Current retailer time: <RetailerTimeDisplay timezone={retailerTimezone} />
              </span>
            </div>
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleMode"
                    checked={composeScheduleMode === 'retailer_time'}
                    onChange={() => setComposeScheduleMode('retailer_time')}
                  />
                  <span className="text-sm">Retailer time</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scheduleMode"
                    checked={composeScheduleMode === 'user_local_time'}
                    onChange={() => setComposeScheduleMode('user_local_time')}
                  />
                  <span className="text-sm">Each user&apos;s local time</span>
                </label>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {composeScheduleMode === 'retailer_time'
                  ? 'All recipients get the notification at the same moment (retailer timezone).'
                  : 'Each recipient gets it at this time in their timezone. Users without a timezone use retailer timezone.'}
              </p>
              {composeScheduleMode === 'user_local_time' && (
                <div className="pt-2 border-t" style={{ borderColor: 'var(--card-border)' }}>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    If the time has already passed for some timezones:
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="pastHandling"
                        checked={composePastHandling === 'send_immediately'}
                        onChange={() => setComposePastHandling('send_immediately')}
                      />
                      <span className="text-sm">Send immediately</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="pastHandling"
                        checked={composePastHandling === 'push_next_day'}
                        onChange={() => setComposePastHandling('push_next_day')}
                      />
                      <span className="text-sm">Push to next day at same time</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
            <input
              type="datetime-local"
              value={composeSendAt}
              onChange={(e) => setComposeSendAt(e.target.value)}
              className="rounded-lg border px-3 py-2"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {composeScheduleMode === 'retailer_time'
                ? 'Time is in your browser\'s local timezone. Use retailer time above to confirm.'
                : 'Date and time slot for each user (in their timezone).'}
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
            statusFilter === 'scheduled' ? 'text-white' : ''
          }`}
          style={
            statusFilter === 'scheduled'
              ? { backgroundColor: primaryColor }
              : {
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--input-border)',
                }
          }
        >
          Scheduled
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter('sent')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            statusFilter === 'sent' ? 'text-white' : ''
          }`}
          style={
            statusFilter === 'sent'
              ? { backgroundColor: primaryColor }
              : {
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--input-border)',
                }
          }
        >
          Sent
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      ) : list.length === 0 ? (
        <div className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
          No {statusFilter} notifications.
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((n) => (
            <li
              key={n.id}
              className="card rounded-lg p-4 flex justify-between items-start"
            >
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{n.body}</p>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                  {n.status === 'scheduled'
                    ? n.schedule_mode === 'user_local_time'
                      ? `Scheduled: ${new Date(n.send_at).toISOString().slice(0, 10)} at ${n.send_at_time || '09:00'} (each user's local time)`
                      : `Scheduled: ${formatDateTime(n.send_at, retailerTimezone)}`
                    : `Sent: ${n.sent_at ? formatDateTime(n.sent_at, retailerTimezone) : '—'}`}
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
