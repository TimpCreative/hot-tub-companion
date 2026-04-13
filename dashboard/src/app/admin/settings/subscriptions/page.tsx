'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';

type ConnectPayload = {
  stripeConfigured?: boolean;
  stripeConnectAccountId?: string | null;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  onboardedAt?: string | null;
  subscriptionApplicationFeeBps?: number | null;
  subscriptionShopifyFulfillmentEnabled?: boolean;
  subscriptionBundleDefaultDiscountPercent?: number;
  newProductsSubscriptionEligibleByDefault?: boolean;
};

function errMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'error' in e) {
    const er = (e as { error?: { message?: string } }).error;
    if (er?.message) return er.message;
  }
  return 'Request failed';
}

export default function SettingsSubscriptionsPage() {
  const router = useRouter();
  const { permissions, loading: permLoading } = useAdminPermissions();
  const { getIdToken } = useAuth();
  const api = useMemo(() => createTenantApiClient(async () => await getIdToken()), [getIdToken]);
  const [data, setData] = useState<ConnectPayload | null>(null);
  const [feeDraft, setFeeDraft] = useState('');
  const [bundleDiscountDraft, setBundleDiscountDraft] = useState('');
  const [fulfillDraft, setFulfillDraft] = useState(false);
  const [newProductsSubEligibleDraft, setNewProductsSubEligibleDraft] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = (await api.get('/admin/subscriptions/connect')) as {
        success?: boolean;
        data?: ConnectPayload;
      };
      if (res?.data) {
        setData(res.data);
        setFeeDraft(
          res.data.subscriptionApplicationFeeBps != null ? String(res.data.subscriptionApplicationFeeBps) : ''
        );
        setFulfillDraft(!!res.data.subscriptionShopifyFulfillmentEnabled);
        setBundleDiscountDraft(
          res.data.subscriptionBundleDefaultDiscountPercent != null
            ? String(res.data.subscriptionBundleDefaultDiscountPercent)
            : '0'
        );
        setNewProductsSubEligibleDraft(res.data.newProductsSubscriptionEligibleByDefault !== false);
      }
    } catch (e: unknown) {
      setErr(errMessage(e));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (permLoading) return;
    if (!permissions?.can_manage_subscriptions) {
      router.replace('/admin/settings');
      return;
    }
    void load();
  }, [load, permLoading, permissions?.can_manage_subscriptions, router]);

  async function openOnboarding() {
    setErr(null);
    try {
      const res = (await api.post('/admin/subscriptions/connect/onboarding-link', {})) as {
        data?: { url?: string };
      };
      if (res?.data?.url) window.location.href = res.data.url;
      else setErr('No onboarding URL returned');
    } catch (e: unknown) {
      setErr(errMessage(e));
    }
  }

  async function openDashboard() {
    setErr(null);
    try {
      const res = (await api.post('/admin/subscriptions/connect/dashboard-link', {})) as {
        data?: { url?: string };
      };
      if (res?.data?.url) window.open(res.data.url, '_blank', 'noopener,noreferrer');
      else setErr('No dashboard URL returned');
    } catch (e: unknown) {
      setErr(errMessage(e));
    }
  }

  async function saveSettings() {
    setMsg(null);
    setErr(null);
    const trimmed = feeDraft.trim();
    let bps: number | null = null;
    if (trimmed !== '') {
      const n = parseInt(trimmed, 10);
      if (!Number.isFinite(n) || n < 0 || n > 10000) {
        setErr('Application fee must be basis points from 0 to 10000 (100 = 1%). Leave blank for platform default.');
        return;
      }
      bps = n;
    }
    const bd = bundleDiscountDraft.trim();
    let bundleDiscountPct: number;
    if (bd === '') {
      bundleDiscountPct = 0;
    } else {
      const n = parseFloat(bd);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setErr('Default bundle discount must be between 0 and 100 percent.');
        return;
      }
      bundleDiscountPct = n;
    }
    try {
      const res = (await api.put('/admin/subscriptions/settings', {
        subscriptionApplicationFeeBps: bps,
        subscriptionShopifyFulfillmentEnabled: fulfillDraft,
        subscriptionBundleDefaultDiscountPercent: bundleDiscountPct,
        newProductsSubscriptionEligibleByDefault: newProductsSubEligibleDraft,
      })) as { data?: ConnectPayload };
      if (res?.data) {
        setData(res.data);
        if (res.data.subscriptionBundleDefaultDiscountPercent != null) {
          setBundleDiscountDraft(String(res.data.subscriptionBundleDefaultDiscountPercent));
        }
        setNewProductsSubEligibleDraft(res.data.newProductsSubscriptionEligibleByDefault !== false);
      }
      setMsg('Settings saved');
    } catch (e: unknown) {
      setErr(errMessage(e));
    }
  }

  if (permLoading) {
    return <p className="text-gray-600">Loading…</p>;
  }
  if (!permissions?.can_manage_subscriptions) {
    return null;
  }

  if (loading) {
    return <p className="text-gray-600">Loading…</p>;
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Subscriptions</h2>
        <p className="mt-1 text-sm text-gray-600">
          Stripe Connect, subscription fees, and catalog defaults for new products from Shopify sync.
        </p>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-green-700">{msg}</p> : null}

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Stripe</h3>
        {!data?.stripeConfigured ? (
          <p className="text-sm text-amber-800">
            Stripe is not configured on the API for this environment. Subscriptions are unavailable until platform keys
            are set.
          </p>
        ) : null}
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Account ID</dt>
            <dd className="font-mono text-xs mt-0.5 break-all">{data?.stripeConnectAccountId || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Charges</dt>
            <dd className="mt-0.5">{data?.chargesEnabled ? 'Enabled' : 'Not enabled'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Payouts</dt>
            <dd className="mt-0.5">{data?.payoutsEnabled ? 'Enabled' : 'Not enabled'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Details submitted</dt>
            <dd className="mt-0.5">{data?.detailsSubmitted ? 'Yes' : 'No'}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="button" variant="primary" onClick={() => void openOnboarding()} disabled={!data?.stripeConfigured}>
            {data?.stripeConnectAccountId ? 'Continue Stripe onboarding' : 'Start Stripe Connect'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void openDashboard()}
            disabled={!data?.stripeConfigured || !data?.stripeConnectAccountId}
          >
            Open Stripe Express dashboard
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <h3 className="text-lg font-medium text-gray-900">Subscription settings</h3>
        <div className="border-b border-gray-100 pb-4 mb-2 space-y-3">
          <p className="text-sm font-medium text-gray-800">Catalog defaults</p>
          <p className="text-sm text-gray-600">
            Applies when new variants are created from Shopify (sync or webhooks). Existing rows keep their eligibility;
            adjust individual products under{' '}
            <Link href="/admin/products" className="text-blue-600 hover:underline">
              All products
            </Link>
            .
          </p>
          <label className="flex items-start gap-3 text-sm text-gray-800 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-gray-300"
              checked={newProductsSubEligibleDraft}
              onChange={(e) => setNewProductsSubEligibleDraft(e.target.checked)}
            />
            <span>
              <span className="font-medium">New products are subscription-eligible by default</span>
              <span className="block text-xs text-gray-500 mt-1">
                Newly synced variants start eligible for subscriptions and bundles. Turn off here if you prefer to opt in
                per product.
              </span>
            </span>
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Application fee override (basis points)</label>
          <input
            className="mt-1 w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="e.g. 100 = 1.00% — leave blank for default"
            value={feeDraft}
            onChange={(e) => setFeeDraft(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">100 basis points = 1%. Max 10000 (100%).</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Default bundle discount (%)</label>
          <input
            className="mt-1 w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="0"
            value={bundleDiscountDraft}
            onChange={(e) => setBundleDiscountDraft(e.target.value)}
          />
          <p className="text-xs text-gray-500 mt-1">
            Suggested subscription price for new bundles uses catalog line totals minus this percent (per-bundle overrides
            on the Bundles page).
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-800">
          <input
            type="checkbox"
            checked={fulfillDraft}
            onChange={(e) => setFulfillDraft(e.target.checked)}
            className="rounded border-gray-300"
          />
          Create Shopify orders when subscription invoices are paid (HTC pilot / external payment)
        </label>
        <Button type="button" variant="secondary" onClick={() => void saveSettings()}>
          Save settings
        </Button>
      </div>
    </div>
  );
}
