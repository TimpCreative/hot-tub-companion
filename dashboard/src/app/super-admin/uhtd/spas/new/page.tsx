'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Accordion } from '@/components/ui/Accordion';
import { BulkAddTable } from '@/components/ui/BulkAddTable';
import { QuickCreateBrandModal } from '@/components/uhtd/QuickCreateBrandModal';
import { QuickCreateModelLineModal } from '@/components/uhtd/QuickCreateModelLineModal';

interface Brand {
  id: string;
  name: string;
}

interface ModelLine {
  id: string;
  name: string;
  brandId: string;
}

function NewSpaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedModelLineId = searchParams.get('modelLineId');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [modelLines, setModelLines] = useState<ModelLine[]>([]);
  const [filteredModelLines, setFilteredModelLines] = useState<ModelLine[]>([]);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showModelLineModal, setShowModelLineModal] = useState(false);

  const [formData, setFormData] = useState({
    brandId: '',
    modelLineId: preselectedModelLineId || '',
    name: '',
    year: new Date().getFullYear(),
    manufacturerSku: '',
    seatingCapacity: '',
    jetCount: '',
    dimensionsLengthInches: '',
    dimensionsWidthInches: '',
    dimensionsHeightInches: '',
    waterCapacityGallons: '',
    weightDryLbs: '',
    weightFilledLbs: '',
    electricalRequirement: '',
    hasOzone: false,
    hasUv: false,
    hasSaltSystem: false,
    imageUrl: '',
    specSheetUrl: '',
    notes: '',
    isDiscontinued: false,
    dataSource: '',
  });

  useEffect(() => {
    async function fetchBrands() {
      try {
        const res = await fetch('/api/dashboard/super-admin/scdb/brands');
        const data = await res.json();
        if (data.success) setBrands(data.data || []);
      } catch (err) {
        console.error('Error fetching brands:', err);
      }
    }
    fetchBrands();
  }, []);

  useEffect(() => {
    async function fetchModelLines() {
      try {
        const res = await fetch('/api/dashboard/super-admin/scdb/model-lines');
        const data = await res.json();
        if (data.success) setModelLines(data.data || []);
      } catch (err) {
        console.error('Error fetching model lines:', err);
      }
    }
    fetchModelLines();
  }, []);

  useEffect(() => {
    if (formData.brandId) {
      setFilteredModelLines(modelLines.filter((ml) => ml.brandId === formData.brandId));
    } else {
      setFilteredModelLines(modelLines);
    }
  }, [formData.brandId, modelLines]);

  useEffect(() => {
    if (preselectedModelLineId && modelLines.length > 0) {
      const ml = modelLines.find((m) => m.id === preselectedModelLineId);
      if (ml) {
        setFormData((prev) => ({ ...prev, brandId: ml.brandId, modelLineId: ml.id }));
      }
    }
  }, [preselectedModelLineId, modelLines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const payload = {
        brandId: formData.brandId,
        modelLineId: formData.modelLineId,
        name: formData.name,
        year: formData.year,
        manufacturerSku: formData.manufacturerSku || null,
        seatingCapacity: formData.seatingCapacity ? parseInt(formData.seatingCapacity) : null,
        jetCount: formData.jetCount ? parseInt(formData.jetCount) : null,
        dimensionsLengthInches: formData.dimensionsLengthInches ? parseInt(formData.dimensionsLengthInches) : null,
        dimensionsWidthInches: formData.dimensionsWidthInches ? parseInt(formData.dimensionsWidthInches) : null,
        dimensionsHeightInches: formData.dimensionsHeightInches ? parseInt(formData.dimensionsHeightInches) : null,
        waterCapacityGallons: formData.waterCapacityGallons ? parseInt(formData.waterCapacityGallons) : null,
        weightDryLbs: formData.weightDryLbs ? parseInt(formData.weightDryLbs) : null,
        weightFilledLbs: formData.weightFilledLbs ? parseInt(formData.weightFilledLbs) : null,
        electricalRequirement: formData.electricalRequirement || null,
        hasOzone: formData.hasOzone,
        hasUv: formData.hasUv,
        hasSaltSystem: formData.hasSaltSystem,
        imageUrl: formData.imageUrl || null,
        specSheetUrl: formData.specSheetUrl || null,
        notes: formData.notes || null,
        isDiscontinued: formData.isDiscontinued,
        dataSource: formData.dataSource || null,
      };

      const res = await fetch('/api/dashboard/super-admin/scdb/spa-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to create spa model');
      }

      router.push(`/super-admin/uhtd/spas/${data.data.id}`);
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
      if (!row.modelLineId) {
        failed++;
        errors.push(`${row.name || 'Row'}: Model Line is required`);
        continue;
      }

      const ml = modelLines.find((m) => m.id === row.modelLineId);
      if (!ml) {
        failed++;
        errors.push(`${row.name || 'Row'}: Invalid Model Line`);
        continue;
      }

      try {
        const res = await fetch('/api/dashboard/super-admin/scdb/spa-models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandId: ml.brandId,
            modelLineId: row.modelLineId,
            name: row.name,
            year: parseInt(row.year) || new Date().getFullYear(),
            seatingCapacity: row.seatingCapacity ? parseInt(row.seatingCapacity) : null,
            jetCount: row.jetCount ? parseInt(row.jetCount) : null,
            isDiscontinued: row.isDiscontinued || false,
            dataSource: row.dataSource || 'Bulk import',
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          success++;
        } else {
          failed++;
          errors.push(`${row.name}: ${data.error?.message || 'Failed'}`);
        }
      } catch (err) {
        failed++;
        errors.push(`${row.name}: Network error`);
      }
    }

    return { success, failed, errors };
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 50 }, (_, i) => currentYear - i + 2);

  const bulkColumns = [
    {
      key: 'modelLineId',
      header: 'Model Line',
      type: 'select' as const,
      options: modelLines.map((ml) => {
        const brand = brands.find((b) => b.id === ml.brandId);
        return { value: ml.id, label: `${brand?.name || ''} - ${ml.name}` };
      }),
      required: true,
      width: '250px',
    },
    { key: 'name', header: 'Model Name', required: true, placeholder: 'e.g., J-335', width: '150px' },
    {
      key: 'year',
      header: 'Year',
      type: 'select' as const,
      options: years.map((y) => ({ value: String(y), label: String(y) })),
      required: true,
      width: '100px',
    },
    { key: 'seatingCapacity', header: 'Seats', type: 'number' as const, placeholder: '5', width: '80px' },
    { key: 'jetCount', header: 'Jets', type: 'number' as const, placeholder: '30', width: '80px' },
    { key: 'dataSource', header: 'Data Source', placeholder: 'Source', width: '120px' },
    { key: 'isDiscontinued', header: 'Discontinued', type: 'checkbox' as const, width: '100px' },
  ];

  return (
    <div>
      <div className="mb-6">
        <Link href="/super-admin/uhtd/spas" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Spas
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">Add New Spa Model</h1>
      </div>

      <div className="space-y-6">
        <Accordion title="Add Single Spa" subtitle="Add one spa model with full details" defaultOpen={true}>
          <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Brand & Model Line */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              <h3 className="font-medium text-gray-900">Spa Identity</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.brandId}
                      onChange={(e) => {
                        setFormData({ ...formData, brandId: e.target.value, modelLineId: '' });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select brand...</option>
                      {brands.map((brand) => (
                        <option key={brand.id} value={brand.id}>
                          {brand.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowBrandModal(true)}
                      className="whitespace-nowrap text-sm px-2"
                    >
                      +
                    </Button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Model Line <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={formData.modelLineId}
                      onChange={(e) => setFormData({ ...formData, modelLineId: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                      disabled={!formData.brandId}
                    >
                      <option value="">
                        {formData.brandId ? 'Select model line...' : 'Select a brand first'}
                      </option>
                      {filteredModelLines.map((ml) => (
                        <option key={ml.id} value={ml.id}>
                          {ml.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setShowModelLineModal(true)}
                      className="whitespace-nowrap text-sm px-2"
                      disabled={!formData.brandId}
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
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
                    Model Year <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    {years.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer SKU</label>
                  <input
                    type="text"
                    value={formData.manufacturerSku}
                    onChange={(e) => setFormData({ ...formData, manufacturerSku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., JAC-J335-2024"
                  />
                </div>
              </div>
            </div>

            {/* Specifications */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              <h3 className="font-medium text-gray-900">Specifications</h3>
              
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Seating Capacity</label>
                  <input
                    type="number"
                    value={formData.seatingCapacity}
                    onChange={(e) => setFormData({ ...formData, seatingCapacity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="5"
                    min="1"
                    max="20"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jet Count</label>
                  <input
                    type="number"
                    value={formData.jetCount}
                    onChange={(e) => setFormData({ ...formData, jetCount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="30"
                    min="0"
                    max="200"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Water Capacity (gal)</label>
                  <input
                    type="number"
                    value={formData.waterCapacityGallons}
                    onChange={(e) => setFormData({ ...formData, waterCapacityGallons: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="350"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Electrical</label>
                  <input
                    type="text"
                    value={formData.electricalRequirement}
                    onChange={(e) => setFormData({ ...formData, electricalRequirement: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="240V/50A"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Length (inches)</label>
                  <input
                    type="number"
                    value={formData.dimensionsLengthInches}
                    onChange={(e) => setFormData({ ...formData, dimensionsLengthInches: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="85"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Width (inches)</label>
                  <input
                    type="number"
                    value={formData.dimensionsWidthInches}
                    onChange={(e) => setFormData({ ...formData, dimensionsWidthInches: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="85"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Height (inches)</label>
                  <input
                    type="number"
                    value={formData.dimensionsHeightInches}
                    onChange={(e) => setFormData({ ...formData, dimensionsHeightInches: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="36"
                    min="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dry Weight (lbs)</label>
                  <input
                    type="number"
                    value={formData.weightDryLbs}
                    onChange={(e) => setFormData({ ...formData, weightDryLbs: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="725"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filled Weight (lbs)</label>
                  <input
                    type="number"
                    value={formData.weightFilledLbs}
                    onChange={(e) => setFormData({ ...formData, weightFilledLbs: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="4200"
                    min="0"
                  />
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              <h3 className="font-medium text-gray-900">Sanitization Features</h3>
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasOzone"
                    checked={formData.hasOzone}
                    onChange={(e) => setFormData({ ...formData, hasOzone: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="hasOzone" className="text-sm text-gray-700">
                    Has Ozone System
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasUv"
                    checked={formData.hasUv}
                    onChange={(e) => setFormData({ ...formData, hasUv: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="hasUv" className="text-sm text-gray-700">
                    Has UV System
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasSaltSystem"
                    checked={formData.hasSaltSystem}
                    onChange={(e) => setFormData({ ...formData, hasSaltSystem: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="hasSaltSystem" className="text-sm text-gray-700">
                    Has Salt System
                  </label>
                </div>
              </div>
            </div>

            {/* Media & Notes */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              <h3 className="font-medium text-gray-900">Media & Notes</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                  <input
                    type="url"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Spec Sheet URL</label>
                  <input
                    type="url"
                    value={formData.specSheetUrl}
                    onChange={(e) => setFormData({ ...formData, specSheetUrl: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Internal notes about this spa model..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Source</label>
                <input
                  type="text"
                  value={formData.dataSource}
                  onChange={(e) => setFormData({ ...formData, dataSource: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Official website, spec sheet"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isDiscontinued"
                  checked={formData.isDiscontinued}
                  onChange={(e) => setFormData({ ...formData, isDiscontinued: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isDiscontinued" className="text-sm text-gray-700">
                  Discontinued
                </label>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button type="submit" loading={loading}>
                Create Spa Model
              </Button>
              <Link href="/super-admin/uhtd/spas">
                <Button type="button" variant="secondary">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </Accordion>

        <Accordion title="Bulk Add Spas" subtitle="Add multiple spa models at once using a spreadsheet-style table">
          <BulkAddTable columns={bulkColumns} onSubmit={handleBulkAdd} />
        </Accordion>
      </div>

      <QuickCreateBrandModal
        isOpen={showBrandModal}
        onClose={() => setShowBrandModal(false)}
        onCreated={(brand) => {
          setBrands((prev) => [...prev, brand]);
          setFormData((prev) => ({ ...prev, brandId: brand.id, modelLineId: '' }));
          setShowBrandModal(false);
        }}
      />

      <QuickCreateModelLineModal
        isOpen={showModelLineModal}
        onClose={() => setShowModelLineModal(false)}
        preSelectedBrandId={formData.brandId}
        onCreated={(ml) => {
          setModelLines((prev) => [...prev, { id: ml.id, name: ml.name, brandId: ml.brandId }]);
          setFormData((prev) => ({ ...prev, modelLineId: ml.id }));
          setShowModelLineModal(false);
        }}
      />
    </div>
  );
}

export default function NewSpaPage() {
  return (
    <Suspense fallback={<div className="animate-pulse">Loading...</div>}>
      <NewSpaForm />
    </Suspense>
  );
}
