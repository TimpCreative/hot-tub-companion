'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Accordion } from '@/components/ui/Accordion';
import { BulkAddTable } from '@/components/ui/BulkAddTable';
import { MediaInput } from '@/components/ui/MediaInput';
import { DataSourceInput } from '@/components/ui/DataSourceInput';

interface ModelLine {
  id: string;
  brandId: string;
  brandName?: string;
  name: string;
}

export default function NewSpaModelPage() {
  const router = useRouter();
  const params = useParams();
  const modelLineId = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [modelLine, setModelLine] = useState<ModelLine | null>(null);

  const currentYear = new Date().getFullYear();

  const [formData, setFormData] = useState({
    modelLineId,
    brandId: '',
    name: '',
    year: currentYear,
    manufacturerSku: '',
    waterCapacityGallons: '',
    jetCount: '',
    seatingCapacity: '',
    dimensionsLengthInches: '',
    dimensionsWidthInches: '',
    dimensionsHeightInches: '',
    weightDryLbs: '',
    weightFilledLbs: '',
    electricalRequirement: '',
    hasOzone: false,
    hasUv: false,
    hasSaltSystem: false,
    imageUrl: '',
    specSheetUrl: '',
    isDiscontinued: false,
    notes: '',
    dataSource: '',
  });

  useEffect(() => {
    async function fetchModelLine() {
      try {
        const res = await fetch(`/api/dashboard/super-admin/scdb/model-lines/${modelLineId}`);
        const data = await res.json();
        if (data.success && data.data) {
          setModelLine(data.data);
          setFormData(prev => ({ ...prev, brandId: data.data.brandId }));
        }
      } catch (err) {
        console.error('Error fetching model line:', err);
      } finally {
        setFetching(false);
      }
    }
    fetchModelLine();
  }, [modelLineId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const payload = {
      ...formData,
      year: Number(formData.year),
      waterCapacityGallons: formData.waterCapacityGallons ? Number(formData.waterCapacityGallons) : undefined,
      jetCount: formData.jetCount ? Number(formData.jetCount) : undefined,
      seatingCapacity: formData.seatingCapacity ? Number(formData.seatingCapacity) : undefined,
      dimensionsLengthInches: formData.dimensionsLengthInches ? Number(formData.dimensionsLengthInches) : undefined,
      dimensionsWidthInches: formData.dimensionsWidthInches ? Number(formData.dimensionsWidthInches) : undefined,
      dimensionsHeightInches: formData.dimensionsHeightInches ? Number(formData.dimensionsHeightInches) : undefined,
      weightDryLbs: formData.weightDryLbs ? Number(formData.weightDryLbs) : undefined,
      weightFilledLbs: formData.weightFilledLbs ? Number(formData.weightFilledLbs) : undefined,
    };

    try {
      const res = await fetch('/api/dashboard/super-admin/scdb/spa-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to create spa model');
      }

      router.push(`/super-admin/uhtd/model-lines/${modelLineId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAdd = async (rows: Record<string, any>[]) => {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (!row.name || !row.year) {
        failed++;
        errors.push(`${row.name || 'Row'}: Name and Year are required`);
        continue;
      }

      try {
        const res = await fetch('/api/dashboard/super-admin/scdb/spa-models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modelLineId,
            brandId: modelLine?.brandId,
            name: row.name,
            year: Number(row.year),
            seatingCapacity: row.seatingCapacity ? Number(row.seatingCapacity) : undefined,
            jetCount: row.jetCount ? Number(row.jetCount) : undefined,
            electricalRequirement: row.electrical || undefined,
            isDiscontinued: row.isDiscontinued === true,
            dataSource: row.dataSource || 'Bulk import',
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          success++;
        } else {
          failed++;
          errors.push(`${row.name} (${row.year}): ${data.error?.message || 'Failed'}`);
        }
      } catch (err) {
        failed++;
        errors.push(`${row.name}: Network error`);
      }
    }

    return { success, failed, errors };
  };

  const bulkColumns = [
    { key: 'name', header: 'Model Name', required: true, placeholder: 'e.g., J-335', width: '150px' },
    { key: 'year', header: 'Year', type: 'number' as const, required: true, placeholder: String(currentYear), width: '80px' },
    { key: 'seatingCapacity', header: 'Seats', type: 'number' as const, placeholder: '#', width: '70px' },
    { key: 'jetCount', header: 'Jets', type: 'number' as const, placeholder: '#', width: '70px' },
    {
      key: 'electrical',
      header: 'Electrical',
      type: 'select' as const,
      options: [
        { value: '120V', label: '120V' },
        { value: '240V', label: '240V' },
        { value: '120V/240V', label: '120V/240V' },
      ],
      width: '100px',
    },
    { key: 'isDiscontinued', header: 'Disc.', type: 'checkbox' as const, width: '50px' },
    { key: 'dataSource', header: 'Source', placeholder: 'Source', width: '100px' },
  ];

  if (fetching) {
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
        <Link href={`/super-admin/uhtd/model-lines/${modelLineId}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to {modelLine?.name || 'Model Line'}
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">Add New Spa Model</h1>
        <p className="text-sm text-gray-500">
          {modelLine?.brandName} / {modelLine?.name}
        </p>
      </div>

      <div className="space-y-6">
        <Accordion title="Add Single Spa Model" subtitle="Add one spa model with full specifications" defaultOpen={true}>
          <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Model Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., J-335"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Year <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1970"
                max="2050"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Each year gets its own row</p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Specifications</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Seating Capacity</label>
                <input
                  type="number"
                  value={formData.seatingCapacity}
                  onChange={(e) => setFormData({ ...formData, seatingCapacity: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Jet Count</label>
                <input
                  type="number"
                  value={formData.jetCount}
                  onChange={(e) => setFormData({ ...formData, jetCount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Water Capacity (gal)</label>
                <input
                  type="number"
                  value={formData.waterCapacityGallons}
                  onChange={(e) => setFormData({ ...formData, waterCapacityGallons: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Electrical</label>
                <select
                  value={formData.electricalRequirement}
                  onChange={(e) => setFormData({ ...formData, electricalRequirement: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  <option value="120V">120V</option>
                  <option value="240V">240V</option>
                  <option value="120V/240V">120V/240V</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Features</h3>
            <div className="flex gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.hasOzone}
                  onChange={(e) => setFormData({ ...formData, hasOzone: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">Has Ozone</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.hasUv}
                  onChange={(e) => setFormData({ ...formData, hasUv: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">Has UV</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.hasSaltSystem}
                  onChange={(e) => setFormData({ ...formData, hasSaltSystem: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">Has Salt System</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isDiscontinued}
                  onChange={(e) => setFormData({ ...formData, isDiscontinued: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">Discontinued</span>
              </label>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Media</h3>
            <div className="grid grid-cols-2 gap-4">
              <MediaInput
                label="Product Image"
                value={formData.imageUrl}
                onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                accept="image/*"
                entityType="spa"
                fieldName="image"
              />
              <MediaInput
                label="Spec Sheet"
                value={formData.specSheetUrl}
                onChange={(url) => setFormData({ ...formData, specSheetUrl: url })}
                accept="application/pdf"
                entityType="spa"
                fieldName="specSheet"
              />
            </div>
          </div>

          <DataSourceInput
            value={formData.dataSource}
            onChange={(value) => setFormData({ ...formData, dataSource: value })}
          />

            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button type="submit" loading={loading}>
                Create Spa Model
              </Button>
              <Link href={`/super-admin/uhtd/model-lines/${modelLineId}`}>
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </Accordion>

        <Accordion title="Bulk Add Spa Models" subtitle="Add multiple spa models at once - great for adding multiple years of the same model">
          <p className="text-sm text-gray-600 mb-4">
            Tip: To quickly add a model across multiple years, add rows with the same name but different years.
          </p>
          <BulkAddTable columns={bulkColumns} onSubmit={handleBulkAdd} />
        </Accordion>
      </div>
    </div>
  );
}
