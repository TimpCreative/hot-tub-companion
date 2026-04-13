'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';
import { useUnsavedChanges } from '@/contexts/UnsavedChangesContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';

interface PosSettingsResponse {
  success?: boolean;
  message?: string;
  error?: { message?: string };
  data?: {
    tenantId?: string;
    posType?: string | null;
    shopifyStoreUrl?: string | null;
    shopifyClientId?: string | null;
    lastProductSyncAt?: string | null;
    shopifyClientSecretConfigured?: boolean;
    shopifyAdminTokenConfigured?: boolean;
    shopifyWebhookSecretConfigured?: boolean;
    shopifyCatalogSyncEnabled?: boolean;
    productSyncIntervalMinutes?: number;
    lastCronProductSyncAt?: string | null;
    posIntegrationLastActivityAt?: string | null;
  };
}

interface PosActivityItem {
  id: string;
  eventType: string;
  summary: string;
  metadata: Record<string, unknown> | null;
  source: string;
  actorUserId: string | null;
  actorLabel: string | null;
  createdAt: string;
}

interface PosHealthPayload {
  lastProductSyncAt?: string | null;
  lastCronProductSyncAt?: string | null;
  posIntegrationLastActivityAt?: string | null;
  shopifyCatalogSyncEnabled?: boolean;
  lastLoggedFailure?: {
    eventType: string;
    summary: string;
    source: string;
    createdAt: string;
  } | null;
}

interface PosSnapshot {
  posType: string;
  shopifyStoreUrl: string;
  shopifyAdminTokenDraft: string;
  shopifyClientSecretDraft: string;
  shopifyCatalogSyncEnabled: boolean;
  productSyncIntervalMinutes: number;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object') {
    if ('error' in error) {
      const nested = (error as { error?: { message?: string } }).error?.message;
      if (nested) return nested;
    }
    if ('message' in error) {
      const message = (error as { message?: string }).message;
      if (message) return message;
    }
  }
  return fallback;
}

export default function AdminSettingsPosPage() {
  const router = useRouter();
  const { permissions, loading: permLoading } = useAdminPermissions();
  const { getIdToken } = useAuth();
  const { setUnsavedChanges } = useUnsavedChanges();
  const api = useMemo(() => createTenantApiClient(async () => await getIdToken()), [getIdToken]);

  const [posType, setPosType] = useState<string>('');
  const [shopifyStoreUrl, setShopifyStoreUrl] = useState<string>('');
  const [shopifyAdminTokenDraft, setShopifyAdminTokenDraft] = useState<string>('');
  const [shopifyClientSecretDraft, setShopifyClientSecretDraft] = useState<string>('');
  const [shopifyAdminTokenConfigured, setShopifyAdminTokenConfigured] = useState(false);
  const [shopifyClientSecretConfigured, setShopifyClientSecretConfigured] = useState(false);
  const [lastProductSyncAt, setLastProductSyncAt] = useState<string | null>(null);
  const [lastCronProductSyncAt, setLastCronProductSyncAt] = useState<string | null>(null);
  const [shopifyCatalogSyncEnabled, setShopifyCatalogSyncEnabled] = useState(false);
  const [productSyncIntervalMinutes, setProductSyncIntervalMinutes] = useState(30);
  const [syncImportOpen, setSyncImportOpen] = useState(false);
  const [syncImportRunning, setSyncImportRunning] = useState(false);
  const [syncImportError, setSyncImportError] = useState<string | null>(null);
  const [syncPageIndex, setSyncPageIndex] = useState(0);
  const [syncEstimatedPages, setSyncEstimatedPages] = useState(1);
  const [syncTotalProducts, setSyncTotalProducts] = useState<number | null>(null);
  const [syncStatusLine, setSyncStatusLine] = useState('');
  const [posIntegrationLastActivityAt, setPosIntegrationLastActivityAt] = useState<string | null>(null);
  const [activityModalOpen, setActivityModalOpen] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityRows, setActivityRows] = useState<PosActivityItem[]>([]);
  const [activityPage, setActivityPage] = useState(1);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPageSize] = useState(15);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [posHealth, setPosHealth] = useState<PosHealthPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [posSaving, setPosSaving] = useState(false);
  const [posTesting, setPosTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [posSuccess, setPosSuccess] = useState<string | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<PosSnapshot | null>(null);

  useEffect(() => {
    if (!initialSnapshot) return;
    const dirty =
      posType !== initialSnapshot.posType ||
      shopifyStoreUrl !== initialSnapshot.shopifyStoreUrl ||
      shopifyAdminTokenDraft !== initialSnapshot.shopifyAdminTokenDraft ||
      shopifyClientSecretDraft !== initialSnapshot.shopifyClientSecretDraft ||
      shopifyCatalogSyncEnabled !== initialSnapshot.shopifyCatalogSyncEnabled ||
      productSyncIntervalMinutes !== initialSnapshot.productSyncIntervalMinutes;
    setUnsavedChanges(dirty);
  }, [
    initialSnapshot,
    posType,
    shopifyStoreUrl,
    shopifyAdminTokenDraft,
    shopifyClientSecretDraft,
    shopifyCatalogSyncEnabled,
    productSyncIntervalMinutes,
    setUnsavedChanges,
  ]);

  useEffect(() => {
    if (permLoading) return;
    if (!permissions?.can_manage_settings) {
      router.replace('/admin/settings');
    }
  }, [permLoading, permissions?.can_manage_settings, router]);

  useEffect(() => {
    if (permLoading) return;
    if (!permissions?.can_manage_settings) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [posRes, healthRes] = await Promise.all([
          api.get('/admin/settings/pos') as Promise<PosSettingsResponse>,
          api.get('/admin/settings/pos/health').catch(() => null) as Promise<
            { success?: boolean; data?: PosHealthPayload } | null
          >,
        ]);
        if (cancelled) return;
        const pos = posRes?.data;
        setPosType(pos?.posType ?? '');
        setShopifyStoreUrl(pos?.shopifyStoreUrl ?? '');
        setShopifyAdminTokenDraft('');
        setShopifyClientSecretDraft('');
        setShopifyAdminTokenConfigured(!!(pos?.shopifyClientId || pos?.shopifyAdminTokenConfigured));
        setShopifyClientSecretConfigured(!!pos?.shopifyClientSecretConfigured);
        setLastProductSyncAt(pos?.lastProductSyncAt ?? null);
        setLastCronProductSyncAt(pos?.lastCronProductSyncAt ?? null);
        setPosIntegrationLastActivityAt(pos?.posIntegrationLastActivityAt ?? null);
        if (healthRes?.success && healthRes.data) {
          setPosHealth(healthRes.data);
        } else {
          setPosHealth(null);
        }
        setShopifyCatalogSyncEnabled(!!pos?.shopifyCatalogSyncEnabled);
        setProductSyncIntervalMinutes(
          typeof pos?.productSyncIntervalMinutes === 'number' ? pos.productSyncIntervalMinutes : 30
        );
        setInitialSnapshot({
          posType: pos?.posType ?? '',
          shopifyStoreUrl: pos?.shopifyStoreUrl ?? '',
          shopifyAdminTokenDraft: '',
          shopifyClientSecretDraft: '',
          shopifyCatalogSyncEnabled: !!pos?.shopifyCatalogSyncEnabled,
          productSyncIntervalMinutes:
            typeof pos?.productSyncIntervalMinutes === 'number' ? pos.productSyncIntervalMinutes : 30,
        });
      } catch (e: unknown) {
        if (!cancelled) setError(getErrorMessage(e, 'Failed to load POS settings'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [api, permLoading, permissions?.can_manage_settings]);

  async function handleSavePos() {
    setPosSaving(true);
    setError(null);
    setPosSuccess(null);
    try {
      const payload: Record<string, unknown> = {
        posType: posType || null,
        shopifyStoreUrl: shopifyStoreUrl.trim() || null,
      };
      if (shopifyAdminTokenDraft.trim()) payload.shopifyClientId = shopifyAdminTokenDraft.trim();
      if (shopifyClientSecretDraft.trim()) payload.shopifyClientSecret = shopifyClientSecretDraft.trim();
      if (posType === 'shopify') {
        payload.shopifyCatalogSyncEnabled = shopifyCatalogSyncEnabled;
        payload.productSyncIntervalMinutes = productSyncIntervalMinutes;
      }

      const res = (await api.put('/admin/settings/pos', payload)) as PosSettingsResponse;
      if (res?.success) {
        setPosSuccess(res.message ?? 'POS configuration saved');
        setShopifyAdminTokenDraft('');
        setShopifyClientSecretDraft('');
        setShopifyAdminTokenConfigured(
          !!(res.data?.shopifyClientId || res.data?.shopifyAdminTokenConfigured)
        );
        setShopifyClientSecretConfigured(!!res.data?.shopifyClientSecretConfigured);
        setLastProductSyncAt(res.data?.lastProductSyncAt ?? null);
        setLastCronProductSyncAt(res.data?.lastCronProductSyncAt ?? null);
        setPosIntegrationLastActivityAt(res.data?.posIntegrationLastActivityAt ?? null);
        if (typeof res.data?.productSyncIntervalMinutes === 'number') {
          setProductSyncIntervalMinutes(res.data.productSyncIntervalMinutes);
        }
        setShopifyCatalogSyncEnabled(!!res.data?.shopifyCatalogSyncEnabled);
        setInitialSnapshot((prev) =>
          prev
            ? {
                ...prev,
                posType: res.data?.posType ?? posType,
                shopifyStoreUrl: res.data?.shopifyStoreUrl ?? shopifyStoreUrl,
                shopifyAdminTokenDraft: '',
                shopifyClientSecretDraft: '',
                shopifyCatalogSyncEnabled: !!res.data?.shopifyCatalogSyncEnabled,
                productSyncIntervalMinutes:
                  typeof res.data?.productSyncIntervalMinutes === 'number'
                    ? res.data.productSyncIntervalMinutes
                    : productSyncIntervalMinutes,
              }
            : prev
        );
        try {
          const h = (await api.get('/admin/settings/pos/health')) as {
            success?: boolean;
            data?: PosHealthPayload;
          };
          if (h?.success && h.data) setPosHealth(h.data);
        } catch {
          /* optional snapshot */
        }
      } else {
        setError(res?.error?.message ?? 'Failed to save POS configuration');
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to save POS configuration'));
    } finally {
      setPosSaving(false);
    }
  }

  async function runFullCatalogSync() {
    setSyncImportError(null);
    setError(null);
    setSyncImportOpen(true);
    setSyncImportRunning(true);
    setSyncPageIndex(0);
    setSyncEstimatedPages(1);
    setSyncTotalProducts(null);
    setSyncStatusLine('Getting catalog size from Shopify…');

    let failed = false;

    try {
      let estimatedPages = 1;
      let totalProducts: number | null = null;

      try {
        const estRes = (await api.get('/admin/settings/pos/sync/estimate')) as {
          success?: boolean;
          data?: { totalProducts?: number; estimatedPages?: number; pageSize?: number };
          error?: { message?: string };
        };
        if (estRes?.success && estRes.data) {
          estimatedPages = Math.max(1, Number(estRes.data.estimatedPages) || 1);
          totalProducts =
            typeof estRes.data.totalProducts === 'number' ? estRes.data.totalProducts : null;
          setSyncEstimatedPages(estimatedPages);
          setSyncTotalProducts(totalProducts);
        }
      } catch {
        setSyncEstimatedPages(1);
        setSyncTotalProducts(null);
      }

      let pageInfo: string | null = null;
      let page = 0;

      while (true) {
        page += 1;
        setSyncPageIndex(page);
        setSyncStatusLine(
          totalProducts != null
            ? `Importing from Shopify… page ${page} of ~${estimatedPages} (${totalProducts.toLocaleString()} products in store). Each page is up to 250 products; rows are per variant.`
            : `Importing from Shopify… page ${page} (up to 250 products per page; rows are per variant).`
        );

        const batchRes = (await api.post(
          '/admin/settings/pos/sync/batch',
          { pageInfo, mode: 'full' },
          { timeout: 180000 }
        )) as {
          success?: boolean;
          data?: {
            created?: number;
            updated?: number;
            errors?: { id?: string; message: string }[];
            nextPageInfo?: string | null;
          };
          error?: { message?: string };
        };

        if (!batchRes?.success) {
          throw new Error(batchRes?.error?.message || 'Sync batch failed');
        }

        const d = batchRes.data;
        pageInfo = d?.nextPageInfo ?? null;
        if (!pageInfo) break;
      }

      setSyncEstimatedPages(page);
      setSyncPageIndex(page);

      const posRes = (await api.get('/admin/settings/pos')) as PosSettingsResponse;
      if (posRes?.data?.lastProductSyncAt) {
        setLastProductSyncAt(posRes.data.lastProductSyncAt);
      }
      if (posRes?.data?.lastCronProductSyncAt !== undefined) {
        setLastCronProductSyncAt(posRes.data.lastCronProductSyncAt ?? null);
      }
      if (posRes?.data?.posIntegrationLastActivityAt !== undefined) {
        setPosIntegrationLastActivityAt(posRes.data.posIntegrationLastActivityAt ?? null);
      }
      try {
        const h = (await api.get('/admin/settings/pos/health')) as {
          success?: boolean;
          data?: PosHealthPayload;
        };
        if (h?.success && h.data) setPosHealth(h.data);
      } catch {
        /* ignore */
      }
    } catch (err: unknown) {
      failed = true;
      const msg =
        err &&
        typeof err === 'object' &&
        'error' in err &&
        (err as { error?: { message?: string } }).error?.message
          ? (err as { error?: { message?: string } }).error?.message
          : err instanceof Error
            ? err.message
            : 'Full catalog sync failed';
      setSyncImportError(msg || 'Full catalog sync failed');
    } finally {
      setSyncImportRunning(false);
    }

    if (!failed) {
      setSyncImportOpen(false);
      setSyncStatusLine('');
    }
  }

  async function loadPosActivityPage(page: number) {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const res = (await api.get(
        `/admin/settings/pos/activity?page=${page}&pageSize=${activityPageSize}`
      )) as {
        success?: boolean;
        data?: PosActivityItem[];
        pagination?: { total?: number; page?: number };
        error?: { message?: string };
      };
      if (!res?.success) {
        setActivityError(res?.error?.message ?? 'Failed to load activity');
        setActivityRows([]);
        setActivityTotal(0);
        return;
      }
      setActivityRows(Array.isArray(res.data) ? res.data : []);
      setActivityTotal(res.pagination?.total ?? 0);
      setActivityPage(res.pagination?.page ?? page);
    } catch (e: unknown) {
      setActivityError(getErrorMessage(e, 'Failed to load activity'));
      setActivityRows([]);
      setActivityTotal(0);
    } finally {
      setActivityLoading(false);
    }
  }

  async function handleTestPos() {
    setPosTesting(true);
    setError(null);
    setPosSuccess(null);
    try {
      const res = (await api.post('/admin/settings/pos/test', {})) as PosSettingsResponse & {
        data?: { ok?: boolean; message?: string };
      };
      if (res?.data?.ok) {
        setPosSuccess(res.data.message ?? 'Connection successful');
      } else {
        setError(res?.data?.message ?? res?.error?.message ?? 'Connection test failed');
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Connection test failed'));
    } finally {
      setPosTesting(false);
    }
  }

  if (permLoading) {
    return <p className="text-gray-600">Loading…</p>;
  }
  if (!permissions?.can_manage_settings) {
    return null;
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading…</div>;
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">POS integration</h2>
        <p className="text-gray-600 text-sm">
          Link Shopify for product sync. Saved secrets are not shown again—paste new values only to add or rotate them.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>}
      {posSuccess && <div className="rounded-lg bg-green-50 p-4 text-green-800">{posSuccess}</div>}

      <div className="card space-y-5 rounded-lg p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Provider</label>
          <select
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            value={posType}
            onChange={(e) => setPosType(e.target.value)}
            disabled={posSaving || posTesting}
          >
            <option value="">Not configured</option>
            <option value="shopify">Shopify</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Store admin URL</label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2"
            value={shopifyStoreUrl}
            onChange={(e) => setShopifyStoreUrl(e.target.value)}
            disabled={posSaving || posTesting || posType !== 'shopify'}
            placeholder="your-store.myshopify.com"
          />
          <p className="mt-1 text-xs text-gray-500">
            Use the <span className="font-medium">.myshopify.com</span> hostname from Shopify admin (not your public shop
            domain).
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
            type="text"
            value={shopifyAdminTokenDraft}
            onChange={(e) => setShopifyAdminTokenDraft(e.target.value)}
            disabled={posSaving || posTesting || posType !== 'shopify'}
            placeholder="From your Shopify custom app"
            autoComplete="off"
          />
          <p className="mt-1 text-xs text-gray-500">
            {shopifyAdminTokenConfigured ? (
              <span className="text-green-800">On file.</span>
            ) : (
              <span>Required for new setup.</span>
            )}{' '}
            Leave blank to keep the saved ID.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Client secret</label>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
            type="password"
            value={shopifyClientSecretDraft}
            onChange={(e) => setShopifyClientSecretDraft(e.target.value)}
            disabled={posSaving || posTesting || posType !== 'shopify'}
            placeholder="Paste only when adding or rotating"
            autoComplete="new-password"
          />
          <p className="mt-1 text-xs text-gray-500">
            {shopifyClientSecretConfigured ? (
              <span className="text-green-800">On file.</span>
            ) : (
              <span>Required for new setup.</span>
            )}{' '}
            OAuth / Admin API. Never displayed after save.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
          <label className="flex items-start gap-2 text-sm font-medium text-gray-900 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-gray-300"
              checked={shopifyCatalogSyncEnabled}
              onChange={(e) => setShopifyCatalogSyncEnabled(e.target.checked)}
              disabled={posSaving || posTesting || posType !== 'shopify'}
            />
            <span>
              Keep catalog in sync automatically
              <span className="block text-xs font-normal text-gray-600 mt-0.5">
                Webhooks push changes; background job reconciles on the interval below.
              </span>
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sync interval (minutes)</label>
            <input
              type="number"
              min={1}
              max={1440}
              className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={productSyncIntervalMinutes}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                if (!Number.isNaN(n)) setProductSyncIntervalMinutes(Math.min(1440, Math.max(1, n)));
              }}
              disabled={posSaving || posTesting || posType !== 'shopify'}
            />
            <p className="mt-1 text-xs text-gray-500">Default 30. Your server cron should run often enough to honor this.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last product sync</div>
              <div className="text-gray-800">{lastProductSyncAt ? new Date(lastProductSyncAt).toLocaleString() : 'Never'}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Last cron run</div>
              <div className="text-gray-800">
                {lastCronProductSyncAt ? new Date(lastCronProductSyncAt).toLocaleString() : '—'}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Activity log</div>
            <button
              type="button"
              className="text-sm text-blue-600 hover:text-blue-800 underline underline-offset-2 text-left disabled:opacity-50 disabled:no-underline"
              disabled={posType !== 'shopify'}
              onClick={() => {
                setActivityModalOpen(true);
                void loadPosActivityPage(1);
              }}
            >
              {posIntegrationLastActivityAt
                ? new Date(posIntegrationLastActivityAt).toLocaleString()
                : 'Open log'}
            </button>
            {posHealth?.lastLoggedFailure ? (
              <p className="text-xs text-amber-900 mt-2 rounded-md bg-amber-50 px-2 py-2 border border-amber-200">
                <span className="font-semibold">Recent issue</span>{' '}
                {new Date(posHealth.lastLoggedFailure.createdAt).toLocaleString()}: {posHealth.lastLoggedFailure.summary}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Full catalog import</label>
          <p className="text-xs text-gray-500 mb-2">One-time pull of all products—use for first setup or a full refresh.</p>
          <Button
            type="button"
            variant="secondary"
            loading={syncImportRunning}
            disabled={syncImportRunning || posType !== 'shopify' || posSaving || posTesting}
            onClick={() => void runFullCatalogSync()}
          >
            Run full catalog sync
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="button" loading={posSaving} onClick={() => void handleSavePos()}>
            Save POS settings
          </Button>
          <Button type="button" variant="secondary" loading={posTesting} onClick={() => void handleTestPos()}>
            Test connection
          </Button>
        </div>
      </div>

      <Modal
        isOpen={syncImportOpen}
        onClose={() => {
          if (syncImportRunning) return;
          setSyncImportOpen(false);
          setSyncImportError(null);
          setSyncStatusLine('');
        }}
        preventDismiss={syncImportRunning}
        title={syncImportRunning ? 'Importing catalog' : 'Catalog import'}
        size="md"
      >
        <div className="space-y-4">
          {syncImportError ? <p className="text-sm text-red-700">{syncImportError}</p> : null}
          <p className="text-sm text-gray-600">{syncStatusLine}</p>
          <div>
            <div className="h-3 w-full rounded-full bg-gray-200 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] duration-300 ease-out"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((syncPageIndex / Math.max(syncEstimatedPages, syncPageIndex, 1)) * 100)
                  )}%`,
                }}
              />
            </div>
            <div className="mt-2 text-xs text-gray-500">
              {syncImportRunning
                ? `Page ${syncPageIndex} · ~${syncEstimatedPages} expected from Shopify product count${
                    syncTotalProducts != null ? ` (${syncTotalProducts.toLocaleString()} products)` : ''
                  }`
                : null}
            </div>
          </div>
          {!syncImportRunning && syncImportError ? (
            <Button variant="primary" onClick={() => setSyncImportOpen(false)}>
              Close
            </Button>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={activityModalOpen}
        onClose={() => {
          setActivityModalOpen(false);
          setActivityError(null);
        }}
        title="POS integration activity"
        size="xl"
      >
        <div className="space-y-3">
          {activityError ? <p className="text-sm text-red-600">{activityError}</p> : null}
          {activityLoading ? (
            <p className="text-sm text-gray-600">Loading…</p>
          ) : activityTotal === 0 ? (
            <p className="text-sm text-gray-600">
              No activity recorded yet. Save settings, run a sync, or wait for webhooks/cron.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 max-h-[min(420px,60vh)] overflow-y-auto text-sm">
              {activityRows.map((row) => (
                <li key={row.id} className="py-3 first:pt-0">
                  <div className="font-medium text-gray-900">{row.summary}</div>
                  <div className="text-xs text-gray-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>{new Date(row.createdAt).toLocaleString()}</span>
                    <span className="capitalize">{row.source.replace(/_/g, ' ')}</span>
                    {row.eventType ? <span className="font-mono">{row.eventType}</span> : null}
                    {row.actorLabel ? <span>by {row.actorLabel}</span> : null}
                  </div>
                  {row.metadata && Object.keys(row.metadata).length > 0 ? (
                    <pre className="mt-2 text-xs bg-gray-50 rounded p-2 overflow-x-auto text-gray-700 max-h-24">
                      {JSON.stringify(row.metadata, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          {!activityLoading && activityTotal > 0 ? (
            <Pagination
              page={activityPage}
              pageSize={activityPageSize}
              total={activityTotal}
              onPageChange={(p) => void loadPosActivityPage(p)}
            />
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
