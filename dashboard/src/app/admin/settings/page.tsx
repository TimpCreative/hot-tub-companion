'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useUnsavedChanges } from '@/contexts/UnsavedChangesContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { TenantMediaInput } from '@/components/ui/TenantMediaInput';

export default function AdminSettingsPage() {
  const { getIdToken } = useAuth();
  const { config, loading } = useTenant();
  const { setUnsavedChanges } = useUnsavedChanges();

  const api = useMemo(() => createTenantApiClient(async () => await getIdToken()), [getIdToken]);

  const [primaryColor, setPrimaryColor] = useState<string>('#1B4D7A');
  const [secondaryColor, setSecondaryColor] = useState<string>('#E8A832');
  const [logoUrl, setLogoUrl] = useState<string>('');
  const [iconUrl, setIconUrl] = useState<string>('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    setPrimaryColor(config.branding.primaryColor || '#1B4D7A');
    setSecondaryColor(config.branding.secondaryColor || '#E8A832');
    setLogoUrl(config.branding.logoUrl || '');
    setIconUrl(config.branding.iconUrl || '');
    setUnsavedChanges(false);
  }, [config, setUnsavedChanges]);

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
      }) as any;

      if (res?.success) {
        setSuccess(res.message ?? 'Branding saved');
        setUnsavedChanges(false);
      } else {
        setError(res?.error?.message ?? 'Failed to save branding');
      }
    } catch (e: any) {
      setError(e?.error?.message ?? e?.message ?? 'Failed to save branding');
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
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Settings</h2>
      <p className="text-gray-600 mb-6">Branding for this retailer (used by the mobile app).</p>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-800">{success}</div>}

      <div className="space-y-4 bg-white rounded-lg border border-gray-200 p-6">
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

        <div className="flex items-center gap-3 pt-2">
          <Button type="button" loading={saving} onClick={handleSave}>
            Save Branding
          </Button>
          <p className="text-xs text-gray-500">
            After upload, click Save Branding. Images only. Min 1KB, max 10MB.
          </p>
        </div>
      </div>
    </div>
  );
}
