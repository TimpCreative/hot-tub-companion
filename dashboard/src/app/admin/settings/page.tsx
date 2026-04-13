'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUnsavedChanges } from '@/contexts/UnsavedChangesContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { TenantMediaInput } from '@/components/ui/TenantMediaInput';

interface DealerContactResponse {
  phone?: string | null;
  address?: string | null;
  email?: string | null;
  hours?: string | null;
}

interface BrandingResponse {
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  iconUrl?: string;
  timezone?: string;
}

interface ShopDisplayResponse {
  lowStockThreshold?: number;
  showInStockWhenAboveThreshold?: boolean;
}

interface SettingsResponse {
  success?: boolean;
  message?: string;
  error?: { message?: string };
  data?: {
    branding?: BrandingResponse;
    dealerContact?: DealerContactResponse;
    shopDisplay?: ShopDisplayResponse;
  };
}

interface SettingsSnapshot {
  primaryColor: string;
  secondaryColor: string;
  logoUrl: string;
  iconUrl: string;
  timezone: string;
  dealerPhone: string;
  dealerAddress: string;
  dealerEmail: string;
  dealerHours: string;
  shopLowStockThreshold: number;
  shopShowInStockWhenAboveThreshold: boolean;
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

export default function AdminSettingsPage() {
  const { getIdToken } = useAuth();
  const { setUnsavedChanges } = useUnsavedChanges();

  const api = useMemo(() => createTenantApiClient(async () => await getIdToken()), [getIdToken]);

  const [primaryColor, setPrimaryColor] = useState<string>('#1B4D7A');
  const [secondaryColor, setSecondaryColor] = useState<string>('#E8A832');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [iconUrl, setIconUrl] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('America/Denver');
  const [dealerPhone, setDealerPhone] = useState<string>('');
  const [dealerAddress, setDealerAddress] = useState<string>('');
  const [dealerEmail, setDealerEmail] = useState<string>('');
  const [dealerHours, setDealerHours] = useState<string>('');
  const [shopLowStockThreshold, setShopLowStockThreshold] = useState(5);
  const [shopShowInStockWhenAboveThreshold, setShopShowInStockWhenAboveThreshold] = useState(true);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [initialSnapshot, setInitialSnapshot] = useState<SettingsSnapshot | null>(null);

  useEffect(() => {
    if (!initialSnapshot) return;
    const dirty =
      primaryColor !== initialSnapshot.primaryColor ||
      secondaryColor !== initialSnapshot.secondaryColor ||
      logoUrl !== initialSnapshot.logoUrl ||
      iconUrl !== initialSnapshot.iconUrl ||
      timezone !== initialSnapshot.timezone ||
      dealerPhone !== initialSnapshot.dealerPhone ||
      dealerAddress !== initialSnapshot.dealerAddress ||
      dealerEmail !== initialSnapshot.dealerEmail ||
      dealerHours !== initialSnapshot.dealerHours ||
      shopLowStockThreshold !== initialSnapshot.shopLowStockThreshold ||
      shopShowInStockWhenAboveThreshold !== initialSnapshot.shopShowInStockWhenAboveThreshold;
    setUnsavedChanges(dirty);
  }, [
    dealerAddress,
    dealerEmail,
    dealerHours,
    dealerPhone,
    iconUrl,
    initialSnapshot,
    logoUrl,
    primaryColor,
    secondaryColor,
    setUnsavedChanges,
    shopLowStockThreshold,
    shopShowInStockWhenAboveThreshold,
    timezone,
  ]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const brandingRes = (await api.get('/admin/settings/branding')) as SettingsResponse;
        const branding = brandingRes?.data?.branding;
        const dealerContact = brandingRes?.data?.dealerContact;
        const shopDisplay = brandingRes?.data?.shopDisplay;
        setPrimaryColor(branding?.primaryColor || '#1B4D7A');
        setSecondaryColor(branding?.secondaryColor || '#E8A832');
        setLogoUrl(branding?.logoUrl || '');
        setIconUrl(branding?.iconUrl || '');
        setTimezone(branding?.timezone ?? 'America/Denver');
        setDealerPhone(dealerContact?.phone ?? '');
        setDealerAddress(dealerContact?.address ?? '');
        setDealerEmail(dealerContact?.email ?? '');
        setDealerHours(dealerContact?.hours ?? '');
        const lowStock =
          typeof shopDisplay?.lowStockThreshold === 'number' ? shopDisplay.lowStockThreshold : 5;
        setShopLowStockThreshold(Math.min(999, Math.max(0, lowStock)));
        setShopShowInStockWhenAboveThreshold(shopDisplay?.showInStockWhenAboveThreshold !== false);
        setInitialSnapshot({
          primaryColor: branding?.primaryColor || '#1B4D7A',
          secondaryColor: branding?.secondaryColor || '#E8A832',
          logoUrl: branding?.logoUrl || '',
          iconUrl: branding?.iconUrl || '',
          timezone: branding?.timezone ?? 'America/Denver',
          dealerPhone: dealerContact?.phone ?? '',
          dealerAddress: dealerContact?.address ?? '',
          dealerEmail: dealerContact?.email ?? '',
          dealerHours: dealerContact?.hours ?? '',
          shopLowStockThreshold: Math.min(999, Math.max(0, lowStock)),
          shopShowInStockWhenAboveThreshold: shopDisplay?.showInStockWhenAboveThreshold !== false,
        });
      } catch (e: unknown) {
        setError(getErrorMessage(e, 'Failed to load settings'));
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [api, setUnsavedChanges]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.put('/admin/settings/branding', {
        primaryColor,
        secondaryColor,
        logoUrl: logoUrl.trim().length > 0 ? logoUrl.trim() : null,
        iconUrl: iconUrl.trim().length > 0 ? iconUrl.trim() : null,
        timezone: timezone.trim() || 'America/Denver',
        dealerContact: {
          phone: dealerPhone.trim() || null,
          address: dealerAddress.trim() || null,
          email: dealerEmail.trim() || null,
          hours: dealerHours.trim() || null,
        },
        shopDisplay: {
          lowStockThreshold: Math.min(999, Math.max(0, Math.trunc(shopLowStockThreshold))),
          showInStockWhenAboveThreshold: shopShowInStockWhenAboveThreshold,
        },
      }) as SettingsResponse;

      if (res?.success) {
        setSuccess(res.message ?? 'Settings saved');
        setInitialSnapshot((prev) =>
          prev
            ? {
                ...prev,
                primaryColor,
                secondaryColor,
                logoUrl,
                iconUrl,
                timezone: timezone.trim() || 'America/Denver',
                dealerPhone,
                dealerAddress,
                dealerEmail,
                dealerHours,
                shopLowStockThreshold: Math.min(999, Math.max(0, Math.trunc(shopLowStockThreshold))),
                shopShowInStockWhenAboveThreshold,
              }
            : prev
        );
      } else {
        setError(res?.error?.message ?? 'Failed to save settings');
      }
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to save settings'));
    } finally {
      setSaving(false);
    }
  }

  function normalizeHex(hex: string) {
    const v = hex.startsWith('#') ? hex : `#${hex}`;
    return v.toUpperCase();
  }

  async function copyHex(hex: string) {
    try {
      await navigator.clipboard.writeText(normalizeHex(hex));
    } catch {
      // Clipboard may be unavailable in some environments; ignore silently.
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">General</h2>
      <p className="text-gray-600 mb-6 text-sm">
        Branding, public dealer contact, and shop display defaults. Use the <strong className="font-medium">POS integration</strong>{' '}
        tab for Shopify sync.
      </p>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-800">{success}</div>}

      <div className="card space-y-4 rounded-lg p-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Primary Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => {
                setUnsavedChanges(true);
                setPrimaryColor(e.target.value);
              }}
              className="h-10 w-24 rounded border border-gray-200"
            />
            <button
              type="button"
              onClick={() => copyHex(primaryColor)}
              className="text-xs font-mono text-gray-700 hover:text-gray-900 underline underline-offset-2"
              aria-label="Copy primary hex"
            >
              {normalizeHex(primaryColor)}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => {
                setUnsavedChanges(true);
                setSecondaryColor(e.target.value);
              }}
              className="h-10 w-24 rounded border border-gray-200"
            />
            <button
              type="button"
              onClick={() => copyHex(secondaryColor)}
              className="text-xs font-mono text-gray-700 hover:text-gray-900 underline underline-offset-2"
              aria-label="Copy secondary hex"
            >
              {normalizeHex(secondaryColor)}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Retailer timezone</label>
          <p className="text-xs text-gray-500 mb-2">
            Used for notification scheduling. Shown next to &quot;Send at&quot; so schedulers know the system time.
          </p>
          <select
            value={timezone}
            onChange={(e) => {
              setUnsavedChanges(true);
              setTimezone(e.target.value);
            }}
            className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2"
          >
            <option value="America/New_York">Eastern (America/New_York)</option>
            <option value="America/Chicago">Central (America/Chicago)</option>
            <option value="America/Denver">Mountain (America/Denver)</option>
            <option value="America/Phoenix">Arizona (America/Phoenix)</option>
            <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
            <option value="America/Anchorage">Alaska (America/Anchorage)</option>
            <option value="Pacific/Honolulu">Hawaii (Pacific/Honolulu)</option>
            <option value="UTC">UTC</option>
          </select>
        </div>

        <div className="space-y-4">
          <TenantMediaInput
            label="Logo (full horizontal)"
            value={logoUrl}
            onChange={(v) => {
              setUnsavedChanges(true);
              setLogoUrl(v);
            }}
            fieldName="logo_url"
          />
          <TenantMediaInput
            label="Logomark (square/icon)"
            value={iconUrl}
            onChange={(v) => {
              setUnsavedChanges(true);
              setIconUrl(v);
            }}
            fieldName="icon_url"
          />
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Public dealer contact</h3>
            <p className="text-xs text-gray-500 mt-1">
              Used anywhere the app needs retailer contact details, including Home and Dealer surfaces.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Public phone</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              value={dealerPhone}
              onChange={(e) => {
                setUnsavedChanges(true);
                setDealerPhone(e.target.value);
              }}
              placeholder="(555) 123-4567"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Public address</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              rows={3}
              value={dealerAddress}
              onChange={(e) => {
                setUnsavedChanges(true);
                setDealerAddress(e.target.value);
              }}
              placeholder="123 Main St, City, ST 12345"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Public email</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              type="email"
              value={dealerEmail}
              onChange={(e) => {
                setUnsavedChanges(true);
                setDealerEmail(e.target.value);
              }}
              placeholder="service@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Public hours</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              rows={3}
              value={dealerHours}
              onChange={(e) => {
                setUnsavedChanges(true);
                setDealerHours(e.target.value);
              }}
              placeholder="Mon-Fri: 9AM-6PM&#10;Sat: 9AM-4PM"
            />
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Shop (mobile app)</h3>
            <p className="text-xs text-gray-500 mt-1">
              Product detail screen: when inventory is at or below the threshold, customers see how many are left.
              Above the threshold, you can show a generic &quot;In stock&quot; line or hide it.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Show remaining count when quantity is at most…
            </label>
            <input
              type="number"
              min={0}
              max={999}
              className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2"
              value={shopLowStockThreshold}
              onChange={(e) => {
                setUnsavedChanges(true);
                const raw = e.target.value;
                if (raw === '') {
                  setShopLowStockThreshold(5);
                  return;
                }
                const v = parseInt(raw, 10);
                if (Number.isFinite(v)) setShopLowStockThreshold(Math.min(999, Math.max(0, v)));
              }}
            />
          </div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 rounded border-gray-300"
              checked={shopShowInStockWhenAboveThreshold}
              onChange={(e) => {
                setUnsavedChanges(true);
                setShopShowInStockWhenAboveThreshold(e.target.checked);
              }}
            />
            <span className="text-sm text-gray-700">
              When quantity is above that threshold, show &quot;In stock&quot; (uncheck to show nothing)
            </span>
          </label>
        </div>

        <div className="pt-2">
          <Button type="button" loading={saving} onClick={handleSave}>
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
