'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Accordion } from '@/components/ui/Accordion';
import { BulkAddTable } from '@/components/ui/BulkAddTable';
import { MediaInput } from '@/components/ui/MediaInput';
import { DataSourceInput } from '@/components/ui/DataSourceInput';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { QuickCreateBrandModal } from '@/components/uhtd/QuickCreateBrandModal';
import { QuickCreateModelLineModal } from '@/components/uhtd/QuickCreateModelLineModal';
import { ElectricalConfigInput, ElectricalConfig } from '@/components/uhtd/ElectricalConfigInput';

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
  const fetchWithAuth = useSuperAdminFetch();
  const preselectedModelLineId = searchParams.get('modelLineId');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [modelLines, setModelLines] = useState<ModelLine[]>([]);
  const [filteredModelLines, setFilteredModelLines] = useState<ModelLine[]>([]);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showModelLineModal, setShowModelLineModal] = useState(false);
  const [electricalConfigs, setElectricalConfigs] = useState<ElectricalConfig[]>([]);

  const [formData, setFormData] = useState({
    brandId: '',
    modelLineId: preselectedModelLineId || '',
    name: '',
    selectedYears: [] as number[],
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
    hasJacuzziTrue: false,
    imageUrl: '',
    specSheetUrl: '',
    notes: '',
    isDiscontinued: false,
    dataSource: '',
  });

  useEffect(() => {
    async function load() {
      try {
        const [brandsRes, modelLinesRes] = await Promise.all([
          fetchWithAuth('/api/dashboard/super-admin/scdb/brands'),
          fetchWithAuth('/api/dashboard/super-admin/scdb/model-lines'),
        ]);
        const [brandsData, mlData] = await Promise.all([brandsRes.json(), modelLinesRes.json()]);
        if (brandsData.success) setBrands(brandsData.data || []);
        if (mlData.success) setModelLines(mlData.data || []);
      } catch (err) {
        console.error('Error fetching brands/model lines:', err);
      }
    }
    load();
  }, [fetchWithAuth]);

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

    if (formData.selectedYears.length === 0) {
      setError('Please select at least one year');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const basePayload = {
        brandId: formData.brandId,
        modelLineId: formData.modelLineId,
        name: formData.name,
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
        hasJacuzziTrue: formData.hasJacuzziTrue,
        imageUrl: formData.imageUrl || null,
        specSheetUrl: formData.specSheetUrl || null,
        notes: formData.notes || null,
        isDiscontinued: formData.isDiscontinued,
        dataSource: formData.dataSource || null,
      };

      const validConfigs = electricalConfigs.filter(c => c.voltage && c.amperage);
      const electricalPayload = validConfigs.length > 0 ? {
        configs: validConfigs.map((c, i) => ({
          voltage: c.voltage,
          voltageUnit: c.voltageUnit,
          frequencyHz: c.frequencyHz || null,
          amperage: c.amperage,
          sortOrder: i,
        })),
      } : null;

      let createdSpas: { id: string }[] = [];

      if (formData.selectedYears.length === 1) {
        const res = await fetchWithAuth('/api/dashboard/super-admin/scdb/spa-models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...basePayload, year: formData.selectedYears[0] }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Failed to create spa model');
        createdSpas = [{ id: data.data.id }];

        if (electricalPayload) {
          await fetchWithAuth(`/api/dashboard/super-admin/scdb/spa-models/${data.data.id}/electrical`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(electricalPayload),
          });
        }
      } else {
        const res = await fetchWithAuth('/api/dashboard/super-admin/scdb/spa-models/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...basePayload, years: formData.selectedYears }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Failed to create spa models');
        createdSpas = data.data?.created || [];

        if (electricalPayload && createdSpas.length > 0) {
          for (const spa of createdSpas) {
            await fetchWithAuth(`/api/dashboard/super-admin/scdb/spa-models/${spa.id}/electrical`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(electricalPayload),
            });
          }
        }
      }

      if (createdSpas.length > 0) {
        router.push(`/super-admin/uhtd/spas/${createdSpas[0].id}`);
      } else {
        setError('No spas were created (all years may already exist)');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create spa(s)');
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
        const res = await fetchWithAuth('/api/dashboard/super-admin/scdb/spa-models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandId: ml.brandId,
            modelLineId: row.modelLineId,
            name: row.name,
            year: parseInt(row.year) || new Date().getFullYear(),
            manufacturerSku: row.manufacturerSku || null,
            seatingCapacity: row.seatingCapacity ? parseInt(row.seatingCapacity) : null,
            jetCount: row.jetCount ? parseInt(row.jetCount) : null,
            waterCapacityGallons: row.waterCapacityGallons ? parseInt(row.waterCapacityGallons) : null,
            dimensionsLengthInches: row.dimensionsLengthInches ? parseInt(row.dimensionsLengthInches) : null,
            dimensionsWidthInches: row.dimensionsWidthInches ? parseInt(row.dimensionsWidthInches) : null,
            dimensionsHeightInches: row.dimensionsHeightInches ? parseInt(row.dimensionsHeightInches) : null,
            weightDryLbs: row.weightDryLbs ? parseInt(row.weightDryLbs) : null,
            weightFilledLbs: row.weightFilledLbs ? parseInt(row.weightFilledLbs) : null,
            electricalRequirement: row.electricalRequirement || null,
            hasOzone: row.hasOzone || false,
            hasUv: row.hasUv || false,
            hasSaltSystem: row.hasSaltSystem || false,
            hasJacuzziTrue: row.hasJacuzziTrue || false,
            imageUrl: row.imageUrl || null,
            specSheetUrl: row.specSheetUrl || null,
            notes: row.notes || null,
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

  const toggleYear = (year: number) => {
    setFormData((prev) => ({
      ...prev,
      selectedYears: prev.selectedYears.includes(year)
        ? prev.selectedYears.filter((y) => y !== year)
        : [...prev.selectedYears, year].sort((a, b) => a - b),
    }));
  };

  const selectYearRange = (start: number, end: number) => {
    const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    setFormData((prev) => ({
      ...prev,
      selectedYears: [...new Set([...prev.selectedYears, ...range])].sort((a, b) => a - b),
    }));
  };

  const clearYears = () => setFormData((prev) => ({ ...prev, selectedYears: [] }));

  const bulkColumns = [
    // Identity
    {
      key: 'modelLineId',
      header: 'Model Line',
      type: 'select' as const,
      options: modelLines.map((ml) => {
        const brand = brands.find((b) => b.id === ml.brandId);
        return { value: ml.id, label: `${brand?.name || ''} - ${ml.name}` };
      }),
      required: true,
      width: '220px',
      group: 'Identity',
    },
    { key: 'name', header: 'Name', required: true, placeholder: 'J-335', width: '120px', group: 'Identity' },
    {
      key: 'year',
      header: 'Year',
      type: 'select' as const,
      options: years.map((y) => ({ value: String(y), label: String(y) })),
      required: true,
      width: '90px',
      group: 'Identity',
    },
    { key: 'manufacturerSku', header: 'Mfr #', placeholder: 'JAC-J335', width: '110px', group: 'Identity' },
    // Specs
    { key: 'seatingCapacity', header: 'Seats', type: 'number' as const, placeholder: '5', width: '70px', group: 'Specs' },
    { key: 'jetCount', header: 'Jets', type: 'number' as const, placeholder: '30', width: '70px', group: 'Specs' },
    { key: 'waterCapacityGallons', header: 'Gallons', type: 'number' as const, placeholder: '350', width: '80px', group: 'Specs' },
    { key: 'electricalRequirement', header: 'Electrical', placeholder: '240V/50A', width: '100px', group: 'Specs' },
    // Dimensions
    { key: 'dimensionsLengthInches', header: 'Length"', type: 'number' as const, placeholder: '85', width: '75px', group: 'Dimensions' },
    { key: 'dimensionsWidthInches', header: 'Width"', type: 'number' as const, placeholder: '85', width: '75px', group: 'Dimensions' },
    { key: 'dimensionsHeightInches', header: 'Height"', type: 'number' as const, placeholder: '36', width: '75px', group: 'Dimensions' },
    // Weight
    { key: 'weightDryLbs', header: 'Dry lbs', type: 'number' as const, placeholder: '725', width: '80px', group: 'Weight' },
    { key: 'weightFilledLbs', header: 'Filled lbs', type: 'number' as const, placeholder: '4200', width: '90px', group: 'Weight' },
    // Features
    { key: 'hasOzone', header: 'Ozone', type: 'checkbox' as const, width: '65px', group: 'Features' },
    { key: 'hasUv', header: 'UV', type: 'checkbox' as const, width: '55px', group: 'Features' },
    { key: 'hasSaltSystem', header: 'Salt', type: 'checkbox' as const, width: '55px', group: 'Features' },
    { key: 'hasJacuzziTrue', header: 'JacTrue', type: 'checkbox' as const, width: '70px', group: 'Features' },
    // Media
    { key: 'imageUrl', header: 'Image URL', placeholder: 'https://...', width: '150px', group: 'Media' },
    { key: 'specSheetUrl', header: 'Spec URL', placeholder: 'https://...', width: '150px', group: 'Media' },
    // Meta
    { key: 'notes', header: 'Notes', placeholder: 'Internal notes', width: '150px', group: 'Meta' },
    { key: 'isDiscontinued', header: 'Disc.', type: 'checkbox' as const, width: '60px', group: 'Meta' },
    { key: 'dataSource', header: 'Source', placeholder: 'Website', width: '100px', group: 'Meta' },
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer #</label>
                  <input
                    type="text"
                    value={formData.manufacturerSku}
                    onChange={(e) => setFormData({ ...formData, manufacturerSku: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., JAC-J335-2024"
                  />
                </div>
              </div>

              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Model Year(s) <span className="text-red-500">*</span> — select all years this model applies to
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => selectYearRange(currentYear - 24, currentYear)}
                    >
                      {currentYear - 24}–{currentYear}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => selectYearRange(currentYear - 14, currentYear)}
                    >
                      Last 15 years
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => selectYearRange(currentYear - 9, currentYear)}
                    >
                      Last 10 years
                    </Button>
                    <Button type="button" size="sm" variant="secondary" onClick={clearYears}>
                      Clear
                    </Button>
                  </div>
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-white">
                    <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
                      {years.map((year) => (
                        <label
                          key={year}
                          className="flex items-center gap-1.5 cursor-pointer hover:bg-gray-50 rounded px-2 py-1"
                        >
                          <input
                            type="checkbox"
                            checked={formData.selectedYears.includes(year)}
                            onChange={() => toggleYear(year)}
                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm">{year}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {formData.selectedYears.length > 0 && (
                    <p className="mt-1.5 text-xs text-gray-500">
                      {formData.selectedYears.length} year{formData.selectedYears.length !== 1 ? 's' : ''} selected
                    </p>
                  )}
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
              </div>
              
              <ElectricalConfigInput
                configs={electricalConfigs}
                onChange={setElectricalConfigs}
              />

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
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="hasJacuzziTrue"
                    checked={formData.hasJacuzziTrue}
                    onChange={(e) => setFormData({ ...formData, hasJacuzziTrue: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="hasJacuzziTrue" className="text-sm text-gray-700">
                    Has Jacuzzi True
                  </label>
                </div>
              </div>
            </div>

            {/* Media & Notes */}
            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              <h3 className="font-medium text-gray-900">Media & Notes</h3>
              
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

              <DataSourceInput
                value={formData.dataSource}
                onChange={(value) => setFormData({ ...formData, dataSource: value })}
              />

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

        <Accordion title="Bulk Add Spas" subtitle="Add multiple spa models at once - click Expand for full-screen view">
          <BulkAddTable columns={bulkColumns} onSubmit={handleBulkAdd} title="Bulk Add Spa Models" />
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
