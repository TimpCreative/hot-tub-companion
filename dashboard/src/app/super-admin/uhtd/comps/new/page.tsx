'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { SpaSelector } from '@/components/uhtd/SpaSelector';

interface Category {
  id: string;
  name: string;
  displayName: string;
}

export default function NewCompPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedId, setGeneratedId] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedSpaIds, setSelectedSpaIds] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    id: '',
    name: '',
    description: '',
    brandCode: '',
    categoryCode: '',
  });

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/dashboard/super-admin/pcdb/categories');
        const data = await res.json();
        if (data.success) setCategories(data.data || []);
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    }
    fetchCategories();
  }, []);

  const generateCompId = async () => {
    if (!formData.brandCode || !formData.categoryCode) {
      setError('Brand code and category code are required to generate ID');
      return;
    }

    try {
      const res = await fetch(
        `/api/dashboard/super-admin/comps/generate-id?brandCode=${formData.brandCode}&categoryCode=${formData.categoryCode}`
      );
      const data = await res.json();
      if (data.success) {
        const newId = data.data.generatedId;
        setGeneratedId(newId);
        setFormData((prev) => ({ ...prev, id: newId }));
        setError('');
      }
    } catch (err) {
      console.error('Error generating ID:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.name) {
      setError('Comp ID and name are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create the comp
      const compRes = await fetch('/api/dashboard/super-admin/comps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formData.id,
          name: formData.name,
          description: formData.description,
        }),
      });

      const compData = await compRes.json();
      if (!compRes.ok) {
        throw new Error(compData.error?.message || 'Failed to create comp');
      }

      // Add spas to the comp if selected
      if (selectedSpaIds.length > 0) {
        await fetch(`/api/dashboard/super-admin/comps/${encodeURIComponent(formData.id)}/spas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spaModelIds: selectedSpaIds }),
        });
      }

      router.push(`/super-admin/uhtd/comps/${encodeURIComponent(formData.id)}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link href="/super-admin/uhtd/comps" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Comps
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">Create Compatibility Group</h1>
        <p className="text-sm text-gray-500">
          Create a named group of spas that share compatible parts
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900">Comp Details</h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand Code
                  </label>
                  <input
                    type="text"
                    value={formData.brandCode}
                    onChange={(e) => setFormData({ ...formData, brandCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., JAC"
                    maxLength={4}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category Code
                  </label>
                  <select
                    value={formData.categoryCode}
                    onChange={(e) => setFormData({ ...formData, categoryCode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.name.toUpperCase().slice(0, 4)}>
                        {cat.name.toUpperCase().slice(0, 4)} - {cat.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comp ID <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value.toUpperCase() })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                    placeholder="COMP-JAC-FILT-001"
                    required
                  />
                  <Button type="button" variant="secondary" onClick={generateCompId}>
                    Generate
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Format: COMP-BRAND-CAT-### (e.g., COMP-JAC-FILT-001)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Jacuzzi J-300 Series Filters"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Describe which spas are in this group and why..."
                />
              </div>
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Create Comp
            </Button>
          </div>

          <div>
            <div className="bg-white rounded-lg border border-gray-200 h-[500px] flex flex-col">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Select Spas</h3>
                <p className="text-sm text-gray-500">
                  {selectedSpaIds.length} spa{selectedSpaIds.length !== 1 ? 's' : ''} selected
                </p>
              </div>
              <div className="flex-1 overflow-hidden">
                <SpaSelector selectedIds={selectedSpaIds} onChange={setSelectedSpaIds} />
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
