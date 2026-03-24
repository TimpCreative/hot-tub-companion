'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface Brand {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  isActive: boolean;
  dataSource: string | null;
}

interface Qualifier {
  id: string;
  name: string;
  displayName: string;
  isUniversal: boolean;
}

export default function EditBrandPage() {
  const params = useParams();
  const router = useRouter();
  const fetchWithAuth = useSuperAdminFetch();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    logoUrl: '',
    websiteUrl: '',
    isActive: true,
    dataSource: '',
  });

  const [qualifiers, setQualifiers] = useState<Qualifier[]>([]);
  const [selectedQualifierIds, setSelectedQualifierIds] = useState<string[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [brandRes, qualifiersRes, brandQualifiersRes] = await Promise.all([
          fetchWithAuth(`/api/dashboard/super-admin/scdb/brands/${params.id}`),
          fetchWithAuth('/api/dashboard/super-admin/qdb/qualifiers'),
          fetchWithAuth(`/api/dashboard/super-admin/qdb/brand-qualifiers/${params.id}`),
        ]);

        const brandData = await brandRes.json();
        const qualifiersData = await qualifiersRes.json();
        const brandQualifiersData = await brandQualifiersRes.json();

        if (brandData.success && brandData.data) {
          const brand: Brand = brandData.data;
          setFormData({
            name: brand.name,
            logoUrl: brand.logoUrl || '',
            websiteUrl: brand.websiteUrl || '',
            isActive: brand.isActive,
            dataSource: brand.dataSource || '',
          });
        }

        if (qualifiersData.success && qualifiersData.data) {
          const all = qualifiersData.data || [];
          setQualifiers(all.filter((q: Qualifier) => !q.isUniversal));
        }

        if (brandQualifiersData.success && brandQualifiersData.data) {
          setSelectedQualifierIds(Array.isArray(brandQualifiersData.data) ? brandQualifiersData.data : []);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params.id, fetchWithAuth]);

  const toggleQualifier = (id: string) => {
    setSelectedQualifierIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await fetchWithAuth(`/api/dashboard/super-admin/scdb/brands/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to update brand');
      }

      await fetchWithAuth(`/api/dashboard/super-admin/qdb/brand-qualifiers/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qualifierIds: selectedQualifierIds }),
      });

      router.push(`/super-admin/uhtd/brands/${params.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/super-admin/uhtd/brands/${params.id}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to Brand
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">Edit Brand</h1>
      </div>

      <div className="card rounded-lg max-w-2xl">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Brand Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
            <input
              type="url"
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website URL</label>
            <input
              type="url"
              value={formData.websiteUrl}
              onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://www.example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Source</label>
            <input
              type="text"
              value={formData.dataSource}
              onChange={(e) => setFormData({ ...formData, dataSource: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Official website, Manufacturer catalog"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">
              Active (visible to customers)
            </label>
          </div>

          {qualifiers.length > 0 && (
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-900 mb-2">Brand-Specific Qualifiers</h3>
              <p className="text-xs text-gray-500 mb-3">
                Assign qualifiers that appear only when adding/editing spas for this brand.
              </p>
              <div className="space-y-2">
                {qualifiers.map((q) => (
                  <label key={q.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedQualifierIds.includes(q.id)}
                      onChange={() => toggleQualifier(q.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{q.displayName}</span>
                    <span className="text-xs text-gray-400 font-mono">{q.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button type="submit" loading={saving}>
              Save Changes
            </Button>
            <Link href={`/super-admin/uhtd/brands/${params.id}`}>
              <Button type="button" variant="secondary">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
