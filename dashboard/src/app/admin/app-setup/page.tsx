'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useUnsavedChanges } from '@/contexts/UnsavedChangesContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { HomeDashboardMockup } from '@/components/HomeDashboardMockup';
import { MobilePreviewShell } from '@/components/MobilePreviewShell';

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

type WidgetType = 'dealer_card' | 'tips_list' | 'product_strip' | 'maintenance_summary';

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
  email: string | null;
  hours: string | null;
}

type DealerActionType = 'call' | 'directions' | 'message' | 'book_service' | 'chat' | 'external_url';

interface DealerActionButton {
  id: string;
  enabled: boolean;
  label: string;
  iconKey: string;
  actionType: DealerActionType;
  actionValue?: string | null;
  order: number;
}

interface DealerServiceItem {
  id: string;
  enabled: boolean;
  title: string;
  body: string;
  iconKey: string;
  order: number;
}

interface DealerLatestItem {
  id: string;
  enabled: boolean;
  title: string;
  body: string;
  accentColor?: string;
  order: number;
}

interface DealerPageConfig {
  version: number;
  layout: {
    actionButtonsLayout: 'grid_2x2' | 'single';
  };
  dealerInfo: {
    showName: boolean;
    showAddress: boolean;
    showPhone: boolean;
    showEmail: boolean;
    showHours: boolean;
  };
  actionButtons: DealerActionButton[];
  servicesBlock: {
    enabled: boolean;
    title: string;
    subtitle?: string;
    items: DealerServiceItem[];
  };
  assistanceBlock: {
    enabled: boolean;
    title: string;
    body: string;
    buttonLabel: string;
    actionType: 'chat' | 'call' | 'external_url';
    actionValue?: string | null;
  };
  latestBlock: {
    enabled: boolean;
    title: string;
    subtitle?: string;
    items: DealerLatestItem[];
  };
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
const DEALER_BUTTON_ICON_OPTIONS = [
  'call-outline',
  'navigate-outline',
  'chatbubble-outline',
  'calendar-outline',
  'mail-outline',
  'chatbubbles-outline',
  'open-outline',
] as const;
const DEALER_SERVICE_ICON_OPTIONS = [
  'water-outline',
  'build-outline',
  'construct-outline',
  'chatbubble-ellipses-outline',
  'cart-outline',
  'sparkles-outline',
] as const;
const DEALER_ACTION_TYPES: DealerActionType[] = ['call', 'directions', 'message', 'book_service', 'chat', 'external_url'];

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

  const [tab, setTab] = useState<'onboarding' | 'home' | 'dealer' | 'waterCare' | 'legal'>('onboarding');
  const [onboarding, setOnboarding] = useState<OnboardingConfig | null>(null);
  const [homeDashboard, setHomeDashboard] = useState<HomeDashboardConfig | null>(null);
  const [dealerPage, setDealerPage] = useState<DealerPageConfig | null>(null);
  const [dealerContact, setDealerContact] = useState<DealerContact | null>(null);
  const [waterCare, setWaterCare] = useState<WaterCareConfig | null>(null);
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
          dealerPage?: DealerPageConfig;
          dealerContact?: DealerContact;
          waterCare?: WaterCareConfig;
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
      if (body?.data?.dealerPage) setDealerPage(body.data.dealerPage);
      if (body?.data?.dealerContact) setDealerContact(body.data.dealerContact);
      if (body?.data?.waterCare) setWaterCare(body.data.waterCare);
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

  function sortedDealerButtons(): DealerActionButton[] {
    if (!dealerPage) return [];
    return [...dealerPage.actionButtons].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  function updateDealerButton(id: string, fn: (button: DealerActionButton) => DealerActionButton) {
    markDirty();
    setDealerPage((prev) =>
      prev
        ? { ...prev, actionButtons: prev.actionButtons.map((button) => (button.id === id ? fn(button) : button)) }
        : prev
    );
  }

  function moveDealerButton(id: string, dir: -1 | 1) {
    markDirty();
    const list = sortedDealerButtons();
    const idx = list.findIndex((button) => button.id === id);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= list.length) return;
    const current = list[idx];
    const swap = list[nextIdx];
    updateDealerButton(current.id, (button) => ({ ...button, order: swap.order }));
    updateDealerButton(swap.id, (button) => ({ ...button, order: current.order }));
  }

  function sortedDealerServices(): DealerServiceItem[] {
    if (!dealerPage) return [];
    return [...dealerPage.servicesBlock.items].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  function updateDealerService(id: string, fn: (item: DealerServiceItem) => DealerServiceItem) {
    markDirty();
    setDealerPage((prev) =>
      prev
        ? {
            ...prev,
            servicesBlock: {
              ...prev.servicesBlock,
              items: prev.servicesBlock.items.map((item) => (item.id === id ? fn(item) : item)),
            },
          }
        : prev
    );
  }

  function moveDealerService(id: string, dir: -1 | 1) {
    markDirty();
    const list = sortedDealerServices();
    const idx = list.findIndex((item) => item.id === id);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= list.length) return;
    const current = list[idx];
    const swap = list[nextIdx];
    updateDealerService(current.id, (item) => ({ ...item, order: swap.order }));
    updateDealerService(swap.id, (item) => ({ ...item, order: current.order }));
  }

  function sortedDealerLatest(): DealerLatestItem[] {
    if (!dealerPage) return [];
    return [...dealerPage.latestBlock.items].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  function updateDealerLatest(id: string, fn: (item: DealerLatestItem) => DealerLatestItem) {
    markDirty();
    setDealerPage((prev) =>
      prev
        ? {
            ...prev,
            latestBlock: {
              ...prev.latestBlock,
              items: prev.latestBlock.items.map((item) => (item.id === id ? fn(item) : item)),
            },
          }
        : prev
    );
  }

  function moveDealerLatest(id: string, dir: -1 | 1) {
    markDirty();
    const list = sortedDealerLatest();
    const idx = list.findIndex((item) => item.id === id);
    const nextIdx = idx + dir;
    if (idx < 0 || nextIdx < 0 || nextIdx >= list.length) return;
    const current = list[idx];
    const swap = list[nextIdx];
    updateDealerLatest(current.id, (item) => ({ ...item, order: swap.order }));
    updateDealerLatest(swap.id, (item) => ({ ...item, order: current.order }));
  }

  async function saveHome() {
    if (!homeDashboard) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body = (await api.put('/admin/settings/app-setup', {
        homeDashboard,
      })) as {
        success?: boolean;
        data?: { homeDashboard?: HomeDashboardConfig };
        message?: string;
      };
      if (body?.data?.homeDashboard) setHomeDashboard(body.data.homeDashboard);
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

  async function saveDealer() {
    if (!dealerPage) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body = (await api.put('/admin/settings/app-setup', { dealerPage })) as {
        success?: boolean;
        data?: { dealerPage?: DealerPageConfig };
        message?: string;
      };
      if (body?.data?.dealerPage) setDealerPage(body.data.dealerPage);
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

    if (!onboarding || !homeDashboard || !dealerPage || !waterCare) {
    return <div className="rounded-lg bg-red-50 p-4 text-red-700">{error || 'Could not load app setup.'}</div>;
  }

  return (
    <div className={tab === 'home' || tab === 'dealer' ? 'max-w-6xl' : 'max-w-3xl'}>
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">App setup</h2>
      <p className="text-gray-600 mb-4">Customer mobile app: onboarding flow, marketing surfaces, and Dealer tab content.</p>

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
          onClick={() => setTab('dealer')}
          className={`pb-3 px-1 text-sm font-medium border-b-2 ${
            tab === 'dealer' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500'
          }`}
        >
          Dealer
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

                {w.type === 'maintenance_summary' && (
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
                      <label className="text-xs text-gray-600">Max tasks shown (1–8)</label>
                      <input
                        type="number"
                        min={1}
                        max={8}
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        value={String(w.props.maxItems ?? 3)}
                        onChange={(e) => {
                          const n = parseInt(e.target.value, 10);
                          updateWidget(w.id, (x) => ({
                            ...x,
                            props: { ...x.props, maxItems: Number.isFinite(n) ? n : 3 },
                          }));
                        }}
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
            dealerPhone={dealerContact?.phone ?? ''}
            dealerAddress={dealerContact?.address ?? ''}
            primaryColor={primaryColor}
          />
        </div>
      )}

      {tab === 'dealer' && (
        <div className="flex gap-8">
          <div className="min-w-0 flex-1 space-y-6">
            <div className="card rounded-lg p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Dealer page layout</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Controls the main Dealer tab experience in the mobile app. Shared phone, address, email, and hours now live in Settings.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs font-medium text-gray-700">Action buttons layout:</span>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dealerButtonsLayout"
                    className="border-gray-300"
                    checked={dealerPage.layout.actionButtonsLayout === 'grid_2x2'}
                    onChange={() => {
                      markDirty();
                      setDealerPage((prev) =>
                        prev ? { ...prev, layout: { ...prev.layout, actionButtonsLayout: 'grid_2x2' } } : prev
                      );
                    }}
                  />
                  <span className="text-sm text-gray-700">2 x 2 grid</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="dealerButtonsLayout"
                    className="border-gray-300"
                    checked={dealerPage.layout.actionButtonsLayout === 'single'}
                    onChange={() => {
                      markDirty();
                      setDealerPage((prev) =>
                        prev ? { ...prev, layout: { ...prev.layout, actionButtonsLayout: 'single' } } : prev
                      );
                    }}
                  />
                  <span className="text-sm text-gray-700">Single column</span>
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    ['showName', 'Show dealer name'],
                    ['showAddress', 'Show address'],
                    ['showPhone', 'Show phone'],
                    ['showEmail', 'Show email'],
                    ['showHours', 'Show hours'],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={dealerPage.dealerInfo[key]}
                      onChange={() => {
                        markDirty();
                        setDealerPage((prev) =>
                          prev
                            ? {
                                ...prev,
                                dealerInfo: {
                                  ...prev.dealerInfo,
                                  [key]: !prev.dealerInfo[key],
                                },
                              }
                            : prev
                        );
                      }}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="card rounded-lg p-6 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Dealer action buttons</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Reorder, hide, or relabel the four primary actions shown in the top Dealer card.
                </p>
              </div>
              {sortedDealerButtons().map((button, index) => (
                <div key={button.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-gray-800">{button.label}</div>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={button.enabled}
                          onChange={() => updateDealerButton(button.id, (current) => ({ ...current, enabled: !current.enabled }))}
                        />
                        <span className="ml-1 text-gray-700">On</span>
                      </label>
                      <button
                        type="button"
                        className="text-xs text-blue-600 disabled:opacity-40"
                        disabled={index === 0}
                        onClick={() => moveDealerButton(button.id, -1)}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="text-xs text-blue-600 disabled:opacity-40"
                        disabled={index === sortedDealerButtons().length - 1}
                        onClick={() => moveDealerButton(button.id, 1)}
                      >
                        Down
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <label className="text-xs text-gray-600">Label</label>
                      <input
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        value={button.label}
                        onChange={(e) => updateDealerButton(button.id, (current) => ({ ...current, label: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Icon</label>
                      <select
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        value={button.iconKey}
                        onChange={(e) => updateDealerButton(button.id, (current) => ({ ...current, iconKey: e.target.value }))}
                      >
                        {DEALER_BUTTON_ICON_OPTIONS.map((icon) => (
                          <option key={icon} value={icon}>
                            {icon}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Action type</label>
                      <select
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        value={button.actionType}
                        onChange={(e) =>
                          updateDealerButton(button.id, (current) => ({
                            ...current,
                            actionType: e.target.value as DealerActionType,
                            actionValue: e.target.value === 'external_url' ? current.actionValue : null,
                          }))
                        }
                      >
                        {DEALER_ACTION_TYPES.map((actionType) => (
                          <option key={actionType} value={actionType}>
                            {actionType}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Custom URL / value</label>
                      <input
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        value={button.actionValue ?? ''}
                        onChange={(e) =>
                          updateDealerButton(button.id, (current) => ({ ...current, actionValue: e.target.value || null }))
                        }
                        placeholder={button.actionType === 'external_url' ? 'https://example.com' : 'Optional override'}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="card rounded-lg p-6 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Services We Offer block</h3>
                  <p className="text-xs text-gray-500 mt-1">Editable marketing cards for the Dealer tab.</p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={dealerPage.servicesBlock.enabled}
                    onChange={() => {
                      markDirty();
                      setDealerPage((prev) =>
                        prev ? { ...prev, servicesBlock: { ...prev.servicesBlock, enabled: !prev.servicesBlock.enabled } } : prev
                      );
                    }}
                  />
                  Enabled
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-gray-600">Title</label>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    value={dealerPage.servicesBlock.title}
                    onChange={(e) => {
                      markDirty();
                      setDealerPage((prev) =>
                        prev ? { ...prev, servicesBlock: { ...prev.servicesBlock, title: e.target.value } } : prev
                      );
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Subtitle</label>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    value={dealerPage.servicesBlock.subtitle ?? ''}
                    onChange={(e) => {
                      markDirty();
                      setDealerPage((prev) =>
                        prev
                          ? { ...prev, servicesBlock: { ...prev.servicesBlock, subtitle: e.target.value || undefined } }
                          : prev
                      );
                    }}
                  />
                </div>
              </div>
              {sortedDealerServices().map((item, index) => (
                <div key={item.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-gray-800">{item.title}</div>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={item.enabled}
                          onChange={() => updateDealerService(item.id, (current) => ({ ...current, enabled: !current.enabled }))}
                        />
                        <span className="ml-1 text-gray-700">On</span>
                      </label>
                      <button
                        type="button"
                        className="text-xs text-blue-600 disabled:opacity-40"
                        disabled={index === 0}
                        onClick={() => moveDealerService(item.id, -1)}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="text-xs text-blue-600 disabled:opacity-40"
                        disabled={index === sortedDealerServices().length - 1}
                        onClick={() => moveDealerService(item.id, 1)}
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
                        value={item.title}
                        onChange={(e) => updateDealerService(item.id, (current) => ({ ...current, title: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Icon</label>
                      <select
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                        value={item.iconKey}
                        onChange={(e) => updateDealerService(item.id, (current) => ({ ...current, iconKey: e.target.value }))}
                      >
                        {DEALER_SERVICE_ICON_OPTIONS.map((icon) => (
                          <option key={icon} value={icon}>
                            {icon}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Body</label>
                    <textarea
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      rows={2}
                      value={item.body}
                      onChange={(e) => updateDealerService(item.id, (current) => ({ ...current, body: e.target.value }))}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="card rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Need Assistance block</h3>
                  <p className="text-xs text-gray-500 mt-1">Use this for chat, phone support, or an external CTA.</p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={dealerPage.assistanceBlock.enabled}
                    onChange={() => {
                      markDirty();
                      setDealerPage((prev) =>
                        prev
                          ? { ...prev, assistanceBlock: { ...prev.assistanceBlock, enabled: !prev.assistanceBlock.enabled } }
                          : prev
                      );
                    }}
                  />
                  Enabled
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  value={dealerPage.assistanceBlock.title}
                  onChange={(e) => {
                    markDirty();
                    setDealerPage((prev) =>
                      prev ? { ...prev, assistanceBlock: { ...prev.assistanceBlock, title: e.target.value } } : prev
                    );
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Body</label>
                <textarea
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  rows={3}
                  value={dealerPage.assistanceBlock.body}
                  onChange={(e) => {
                    markDirty();
                    setDealerPage((prev) =>
                      prev ? { ...prev, assistanceBlock: { ...prev.assistanceBlock, body: e.target.value } } : prev
                    );
                  }}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-gray-600">Button label</label>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    value={dealerPage.assistanceBlock.buttonLabel}
                    onChange={(e) => {
                      markDirty();
                      setDealerPage((prev) =>
                        prev
                          ? { ...prev, assistanceBlock: { ...prev.assistanceBlock, buttonLabel: e.target.value } }
                          : prev
                      );
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Action type</label>
                  <select
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    value={dealerPage.assistanceBlock.actionType}
                    onChange={(e) => {
                      markDirty();
                      setDealerPage((prev) =>
                        prev
                          ? {
                              ...prev,
                              assistanceBlock: {
                                ...prev.assistanceBlock,
                                actionType: e.target.value as DealerPageConfig['assistanceBlock']['actionType'],
                                actionValue: e.target.value === 'external_url' ? prev.assistanceBlock.actionValue : null,
                              },
                            }
                          : prev
                      );
                    }}
                  >
                    <option value="chat">chat</option>
                    <option value="call">call</option>
                    <option value="external_url">external_url</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Action value / URL</label>
                <input
                  className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                  value={dealerPage.assistanceBlock.actionValue ?? ''}
                  onChange={(e) => {
                    markDirty();
                    setDealerPage((prev) =>
                      prev
                        ? { ...prev, assistanceBlock: { ...prev.assistanceBlock, actionValue: e.target.value || null } }
                        : prev
                    );
                  }}
                  placeholder={dealerPage.assistanceBlock.actionType === 'external_url' ? 'https://example.com' : 'Optional override'}
                />
              </div>
            </div>

            <div className="card rounded-lg p-6 space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Latest from dealer block</h3>
                  <p className="text-xs text-gray-500 mt-1">For now this behaves like an editable tips and specials list.</p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={dealerPage.latestBlock.enabled}
                    onChange={() => {
                      markDirty();
                      setDealerPage((prev) =>
                        prev ? { ...prev, latestBlock: { ...prev.latestBlock, enabled: !prev.latestBlock.enabled } } : prev
                      );
                    }}
                  />
                  Enabled
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-gray-600">Title</label>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    value={dealerPage.latestBlock.title}
                    onChange={(e) => {
                      markDirty();
                      setDealerPage((prev) =>
                        prev ? { ...prev, latestBlock: { ...prev.latestBlock, title: e.target.value } } : prev
                      );
                    }}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600">Subtitle</label>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                    value={dealerPage.latestBlock.subtitle ?? ''}
                    onChange={(e) => {
                      markDirty();
                      setDealerPage((prev) =>
                        prev ? { ...prev, latestBlock: { ...prev.latestBlock, subtitle: e.target.value || undefined } } : prev
                      );
                    }}
                  />
                </div>
              </div>
              {sortedDealerLatest().map((item, index) => (
                <div key={item.id} className="border border-gray-100 rounded-lg p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-gray-800">{item.title}</div>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={item.enabled}
                          onChange={() => updateDealerLatest(item.id, (current) => ({ ...current, enabled: !current.enabled }))}
                        />
                        <span className="ml-1 text-gray-700">On</span>
                      </label>
                      <button
                        type="button"
                        className="text-xs text-blue-600 disabled:opacity-40"
                        disabled={index === 0}
                        onClick={() => moveDealerLatest(item.id, -1)}
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        className="text-xs text-blue-600 disabled:opacity-40"
                        disabled={index === sortedDealerLatest().length - 1}
                        onClick={() => moveDealerLatest(item.id, 1)}
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
                        value={item.title}
                        onChange={(e) => updateDealerLatest(item.id, (current) => ({ ...current, title: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Accent color</label>
                      <input
                        type="color"
                        className="h-9 w-14 cursor-pointer rounded border p-0.5 bg-card"
                        value={(item.accentColor ?? '#0ea5e9').slice(0, 7)}
                        onChange={(e) => updateDealerLatest(item.id, (current) => ({ ...current, accentColor: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Body</label>
                    <textarea
                      className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      rows={2}
                      value={item.body}
                      onChange={(e) => updateDealerLatest(item.id, (current) => ({ ...current, body: e.target.value }))}
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button type="button" loading={saving} onClick={() => void saveDealer()}>
              Save dealer page
            </Button>
          </div>

          <MobilePreviewShell>
              <div className="bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-6 text-white">
                <div className="text-2xl font-semibold">{config?.name ?? 'Your retailer'}</div>
                <div className="mt-2 text-sm text-white/90">Your trusted hot tub care partner</div>
              </div>
              <div className="space-y-4 bg-gray-50 px-4 py-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <div className="text-lg font-semibold text-gray-900">{config?.name ?? 'Your retailer'}</div>
                  <div className="mt-3 space-y-2 text-sm text-gray-600">
                    {dealerPage.dealerInfo.showAddress ? <div>Address from Settings</div> : null}
                    {dealerPage.dealerInfo.showPhone ? <div>Phone from Settings</div> : null}
                    {dealerPage.dealerInfo.showEmail ? <div>Email from Settings</div> : null}
                    {dealerPage.dealerInfo.showHours ? <div>Hours from Settings</div> : null}
                  </div>
                  <div className={`mt-4 grid gap-2 ${dealerPage.layout.actionButtonsLayout === 'single' ? 'grid-cols-1' : 'grid-cols-2'}`}>
                    {sortedDealerButtons().filter((button) => button.enabled).map((button) => (
                      <div key={button.id} className="rounded-xl border border-cyan-500 px-3 py-2 text-center text-sm font-medium text-cyan-700">
                        {button.label}
                      </div>
                    ))}
                  </div>
                </div>
                {dealerPage.servicesBlock.enabled ? (
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-lg font-semibold text-gray-900">{dealerPage.servicesBlock.title}</div>
                    {dealerPage.servicesBlock.subtitle ? (
                      <div className="mt-1 text-sm text-gray-500">{dealerPage.servicesBlock.subtitle}</div>
                    ) : null}
                  </div>
                ) : null}
                {dealerPage.assistanceBlock.enabled ? (
                  <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-center">
                    <div className="text-lg font-semibold text-slate-800">{dealerPage.assistanceBlock.title}</div>
                    <div className="mt-2 text-sm text-slate-600">{dealerPage.assistanceBlock.body}</div>
                  </div>
                ) : null}
                {dealerPage.latestBlock.enabled ? (
                  <div className="rounded-2xl border border-gray-200 bg-white p-4">
                    <div className="text-lg font-semibold text-gray-900">{dealerPage.latestBlock.title}</div>
                    {dealerPage.latestBlock.subtitle ? (
                      <div className="mt-1 text-sm text-gray-500">{dealerPage.latestBlock.subtitle}</div>
                    ) : null}
                  </div>
                ) : null}
              </div>
          </MobilePreviewShell>
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
