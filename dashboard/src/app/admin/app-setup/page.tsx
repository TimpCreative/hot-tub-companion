'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useUnsavedChanges } from '@/contexts/UnsavedChangesContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { HomeDashboardMockup } from '@/components/HomeDashboardMockup';

type StepId = 'brand' | 'modelPick' | 'sanitizer';

interface WelcomeBlock {
  greetingLine1: string;
  greetingLine2: string;
}

interface OnboardingConfig {
  version: number;
  allowSkip: boolean;
  steps: { id: StepId; enabled: boolean }[];
  welcomeBlock?: WelcomeBlock;
}

type WidgetType = 'dealer_card' | 'tips_list' | 'product_strip';

interface HomeWidget {
  id: string;
  type: WidgetType;
  enabled: boolean;
  order: number;
  props: Record<string, unknown>;
}

interface QuickLink {
  id: string;
  title: string;
  subtitle?: string;
  iconKey: string;
  targetRoute: string;
  iconColor?: string;
  iconBgColor?: string;
  enabled: boolean;
  order: number;
}

interface HomeDashboardConfig {
  version: number;
  quickLinks: QuickLink[];
  quickLinksLayout: 'single' | 'double';
  widgets: HomeWidget[];
}

interface WaterCareConfig {
  testingTipsTitle: string;
  testingTips: { text: string }[];
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
  sanitizer: 'Sanitation system',
};

const ROUTE_OPTIONS = ['/shop', '/water-care', '/inbox', '/dealer', '/services', '/onboarding'] as const;
const ICON_OPTIONS = ['mail', 'water', 'cart', 'book', 'medkit', 'build', 'storefront'] as const;

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
  const { config } = useTenant();
  const { setUnsavedChanges } = useUnsavedChanges();
  const api = useMemo(() => createTenantApiClient(async () => await getIdToken()), [getIdToken]);
  const primaryColor = config?.branding?.primaryColor ?? '#1B4D7A';

  const markDirty = useCallback(() => setUnsavedChanges(true), [setUnsavedChanges]);

  const [tab, setTab] = useState<'onboarding' | 'home' | 'waterCare' | 'legal'>('onboarding');
  const [onboarding, setOnboarding] = useState<OnboardingConfig | null>(null);
  const [homeDashboard, setHomeDashboard] = useState<HomeDashboardConfig | null>(null);
  const [waterCare, setWaterCare] = useState<WaterCareConfig | null>(null);
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
          waterCare?: WaterCareConfig;
          dealerContact?: DealerContact;
          legal?: Legal;
        };
      };
      if (body?.data?.onboarding) setOnboarding(body.data.onboarding);
      if (body?.data?.homeDashboard) {
        const hd = body.data.homeDashboard as unknown as Record<string, unknown>;
        const base = body.data.homeDashboard as HomeDashboardConfig;
        setHomeDashboard({
          ...base,
          quickLinks: Array.isArray(hd.quickLinks) ? (hd.quickLinks as QuickLink[]) : [],
          quickLinksLayout: hd.quickLinksLayout === 'double' ? 'double' : 'single',
        });
      }
      if (body?.data?.waterCare) setWaterCare(body.data.waterCare);
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
      setUnsavedChanges(false);
    }
  }, [api, setUnsavedChanges]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleStep(id: StepId) {
    markDirty();
    setOnboarding((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: prev.steps.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
      };
    });
  }

  function setAllowSkip(v: boolean) {
    markDirty();
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
      setUnsavedChanges(false);
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

  function sortedQuickLinks(): QuickLink[] {
    if (!homeDashboard?.quickLinks) return [];
    return [...homeDashboard.quickLinks].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  function updateQuickLink(id: string, fn: (q: QuickLink) => QuickLink) {
    markDirty();
    setHomeDashboard((prev) => {
      if (!prev?.quickLinks) return prev;
      return {
        ...prev,
        quickLinks: prev.quickLinks.map((q) => (q.id === id ? fn(q) : q)),
      };
    });
  }

  function moveQuickLink(id: string, dir: -1 | 1) {
    markDirty();
    const list = sortedQuickLinks();
    const idx = list.findIndex((q) => q.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= list.length) return;
    const a = list[idx];
    const b = list[j];
    updateQuickLink(a.id, (q) => ({ ...q, order: b.order }));
    updateQuickLink(b.id, (q) => ({ ...q, order: a.order }));
  }

  function sortedWidgets(): HomeWidget[] {
    if (!homeDashboard) return [];
    return [...homeDashboard.widgets].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  function updateWidget(id: string, fn: (w: HomeWidget) => HomeWidget) {
    markDirty();
    setHomeDashboard((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        widgets: prev.widgets.map((w) => (w.id === id ? fn(w) : w)),
      };
    });
  }

  function moveWidget(id: string, dir: -1 | 1) {
    markDirty();
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
      setUnsavedChanges(false);
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

  async function saveWaterCare() {
    if (!waterCare) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body = (await api.put('/admin/settings/app-setup', { waterCare })) as {
        success?: boolean;
        data?: { waterCare?: WaterCareConfig };
        message?: string;
      };
      if (body?.data?.waterCare) setWaterCare(body.data.waterCare);
      setSuccess(body.message ?? 'Saved');
      setUnsavedChanges(false);
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
      setUnsavedChanges(false);
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

    if (!onboarding || !homeDashboard || !waterCare) {
    return <div className="rounded-lg bg-red-50 p-4 text-red-700">{error || 'Could not load app setup.'}</div>;
  }

  return (
    <div className={tab === 'home' ? 'max-w-6xl' : 'max-w-3xl'}>
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
        <button
          type="button"
          onClick={() => setTab('waterCare')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 ${
            tab === 'waterCare' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          Water Care
        </button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-800">{success}</div>}

      {tab === 'onboarding' && (
        <div className="card space-y-6 rounded-lg p-6">
          <div className="border-b border-gray-100 pb-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Welcome screen</h3>
            <p className="text-xs text-gray-500 mb-3">
              Shown once after first spa registration. Use {'{{name}}'} for first name, {'{{retailer}}'} for your business name.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Greeting (line 1)</label>
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  value={onboarding.welcomeBlock?.greetingLine1 ?? 'Hey {{name}}!'}
                  onChange={(e) => {
                    markDirty();
                    setOnboarding((prev) =>
                      prev
                        ? {
                            ...prev,
                            welcomeBlock: {
                              ...(prev.welcomeBlock ?? {
                                greetingLine1: 'Hey {{name}}!',
                                greetingLine2: 'Welcome to {{retailer}}',
                              }),
                              greetingLine1: e.target.value,
                            },
                          }
                        : prev
                    );
                  }}
                  placeholder="Hey {{name}}!"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Greeting (line 2)</label>
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  value={onboarding.welcomeBlock?.greetingLine2 ?? 'Welcome to {{retailer}}'}
                  onChange={(e) => {
                    markDirty();
                    setOnboarding((prev) =>
                      prev
                        ? {
                            ...prev,
                            welcomeBlock: {
                              ...(prev.welcomeBlock ?? {
                                greetingLine1: 'Hey {{name}}!',
                                greetingLine2: 'Welcome to {{retailer}}',
                              }),
                              greetingLine2: e.target.value,
                            },
                          }
                        : prev
                    );
                  }}
                  placeholder="Welcome to {{retailer}}"
                />
              </div>
            </div>
          </div>
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
        <div className="flex gap-8">
          <div className="min-w-0 flex-1 space-y-6">
          <div className="card rounded-lg p-6 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Dealer contact (app)</h3>
            <p className="text-xs text-gray-500">
              Shown on the home dealer card and dealer tab. Not the same as customer account address.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Public phone</label>
              <input
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                value={dealerPhone}
                onChange={(e) => {
                  markDirty();
                  setDealerPhone(e.target.value);
                }}
                placeholder="(555) 123-4567"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Public address</label>
              <textarea
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                rows={2}
                value={dealerAddress}
                onChange={(e) => {
                  markDirty();
                  setDealerAddress(e.target.value);
                }}
                placeholder="Street, city, state, ZIP"
              />
            </div>
          </div>

          <div className="card rounded-lg p-6 space-y-6">
            <h3 className="text-sm font-semibold text-gray-900">Quick Links</h3>
            <p className="text-xs text-gray-500">
              Icon links shown first on the home screen. Up to 4 items.
            </p>
            <div className="flex items-center gap-4">
              <span className="text-xs font-medium text-gray-700">Layout:</span>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="quickLinksLayout"
                  className="border-gray-300"
                  checked={homeDashboard.quickLinksLayout === 'single'}
                  onChange={() => {
                    markDirty();
                    setHomeDashboard((p) => (p ? { ...p, quickLinksLayout: 'single' } : p));
                  }}
                />
                <span className="text-sm text-gray-700">Single column (full cards)</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="quickLinksLayout"
                  className="border-gray-300"
                  checked={homeDashboard.quickLinksLayout === 'double'}
                  onChange={() => {
                    markDirty();
                    setHomeDashboard((p) => (p ? { ...p, quickLinksLayout: 'double' } : p));
                  }}
                />
                <span className="text-sm text-gray-700">Double column (compact, icon + title only)</span>
              </label>
            </div>
            {sortedQuickLinks().map((q, i) => (
              <div key={q.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-gray-800">{q.title}</div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={q.enabled}
                        onChange={() =>
                          updateQuickLink(q.id, (x) => ({ ...x, enabled: !x.enabled }))
                        }
                      />
                      <span className="ml-1 text-gray-700">On</span>
                    </label>
                    <button
                      type="button"
                      className="text-xs text-blue-600 disabled:opacity-40"
                      disabled={i === 0}
                      onClick={() => moveQuickLink(q.id, -1)}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      className="text-xs text-blue-600 disabled:opacity-40"
                      disabled={i === sortedQuickLinks().length - 1}
                      onClick={() => moveQuickLink(q.id, 1)}
                    >
                      Down
                    </button>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-gray-600">Title</label>
                    <input
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      value={q.title}
                      onChange={(e) =>
                        updateQuickLink(q.id, (x) => ({ ...x, title: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Subtitle</label>
                    <input
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      value={q.subtitle ?? ''}
                      onChange={(e) =>
                        updateQuickLink(q.id, (x) => ({
                          ...x,
                          subtitle: e.target.value || undefined,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Icon key</label>
                    <select
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      value={q.iconKey}
                      onChange={(e) =>
                        updateQuickLink(q.id, (x) => ({ ...x, iconKey: e.target.value }))
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
                      value={q.targetRoute}
                      onChange={(e) =>
                        updateQuickLink(q.id, (x) => ({ ...x, targetRoute: e.target.value }))
                      }
                    >
                      {ROUTE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Icon color</label>
                      <input
                        type="color"
                        className="h-9 w-14 cursor-pointer rounded border p-0.5 bg-card"
                        value={q.iconColor || '#0d9488'}
                        onChange={(e) =>
                          updateQuickLink(q.id, (x) => ({
                            ...x,
                            iconColor: e.target.value,
                          }))
                        }
                        title="Icon color"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Background color</label>
                      <input
                        type="color"
                        className="h-9 w-14 cursor-pointer rounded border p-0.5 bg-card"
                        value={q.iconBgColor ? q.iconBgColor.slice(0, 7) : '#0d9488'}
                        onChange={(e) =>
                          updateQuickLink(q.id, (x) => ({
                            ...x,
                            iconBgColor: `${e.target.value}18`,
                          }))
                        }
                        title="Background color (lighter tint)"
                      />
                    </div>
                    {(q.iconColor || q.iconBgColor) ? (
                      <button
                        type="button"
                        className="self-end text-xs text-gray-500 hover:text-gray-700"
                        onClick={() =>
                          updateQuickLink(q.id, (x) => ({
                            ...x,
                            iconColor: undefined,
                            iconBgColor: undefined,
                          }))
                        }
                      >
                        Reset
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="card rounded-lg p-6 space-y-6">
            <h3 className="text-sm font-semibold text-gray-900">Home Dashboard Widgets</h3>
            <p className="text-xs text-gray-500">
              Dealer card, tips, product strip. Order and configure.
            </p>
            {sortedWidgets().map((w, i) => (
              <div key={w.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-gray-800">
                    {w.id}{' '}
                    <span className="text-gray-400 font-normal">({w.type})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300"
                        checked={w.enabled}
                        onChange={() => updateWidget(w.id, (x) => ({ ...x, enabled: !x.enabled }))}
                      />
                      <span className="ml-1 text-gray-700">On</span>
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
          <HomeDashboardMockup
            quickLinks={sortedQuickLinks()}
            quickLinksLayout={homeDashboard.quickLinksLayout}
            widgets={sortedWidgets()}
            dealerPhone={dealerPhone}
            dealerAddress={dealerAddress}
            primaryColor={primaryColor}
          />
        </div>
      )}

      {tab === 'waterCare' && (
        <div className="card rounded-lg p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Water Testing Tips</h3>
            <p className="text-xs text-gray-500 mt-1">
              These tips appear in the customer Water Care tab beneath the chemistry ranges.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Card title</label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              value={waterCare.testingTipsTitle}
              onChange={(e) => {
                markDirty();
                setWaterCare((prev) => (prev ? { ...prev, testingTipsTitle: e.target.value } : prev));
              }}
              placeholder="Water Testing Tips"
            />
          </div>
          <div className="space-y-3">
            {waterCare.testingTips.map((tip, index) => (
              <div key={index} className="flex gap-2">
                <input
                  className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
                  value={tip.text}
                  onChange={(e) => {
                    markDirty();
                    setWaterCare((prev) =>
                      prev
                        ? {
                            ...prev,
                            testingTips: prev.testingTips.map((row, rowIndex) =>
                              rowIndex === index ? { text: e.target.value } : row
                            ),
                          }
                        : prev
                    );
                  }}
                  placeholder="Tip text"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    markDirty();
                    setWaterCare((prev) =>
                      prev
                        ? { ...prev, testingTips: prev.testingTips.filter((_, rowIndex) => rowIndex !== index) }
                        : prev
                    );
                  }}
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                markDirty();
                setWaterCare((prev) =>
                  prev ? { ...prev, testingTips: [...prev.testingTips, { text: '' }] } : prev
                );
              }}
            >
              + Add Tip
            </Button>
            <Button type="button" loading={saving} onClick={() => void saveWaterCare()}>
              Save water care
            </Button>
          </div>
        </div>
      )}

      {tab === 'legal' && (
        <div className="card space-y-6 rounded-lg p-6">
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
              onChange={(e) => {
                markDirty();
                setTermsUrl(e.target.value);
              }}
              placeholder="https://example.com/terms"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Privacy Policy URL</label>
            <input
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              type="url"
              value={privacyUrl}
              onChange={(e) => {
                markDirty();
                setPrivacyUrl(e.target.value);
              }}
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
