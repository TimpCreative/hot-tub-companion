'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';

interface VercelDomainSummary {
  status: 'attached' | 'failed' | 'skipped';
  domain: string;
  reason?: string;
  error?: string;
}

interface CreatedTenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  apiKey?: string;
}

export default function NewTenantPage() {
  const fetchWithAuth = useSuperAdminFetch();
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#1B4D7A');
  const [secondaryColor, setSecondaryColor] = useState('#E8A832');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{
    tenant: CreatedTenant;
    vercelDomain?: VercelDomainSummary;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/dashboard/super-admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
        name,
        slug,
        apiKey: apiKey || undefined,
        primaryColor: primaryColor || undefined,
        secondaryColor: secondaryColor || undefined,
      }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message || 'Failed to create tenant');
        return;
      }
      const tenant = data.data?.tenant as CreatedTenant | undefined;
      const vercelDomain = data.data?.vercelDomain as VercelDomainSummary | undefined;
      if (tenant) {
        setCreated({ tenant, vercelDomain });
      } else {
        router.push('/super-admin/tenants');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create tenant';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSlugChange = (value: string) => {
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, '-'));
  };

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

      <h2 className="text-2xl font-semibold text-gray-900 mb-6">Create Tenant</h2>

      {error && (
        <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
      )}

      {created && (
        <div className="mb-6 max-w-xl space-y-4 rounded-lg border border-green-200 bg-green-50 p-4 text-green-900">
          <p className="font-medium">Tenant created: {created.tenant.name}</p>
          <p className="text-sm">
            API key (copy now; it may not be shown again):{' '}
            <span className="font-mono break-all">{created.tenant.apiKey}</span>
          </p>
          {created.vercelDomain && (
            <div className="rounded-md bg-white/80 p-3 text-sm text-gray-800">
              <p className="font-medium text-gray-900">Dashboard domain (Vercel)</p>
              <p className="mt-1 font-mono text-xs">{created.vercelDomain.domain}</p>
              {created.vercelDomain.status === 'attached' && (
                <p className="mt-2 text-green-800">Domain added to the Vercel project. Ensure DNS points this host to Vercel (wildcard or per-subdomain CNAME).</p>
              )}
              {created.vercelDomain.status === 'skipped' && (
                <p className="mt-2 text-amber-800">
                  Vercel auto-attach skipped ({created.vercelDomain.reason ?? 'not configured'}). Set VERCEL_TOKEN and VERCEL_PROJECT_ID on the API to enable.
                </p>
              )}
              {created.vercelDomain.status === 'failed' && (
                <p className="mt-2 text-red-700">
                  Vercel attach failed: {created.vercelDomain.error ?? 'Unknown error'}. Check API logs and Vercel project settings.
                </p>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href={`/super-admin/tenants/${created.tenant.id}`}>
              <Button type="button">View tenant</Button>
            </Link>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setCreated(null);
                setName('');
                setSlug('');
                setApiKey('');
              }}
            >
              Create another
            </Button>
          </div>
        </div>
      )}

      {!created && (
      <form onSubmit={handleSubmit} className="max-w-xl space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="slug" className="block text-sm font-medium text-gray-700 mb-1">
            Slug (subdomain)
          </label>
          <input
            id="slug"
            type="text"
            required
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="e.g. takeabreak"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
            API Key (optional; auto-generated if empty)
          </label>
          <input
            id="apiKey"
            type="text"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="primaryColor" className="block text-sm font-medium text-gray-700 mb-1">
            Primary Color
          </label>
          <input
            id="primaryColor"
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-full rounded border border-gray-300"
          />
        </div>
        <div>
          <label htmlFor="secondaryColor" className="block text-sm font-medium text-gray-700 mb-1">
            Secondary Color
          </label>
          <input
            id="secondaryColor"
            type="color"
            value={secondaryColor}
            onChange={(e) => setSecondaryColor(e.target.value)}
            className="h-10 w-full rounded border border-gray-300"
          />
        </div>
        <div className="flex gap-3 pt-4">
          <Button type="submit" loading={loading}>
            Create Tenant
          </Button>
          <Link href="/super-admin/tenants">
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
      )}
    </div>
  );
}
