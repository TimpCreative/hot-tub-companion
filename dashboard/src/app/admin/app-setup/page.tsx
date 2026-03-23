'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';

type StepId = 'brand' | 'modelPick' | 'sanitizer';

interface OnboardingConfig {
  version: number;
  allowSkip: boolean;
  steps: { id: StepId; enabled: boolean }[];
}

type WidgetType = 'link_tile' | 'dealer_card' | 'tips_list' | 'product_strip';

interface HomeWidget {
  id: string;
  type: WidgetType;
  enabled: boolean;
  order: number;
  props: Record<string, unknown>;
}

interface HomeDashboardConfig {
  version: number;
  widgets: HomeWidget[];
}

interface DealerContact {
  phone: string | null;
  address: string | null;
}

interface Legal {
  termsUrl: string | null;
  privacyUrl: string | null;
}

const STEP_LABELS: Record<StepId, string> = {
  brand: 'Hot tub make (brand)',
  modelPick: 'Model selection (UHTD)',
  sanitizer: 'Sanitizer system',
};

const ROUTE_OPTIONS = ['/shop', '/water-care', '/inbox', '/dealer', '/services', '/onboarding'] as const;
const ICON_OPTIONS = ['mail', 'water', 'cart', 'book', 'medkit', 'build'] as const;

function tipsItemsToText(items: unknown): string {
  if (!Array.isArray(items)) return '';
  return items
    .map((row) => {
      if (!row || typeof row !== 'object') return '';
      const t = (row as { title?: string }).title ?? '';
      const b = (row as { body?: string }).body ?? '';
      return `${t}|${b}`;
    })
    .filter(Boolean)
    .join('\n');
}

function parseTipsText(text: string): { title: string; body: string }[] {
  const out: { title: string; body: string }[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const pipe = trimmed.indexOf('|');
    if (pipe === -1) out.push({ title: trimmed, body: '' });
    else out.push({ title: trimmed.slice(0, pipe).trim(), body: trimmed.slice(pipe + 1).trim() });
  }
  return out;
}

export default function AdminAppSetupPage() {
  const { getIdToken } = useAuth();
  const api = useMemo(() => createTenantApiClient(async () => await getIdToken()), [getIdToken]);

  const [tab, setTab] = useState<'onboarding' | 'home' | 'legal'>('onboarding');
  const [onboarding, setOnboarding] = useState<OnboardingConfig | null>(null);
  const [homeDashboard, setHomeDashboard] = useState<HomeDashboardConfig | null>(null);
  const [dealerPhone, setDealerPhone] = useState('');
  const [dealerAddress, setDealerAddress] = useState('');
  const [termsUrl, setTermsUrl] = useState('');
  const [privacyUrl, setPrivacyUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = (await api.get('/admin/settings/app-setup')) as {
        success?: boolean;
        data?: {
          onboarding?: OnboardingConfig;
          homeDashboard?: HomeDashboardConfig;
          dealerContact?: DealerContact;
          legal?: Legal;
        };
      };
      if (body?.data?.onboarding) setOnboarding(body.data.onboarding);
      if (body?.data?.homeDashboard) setHomeDashboard(body.data.homeDashboard);
      const dc = body?.data?.dealerContact;
      if (dc) {
        setDealerPhone(dc.phone ?? '');
        setDealerAddress(dc.address ?? '');
      }
      const legal = body?.data?.legal;
      if (legal) {
        setTermsUrl(legal.termsUrl ?? '');
        setPrivacyUrl(legal.privacyUrl ?? '');
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'error' in e
          ? (e as { error?: { message?: string } }).error?.message
          : 'Failed to load app setup';
      setError(msg ?? 'Failed to load app setup');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleStep(id: StepId) {
    setOnboarding((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: prev.steps.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
      };
    });
  }

  function setAllowSkip(v: boolean) {
    setOnboarding((prev) => (prev ? { ...prev, allowSkip: v } : prev));
  }

  async function saveOnboarding() {
    if (!onboarding) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body = (await api.put('/admin/settings/app-setup', { onboarding })) as {
        success?: boolean;
        data?: { onboarding?: OnboardingConfig };
        message?: string;
      };
      if (body?.data?.onboarding) setOnboarding(body.data.onboarding);
      setSuccess(body.message ?? 'Saved');
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'error' in e
          ? (e as { error?: { message?: string } }).error?.message
          : 'Failed to save';
      setError(msg ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function sortedWidgets(): HomeWidget[] {
    if (!homeDashboard) return [];
    return [...homeDashboard.widgets].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  function updateWidget(id: string, fn: (w: HomeWidget) => HomeWidget) {
    setHomeDashboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        widgets: prev.widgets.map((w) => (w.id === id ? fn(w) : w)),
      };
    });
  }

  function moveWidget(id: string, dir: -1 | 1) {
    const list = sortedWidgets();
    const idx = list.findIndex((w) => w.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= list.length) return;
    const a = list[idx];
    const b = list[j];
    updateWidget(a.id, (w) => ({ ...w, order: b.order }));
    updateWidget(b.id, (w) => ({ ...w, order: a.order }));
  }

  async function saveHome() {
    if (!homeDashboard) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body = (await api.put('/admin/settings/app-setup', {
        homeDashboard,
        dealerContact: {
          phone: dealerPhone.trim() || null,
          address: dealerAddress.trim() || null,
        },
      })) as {
        success?: boolean;
        data?: { homeDashboard?: HomeDashboardConfig; dealerContact?: DealerContact };
        message?: string;
      };
      if (body?.data?.homeDashboard) setHomeDashboard(body.data.homeDashboard);
      const dc = body?.data?.dealerContact;
      if (dc) {
        setDealerPhone(dc.phone ?? '');
        setDealerAddress(dc.address ?? '');
      }
      setSuccess(body.message ?? 'Saved');
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'error' in e
          ? (e as { error?: { message?: string } }).error?.message
          : 'Failed to save';
      setError(msg ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function saveLegal() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body = (await api.put('/admin/settings/app-setup', {
        legal: {
          termsUrl: termsUrl.trim() || null,
          privacyUrl: privacyUrl.trim() || null,
        },
      })) as {
        success?: boolean;
        data?: { legal?: Legal };
        message?: string;
      };
      const legal = body?.data?.legal;
      if (legal) {
        setTermsUrl(legal.termsUrl ?? '');
        setPrivacyUrl(legal.privacyUrl ?? '');
      }
      setSuccess(body.message ?? 'Saved');
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'error' in e
          ? (e as { error?: { message?: string } }).error?.message
          : 'Failed to save';
      setError(msg ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  if (!onboarding || !homeDashboard) {
    return <div className="rounded-lg bg-red-50 p-4 text-red-700">{error || 'Could not load app setup.'}</div>;
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">App setup</h2>
      <p className="text-gray-600 mb-4">Customer mobile app: onboarding flow and home dashboard.</p>

      <div className="border-b border-gray-200 mb-6 flex gap-4">
        <button
          type="button"
          onClick={() => setTab('onboarding')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 ${
            tab === 'onboarding' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          Onboarding
        </button>
        <button
          type="button"
          onClick={() => setTab('home')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 ${
            tab === 'home' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          Home dashboard
        </button>
        <button
          type="button"
          onClick={() => setTab('legal')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 ${
            tab === 'legal' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          Legal
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-800">{success}</div>}

      {tab === 'onboarding' && (
        <div className="space-y-6 bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600">
            Model selection always stays on (UHTD link required for compatibility).
          </p>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm font-medium text-gray-900">Allow skip</div>
              <div className="text-xs text-gray-500">
                Users can enter the app without finishing hot tub setup (nudged later).
              </div>
            </div>
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={onboarding.allowSkip}
                onChange={(e) => setAllowSkip(e.target.checked)}
              />
              <span className="ml-2 text-sm text-gray-700">Enabled</span>
            </label>
          </div>
          <div className="border-t border-gray-100 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Onboarding steps</h3>
            <ul className="space-y-3">
              {onboarding.steps.map((step) => (
                <li key={step.id} className="flex items-center justify-between gap-4">
                  <span className="text-sm text-gray-800">{STEP_LABELS[step.id]}</span>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={step.enabled}
                      disabled={step.id === 'modelPick'}
                      onChange={() => toggleStep(step.id)}
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      {step.id === 'modelPick' ? 'Always on' : 'Enabled'}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
          <Button type="button" loading={saving} onClick={() => void saveOnboarding()}>
            Save onboarding
          </Button>
        </div>
      )}

      {tab === 'home' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Dealer contact (app)</h3>
            <p className="text-xs text-gray-500">
              Shown on the home dealer card and dealer tab. Not the same as customer account address.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Public phone</label>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={dealerPhone}
                onChange={(e) => setDealerPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Public address</label>
              <textarea
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                rows={2}
                value={dealerAddress}
                onChange={(e) => setDealerAddress(e.target.value)}
                placeholder="Street, city, state, ZIP"
              />
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
            <h3 className="text-sm font-semibold text-gray-900">Home widgets</h3>
            <p className="text-xs text-gray-500">
              Order, enable/disable, and labels. Link targets must match allowed app routes.
            </p>
            {sortedWidgets().map((w, i) => (
              <div key={w.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-gray-800">
                    {w.id}{' '}
                    <span className="text-gray-400 font-normal">({w.type})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center text-xs">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={w.enabled}
                        onChange={() => updateWidget(w.id, (x) => ({ ...x, enabled: !x.enabled }))}
                      />
                      <span className="ml-1">On</span>
                    </label>
                    <button
                      type="button"
                      className="text-xs text-blue-600 disabled:opacity-40"
                      disabled={i === 0}
                      onClick={() => moveWidget(w.id, -1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="text-xs text-blue-600 disabled:opacity-40"
                      disabled={i === sortedWidgets().length - 1}
                      onClick={() => moveWidget(w.id, 1)}
                    >
                      Down
                    </button>
                  </div>
                </div>

                {w.type === 'link_tile' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-gray-600">Title</label>
                      <input
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        value={String(w.props.title ?? '')}
                        onChange={(e) =>
                          updateWidget(w.id, (x) => ({
                            ...x,
                            props: { ...x.props, title: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Subtitle</label>
                      <input
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        value={String(w.props.subtitle ?? '')}
                        onChange={(e) =>
                          updateWidget(w.id, (x) => ({
                            ...x,
                            props: { ...x.props, subtitle: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Icon key</label>
                      <select
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        value={String(w.props.iconKey ?? 'mail')}
                        onChange={(e) =>
                          updateWidget(w.id, (x) => ({
                            ...x,
                            props: { ...x.props, iconKey: e.target.value },
                          }))
                        }
                      >
                        {ICON_OPTIONS.map((k) => (
                          <option key={k} value={k}>
                            {k}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Target route</label>
                      <select
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        value={String(w.props.targetRoute ?? '/shop')}
                        onChange={(e) =>
                          updateWidget(w.id, (x) => ({
                            ...x,
                            props: { ...x.props, targetRoute: e.target.value },
                          }))
                        }
                      >
                        {ROUTE_OPTIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {w.type === 'dealer_card' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-gray-600">Title</label>
                      <input
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        value={String(w.props.title ?? '')}
                        onChange={(e) =>
                          updateWidget(w.id, (x) => ({
                            ...x,
                            props: { ...x.props, title: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Subtitle</label>
                      <input
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        value={String(w.props.subtitle ?? '')}
                        onChange={(e) =>
                          updateWidget(w.id, (x) => ({
                            ...x,
                            props: { ...x.props, subtitle: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                )}

                {w.type === 'tips_list' && (
                  <div className="space-y-2">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <label className="text-xs text-gray-600">Title</label>
                        <input
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          value={String(w.props.title ?? '')}
                          onChange={(e) =>
                            updateWidget(w.id, (x) => ({
                              ...x,
                              props: { ...x.props, title: e.target.value },
                            }))
                          }
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Subtitle</label>
                        <input
                          className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                          value={String(w.props.subtitle ?? '')}
                          onChange={(e) =>
                            updateWidget(w.id, (x) => ({
                              ...x,
                              props: { ...x.props, subtitle: e.target.value },
                            }))
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Tips (one per line: Title|Body)</label>
                      <textarea
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-mono text-xs"
                        rows={5}
                        value={tipsItemsToText(w.props.items)}
                        onChange={(e) =>
                          updateWidget(w.id, (x) => ({
                            ...x,
                            props: { ...x.props, items: parseTipsText(e.target.value) },
                          }))
                        }
                      />
                    </div>
                  </div>
                )}

                {w.type === 'product_strip' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-gray-600">Title</label>
                      <input
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        value={String(w.props.title ?? '')}
                        onChange={(e) =>
                          updateWidget(w.id, (x) => ({
                            ...x,
                            props: { ...x.props, title: e.target.value },
                          }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Subtitle</label>
                      <input
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        value={String(w.props.subtitle ?? '')}
                        onChange={(e) =>
                          updateWidget(w.id, (x) => ({
                            ...x,
                            props: { ...x.props, subtitle: e.target.value },
                          }))
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <Button type="button" loading={saving} onClick={() => void saveHome()}>
            Save home dashboard
          </Button>
        </div>
      )}

      {tab === 'legal' && (
        <div className="space-y-6 bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900">Legal URLs</h3>
          <p className="text-xs text-gray-500">
            Links shown in the mobile app Profile section (Terms of Service, Privacy Policy).
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Terms of Service URL</label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              type="url"
              value={termsUrl}
              onChange={(e) => setTermsUrl(e.target.value)}
              placeholder="https://example.com/terms"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Privacy Policy URL</label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              type="url"
              value={privacyUrl}
              onChange={(e) => setPrivacyUrl(e.target.value)}
              placeholder="https://example.com/privacy"
            />
          </div>
          <Button type="button" loading={saving} onClick={() => void saveLegal()}>
            Save legal
          </Button>
        </div>
      )}
    </div>
  );
}
