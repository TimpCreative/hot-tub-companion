'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createSuperAdminApiClient } from '@/services/api';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { MediaInput } from '@/components/ui/MediaInput';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  apiKey?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  fontFamily?: string;
  logoUrl?: string | null;
  iconUrl?: string | null;
  createdAt: string;
  posType?: string | null;
  shopifyStoreUrl?: string | null;
  lastProductSyncAt?: string | null;
}

export default function TenantDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { getIdToken } = useAuth();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [posLoading, setPosLoading] = useState(false);
  const [posError, setPosError] = useState<string | null>(null);
  const [posSavedMessage, setPosSavedMessage] = useState<string | null>(null);
  const [posTypeDraft, setPosTypeDraft] = useState<string>('');
  const [shopifyStoreUrlDraft, setShopifyStoreUrlDraft] = useState<string>('');
  const [shopifyAdminTokenDraft, setShopifyAdminTokenDraft] = useState<string>('');
  const [shopifyStorefrontTokenDraft, setShopifyStorefrontTokenDraft] = useState<string>('');
  const [showShopifyAdminToken, setShowShopifyAdminToken] = useState(false);
  const [showShopifyStorefrontToken, setShowShopifyStorefrontToken] = useState(false);

  const [brandingLoading, setBrandingLoading] = useState(false);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [brandingSavedMessage, setBrandingSavedMessage] = useState<string | null>(null);
  const [primaryColorDraft, setPrimaryColorDraft] = useState<string>('#1B4D7A');
  const [secondaryColorDraft, setSecondaryColorDraft] = useState<string>('#E8A832');
  const [logoUrlDraft, setLogoUrlDraft] = useState<string>('');
  const [iconUrlDraft, setIconUrlDraft] = useState<string>('');

  useEffect(() => {
    async function load() {
      try {
        const token = await getIdToken();
        const api = createSuperAdminApiClient(async () => token);
        const res = await api.get('/tenants') as { data?: { tenants?: Tenant[] } };
        const found = res.data?.tenants?.find((t) => t.id === id);
        if (!found) {
          setError('Tenant not found');
          return;
        }

        // Fetch POS summary for this tenant
        try {
          const posRes = await api.get(`/tenants/${id}/pos`) as {
            data?: {
              tenantId: string;
              posType?: string | null;
              shopifyStoreUrl?: string | null;
              lastProductSyncAt?: string | null;
            };
          };
          const pos = posRes.data;
          setTenant({
            ...found,
            posType: pos?.posType ?? null,
            shopifyStoreUrl: pos?.shopifyStoreUrl ?? null,
            lastProductSyncAt: pos?.lastProductSyncAt ?? null,
          });
          setPosTypeDraft(pos?.posType ?? '');
          setShopifyStoreUrlDraft(pos?.shopifyStoreUrl ?? '');

          setPrimaryColorDraft(found.primaryColor || '#1B4D7A');
          setSecondaryColorDraft(found.secondaryColor || '#E8A832');
          setLogoUrlDraft(found.logoUrl || '');
          setIconUrlDraft(found.iconUrl || '');
        } catch {
          // POS config may not exist yet; ignore and keep basic tenant info
          setTenant(found);
          setPosTypeDraft(found.posType ?? '');
          setShopifyStoreUrlDraft(found.shopifyStoreUrl ?? '');

          setPrimaryColorDraft(found.primaryColor || '#1B4D7A');
          setSecondaryColorDraft(found.secondaryColor || '#E8A832');
          setLogoUrlDraft(found.logoUrl || '');
          setIconUrlDraft(found.iconUrl || '');
        }
      } catch (err: unknown) {
        const e = err && typeof err === 'object' ? (err as { error?: { message?: string }; message?: string }) : {};
        const msg = e.error?.message ?? e.message ?? 'Failed to load tenant';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, getIdToken]);

  async function handleSavePosConfig() {
    if (!tenant) return;
    setPosLoading(true);
    setPosError(null);
    setPosSavedMessage(null);
    try {
      const token = await getIdToken();
      const api = createSuperAdminApiClient(async () => token);

      const body: Record<string, unknown> = {
        posType: posTypeDraft || null,
        shopifyStoreUrl: shopifyStoreUrlDraft || null,
      };

      // Only send tokens if user explicitly entered something.
      if (shopifyAdminTokenDraft.trim().length > 0) body.shopifyAdminToken = shopifyAdminTokenDraft.trim();
      if (shopifyStorefrontTokenDraft.trim().length > 0) body.shopifyStorefrontToken = shopifyStorefrontTokenDraft.trim();

      const res = await api.put(`/tenants/${tenant.id}/pos`, body) as {
        data?: { tenantId?: string; posType?: string | null; shopifyStoreUrl?: string | null; message?: string };
      };

      setTenant((prev) =>
        prev
          ? {
              ...prev,
              posType: (res.data?.posType ?? posTypeDraft) || null,
              shopifyStoreUrl: (res.data?.shopifyStoreUrl ?? shopifyStoreUrlDraft) || null,
            }
          : prev
      );
      setPosSavedMessage(res.data?.message ?? 'POS configuration saved');

      // Clear token drafts after saving so we don't keep them in UI state longer than necessary.
      setShopifyAdminTokenDraft('');
      setShopifyStorefrontTokenDraft('');
      setShowShopifyAdminToken(false);
      setShowShopifyStorefrontToken(false);
    } catch (err: any) {
      setPosError(err?.message || 'Failed to save POS configuration');
    } finally {
      setPosLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div>
        <div className="mb-6">
          <Link
            href="/super-admin/tenants"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            ← Back to Tenants
          </Link>
        </div>
        <div className="rounded-lg bg-red-50 p-4 text-red-700">{error || 'Tenant not found'}</div>
      </div>
    );
  }

  async function handleTestConnection() {
    if (!tenant) return;
    setPosLoading(true);
    setPosError(null);
    try {
      const token = await getIdToken();
      const api = createSuperAdminApiClient(async () => token);
      const res = await api.post(`/tenants/${tenant.id}/pos/test`, {}) as {
        data?: { ok?: boolean; message?: string };
      };
      if (!res.data?.ok) {
        setPosError(res.data?.message || 'Connection test failed');
      } else {
        setPosError(null);
      }
    } catch (err: any) {
      setPosError(err?.message || 'Failed to test POS connection');
    } finally {
      setPosLoading(false);
    }
  }

  async function handleSyncCatalog() {
    if (!tenant) return;
    setPosLoading(true);
    setPosError(null);
    try {
      const token = await getIdToken();
      const api = createSuperAdminApiClient(async () => token);
      await api.post(`/tenants/${tenant.id}/pos/sync`, { full: true });
    } catch (err: any) {
      setPosError(err?.message || 'Failed to sync catalog');
    } finally {
      setPosLoading(false);
    }
  }

  async function handleSaveBranding() {
    if (!tenant) return;
    setBrandingLoading(true);
    setBrandingError(null);
    setBrandingSavedMessage(null);
    try {
      const token = await getIdToken();
      const api = createSuperAdminApiClient(async () => token);

      const res = await api.put(`/tenants/${tenant.id}/branding`, {
        primaryColor: primaryColorDraft,
        secondaryColor: secondaryColorDraft,
        logoUrl: logoUrlDraft.trim().length > 0 ? logoUrlDraft.trim() : null,
        iconUrl: iconUrlDraft.trim().length > 0 ? iconUrlDraft.trim() : null,
      }) as { data?: { branding?: { primaryColor?: string; secondaryColor?: string; logoUrl?: string | null; iconUrl?: string | null }; message?: string } };

      if (res?.data?.branding) {
        const b = res.data.branding;
        setTenant((prev) =>
          prev
            ? {
                ...prev,
                primaryColor: b.primaryColor ?? primaryColorDraft,
                secondaryColor: b.secondaryColor ?? secondaryColorDraft,
                logoUrl: b.logoUrl ?? (logoUrlDraft.trim().length > 0 ? logoUrlDraft.trim() : null),
                iconUrl: b.iconUrl ?? (iconUrlDraft.trim().length > 0 ? iconUrlDraft.trim() : null),
              }
            : prev
        );
      }

      setBrandingSavedMessage(res.data?.message ?? 'Branding saved');
    } catch (err: any) {
      setBrandingError(err?.message || 'Failed to save branding');
    } finally {
      setBrandingLoading(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/super-admin/tenants"
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          ← Back to Tenants
        </Link>
      </div>

      <h2 className="text-2xl font-semibold text-gray-900 mb-6">{tenant.name}</h2>

      <div className="bg-white shadow rounded-lg overflow-hidden max-w-2xl mb-8">
        <dl className="divide-y divide-gray-200">
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">ID</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2 font-mono">{tenant.id}</dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Slug</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">{tenant.slug}</dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1 sm:mt-0 sm:col-span-2">
              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                {tenant.status}
              </span>
            </dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">API Key</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              {tenant.apiKey ? (
                <div className="flex items-center gap-2">
                  <span className="font-mono break-all">
                    {showApiKey ? tenant.apiKey : '••••••••••••••••••••••••'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                  >
                    {showApiKey ? 'Hide' : 'Reveal'}
                  </button>
                </div>
              ) : (
                '—'
              )}
            </dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Primary Color</dt>
            <dd className="mt-1 sm:mt-0 sm:col-span-2 flex items-center gap-2">
              {tenant.primaryColor && (
                <span
                  className="inline-block w-6 h-6 rounded border"
                  style={{ backgroundColor: tenant.primaryColor }}
                />
              )}
              {tenant.primaryColor || '—'}
            </dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Secondary Color</dt>
            <dd className="mt-1 sm:mt-0 sm:col-span-2 flex items-center gap-2">
              {tenant.secondaryColor && (
                <span
                  className="inline-block w-6 h-6 rounded border"
                  style={{ backgroundColor: tenant.secondaryColor }}
                />
              )}
              {tenant.secondaryColor || '—'}
            </dd>
          </div>
          <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Created</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              {tenant.createdAt ? format(new Date(tenant.createdAt), 'MMM d, yyyy HH:mm') : '—'}
            </dd>
          </div>
        </dl>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden max-w-2xl mb-8">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Branding</h3>
          <p className="mt-1 text-sm text-gray-500">
            Logo and colors used by the customer mobile app.
          </p>
        </div>
        <div className="px-6 py-4 space-y-5">
          {brandingError && <div className="text-sm text-red-700">{brandingError}</div>}
          {brandingSavedMessage && <div className="text-sm text-green-700">{brandingSavedMessage}</div>}

          <div className="sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Primary Color</dt>
            <dd className="mt-1 sm:mt-0 sm:col-span-2">
              <input
                type="color"
                value={primaryColorDraft}
                onChange={(e) => setPrimaryColorDraft(e.target.value)}
                className="h-10 w-24 rounded border border-gray-200"
              />
            </dd>
          </div>

          <div className="sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Secondary Color</dt>
            <dd className="mt-1 sm:mt-0 sm:col-span-2">
              <input
                type="color"
                value={secondaryColorDraft}
                onChange={(e) => setSecondaryColorDraft(e.target.value)}
                className="h-10 w-24 rounded border border-gray-200"
              />
            </dd>
          </div>

          <div className="sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Logo (Full)</dt>
            <dd className="mt-1 sm:mt-0 sm:col-span-2">
              <MediaInput
                label="Upload full logo"
                value={logoUrlDraft}
                onChange={setLogoUrlDraft}
                accept="image/*"
                entityType="tenant"
                entityId={tenant?.id}
                fieldName="logo_url"
                placeholder="Upload an image"
              />
              <p className="text-xs text-gray-500 mt-2">
                Images only. Min 1KB, max 10MB.
              </p>
            </dd>
          </div>

          <div className="sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Logomark (Icon)</dt>
            <dd className="mt-1 sm:mt-0 sm:col-span-2">
              <MediaInput
                label="Upload logomark"
                value={iconUrlDraft}
                onChange={setIconUrlDraft}
                accept="image/*"
                entityType="tenant"
                entityId={tenant?.id}
                fieldName="icon_url"
                placeholder="Upload an image"
              />
              <p className="text-xs text-gray-500 mt-2">
                Images only. Min 1KB, max 10MB.
              </p>
            </dd>
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="secondary" disabled={brandingLoading} onClick={handleSaveBranding}>
              {brandingLoading ? 'Saving…' : 'Save Branding'}
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden max-w-2xl">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">POS Integration</h3>
          <p className="mt-1 text-sm text-gray-500">
            Configure how this tenant connects its product catalog to Hot Tub Companion.
          </p>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Provider</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={posTypeDraft}
                onChange={(e) => setPosTypeDraft(e.target.value)}
                disabled={posLoading}
              >
                <option value="">Not configured</option>
                <option value="shopify">Shopify</option>
              </select>
            </dd>
          </div>
          <div className="sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Shopify Store URL</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              <input
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={shopifyStoreUrlDraft}
                onChange={(e) => setShopifyStoreUrlDraft(e.target.value)}
                disabled={posLoading || posTypeDraft !== 'shopify'}
                placeholder="https://your-store.myshopify.com"
              />
            </dd>
          </div>
          <div className="sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Shopify Admin Token</dt>
            <dd className="mt-1 sm:mt-0 sm:col-span-2">
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                  type={showShopifyAdminToken ? 'text' : 'password'}
                  value={shopifyAdminTokenDraft}
                  onChange={(e) => setShopifyAdminTokenDraft(e.target.value)}
                  disabled={posLoading || posTypeDraft !== 'shopify'}
                  placeholder="Enter to update (leave blank to keep existing)"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowShopifyAdminToken((v) => !v)}
                  className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                  disabled={posLoading || posTypeDraft !== 'shopify'}
                >
                  {showShopifyAdminToken ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Stored securely on the server. This field is intentionally blank unless you update it.
              </div>
            </dd>
          </div>
          <div className="sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Shopify Storefront Token</dt>
            <dd className="mt-1 sm:mt-0 sm:col-span-2">
              <div className="flex items-center gap-2">
                <input
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                  type={showShopifyStorefrontToken ? 'text' : 'password'}
                  value={shopifyStorefrontTokenDraft}
                  onChange={(e) => setShopifyStorefrontTokenDraft(e.target.value)}
                  disabled={posLoading || posTypeDraft !== 'shopify'}
                  placeholder="Enter to update (leave blank to keep existing)"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowShopifyStorefrontToken((v) => !v)}
                  className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                  disabled={posLoading || posTypeDraft !== 'shopify'}
                >
                  {showShopifyStorefrontToken ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Stored securely on the server. This field is intentionally blank unless you update it.
              </div>
            </dd>
          </div>
          <div className="sm:grid sm:grid-cols-3 sm:gap-4">
            <dt className="text-sm font-medium text-gray-500">Last Product Sync</dt>
            <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
              {tenant.lastProductSyncAt
                ? format(new Date(tenant.lastProductSyncAt), 'MMM d, yyyy HH:mm')
                : 'Never'}
            </dd>
          </div>
          {posError && (
            <div className="text-sm text-red-600">{posError}</div>
          )}
          {posSavedMessage && (
            <div className="text-sm text-green-700">{posSavedMessage}</div>
          )}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" disabled={posLoading} onClick={handleSavePosConfig}>
              {posLoading ? 'Saving…' : 'Save POS Config'}
            </Button>
            <Button type="button" variant="secondary" disabled={posLoading} onClick={handleTestConnection}>
              {posLoading ? 'Testing…' : 'Test Connection'}
            </Button>
            <Button type="button" disabled={posLoading} onClick={handleSyncCatalog}>
              {posLoading ? 'Syncing…' : 'Run Full Sync'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
