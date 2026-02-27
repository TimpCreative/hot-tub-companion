'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

interface Brand {
  id: string;
  name: string;
}

export default function NewModelLinePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedBrandId = searchParams.get('brandId');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);

  const [formData, setFormData] = useState({
    brandId: preselectedBrandId || '',
    name: '',
    description: '',
    isActive: true,
    dataSource: '',
  });

  useEffect(() => {
    async function fetchBrands() {
      try {
        const res = await fetch('/api/dashboard/super-admin/scdb/brands');
        const data = await res.json();
        if (data.success) {
          setBrands(data.data || []);
        }
      } catch (err) {
        console.error('Error fetching brands:', err);
      }
    }
    fetchBrands();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/dashboard/super-admin/scdb/model-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to create model line');
      }

      router.push(`/super-admin/uhtd/model-lines/${data.data.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const backHref = preselectedBrandId 
    ? `/super-admin/uhtd/brands/${preselectedBrandId}` 
    : '/super-admin/uhtd/brands';

  return (
    <div>
      <div className="mb-6">
        <Link href={backHref} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">Add New Model Line</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 max-w-2xl">
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Brand <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.brandId}
              onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select a brand...</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model Line Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., J-300 Series"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description of this model line..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Source</label>
            <input
              type="text"
              value={formData.dataSource}
              onChange={(e) => setFormData({ ...formData, dataSource: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Official website"
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
              Active
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button type="submit" loading={loading}>
              Create Model Line
            </Button>
            <Link href={backHref}>
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
