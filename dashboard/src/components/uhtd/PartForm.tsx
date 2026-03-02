'use client';

import React, { useState, useEffect } from 'react';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { Button } from '../ui/Button';
import { MediaInput } from '../ui/MediaInput';
import { DataSourceInput } from '../ui/DataSourceInput';
import { SpaSelector } from './SpaSelector';
import { CompSidebar } from './CompSidebar';
import { CompQuickview } from './CompQuickview';

interface Category {
  id: string;
  name: string;
  displayName: string;
}

interface PartFormData {
  categoryId: string;
  partNumber: string;
  manufacturerSku: string;
  upc: string;
  ean: string;
  name: string;
  manufacturer: string;
  isOem: boolean;
  isUniversal: boolean;
  isDiscontinued: boolean;
  displayImportance: number;
  imageUrl: string;
  specSheetUrl: string;
  skuAliases: string;
  notes: string;
  dataSource: string;
}

interface PartFormProps {
  initialData?: Partial<PartFormData>;
  selectedSpaIds?: string[];
  onSubmit: (data: PartFormData, spaIds: string[]) => Promise<void>;
  submitLabel?: string;
  loading?: boolean;
}

export function PartForm({
  initialData,
  selectedSpaIds: initialSpaIds = [],
  onSubmit,
  submitLabel = 'Save Part',
  loading = false,
}: PartFormProps) {
  const fetchWithAuth = useSuperAdminFetch();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedSpaIds, setSelectedSpaIds] = useState<string[]>(initialSpaIds);
  const [quickviewCompId, setQuickviewCompId] = useState<string | null>(null);

  const [formData, setFormData] = useState<PartFormData>({
    categoryId: initialData?.categoryId || '',
    partNumber: initialData?.partNumber || '',
    manufacturerSku: initialData?.manufacturerSku || '',
    upc: initialData?.upc || '',
    ean: initialData?.ean || '',
    name: initialData?.name || '',
    manufacturer: initialData?.manufacturer || '',
    isOem: initialData?.isOem ?? false,
    isUniversal: initialData?.isUniversal ?? false,
    isDiscontinued: initialData?.isDiscontinued ?? false,
    displayImportance: initialData?.displayImportance ?? 2,
    imageUrl: initialData?.imageUrl || '',
    specSheetUrl: initialData?.specSheetUrl || '',
    skuAliases: initialData?.skuAliases || '',
    notes: initialData?.notes || '',
    dataSource: initialData?.dataSource || '',
  });

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetchWithAuth('/api/dashboard/super-admin/pcdb/categories');
        const data = await res.json();
        if (data.success) {
          setCategories(data.data || []);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    }
    fetchCategories();
  }, [fetchWithAuth]);

  const handleCompSelect = async (compId: string) => {
    try {
      const res = await fetchWithAuth(`/api/dashboard/super-admin/comps/${compId}/spas`);
      const data = await res.json();
      if (data.success && data.data) {
        const compSpaIds = data.data.map((s: { spaModelId: string }) => s.spaModelId);
        setSelectedSpaIds((prev) => {
          const combined = new Set([...prev, ...compSpaIds]);
          return Array.from(combined);
        });
      }
    } catch (err) {
      console.error('Error fetching comp spas:', err);
    }
  };

  const handleSpasSelect = (spaIds: string[]) => {
    setSelectedSpaIds((prev) => {
      const combined = new Set([...prev, ...spaIds]);
      return Array.from(combined);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData, selectedSpaIds);
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Part Details - Left column */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Part Details</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Part Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Proclarity Filter Cartridge"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Part Number</label>
                <input
                  type="text"
                  value={formData.partNumber}
                  onChange={(e) => setFormData({ ...formData, partNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer SKU</label>
                <input
                  type="text"
                  value={formData.manufacturerSku}
                  onChange={(e) => setFormData({ ...formData, manufacturerSku: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UPC</label>
                <input
                  type="text"
                  value={formData.upc}
                  onChange={(e) => setFormData({ ...formData, upc: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">EAN</label>
                <input
                  type="text"
                  value={formData.ean}
                  onChange={(e) => setFormData({ ...formData, ean: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Manufacturer</label>
              <input
                type="text"
                value={formData.manufacturer}
                onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU Aliases</label>
              <input
                type="text"
                value={formData.skuAliases}
                onChange={(e) => setFormData({ ...formData, skuAliases: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Comma-separated aliases"
              />
              <p className="text-xs text-gray-500 mt-1">Alternative SKUs or part numbers (comma-separated)</p>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isOem}
                  onChange={(e) => setFormData({ ...formData, isOem: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">OEM Part</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isUniversal}
                  onChange={(e) => setFormData({ ...formData, isUniversal: e.target.checked })}
                  className="rounded border-gray-300 text-blue-600"
                />
                <span className="text-sm text-gray-700">Universal (fits all)</span>
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

            <div className="grid grid-cols-2 gap-4">
              <MediaInput
                label="Product Image"
                value={formData.imageUrl}
                onChange={(url) => setFormData({ ...formData, imageUrl: url })}
                accept="image/*"
                entityType="part"
                fieldName="image"
              />
              <MediaInput
                label="Spec Sheet"
                value={formData.specSheetUrl}
                onChange={(url) => setFormData({ ...formData, specSheetUrl: url })}
                accept="application/pdf"
                entityType="part"
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
                placeholder="Internal notes about this part..."
              />
            </div>

            <DataSourceInput
              value={formData.dataSource}
              onChange={(value) => setFormData({ ...formData, dataSource: value })}
              placeholder="Where did this info come from?"
            />
          </div>

          <Button type="submit" loading={loading} className="w-full">
            {submitLabel}
          </Button>
        </div>

        {/* Spa Selection - Middle column */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 h-[600px] flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Compatible Spas</h3>
              <p className="text-sm text-gray-500">Select which spas this part fits</p>
            </div>
            <div className="flex-1 overflow-hidden">
              {formData.isUniversal ? (
                <div className="flex items-center justify-center h-full text-gray-500 p-4 text-center">
                  <div>
                    <p className="font-medium">Universal Part</p>
                    <p className="text-sm">This part fits all spas - no selection needed</p>
                  </div>
                </div>
              ) : (
                <SpaSelector selectedIds={selectedSpaIds} onChange={setSelectedSpaIds} />
              )}
            </div>
          </div>
        </div>

        {/* Comp Suggestions - Right column */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-lg border border-gray-200 h-[600px]">
            <CompSidebar
              selectedSpaIds={selectedSpaIds}
              categoryId={formData.categoryId}
              onCompSelect={handleCompSelect}
              onQuickview={setQuickviewCompId}
            />
          </div>
        </div>
      </div>

      <CompQuickview
        compId={quickviewCompId}
        isOpen={!!quickviewCompId}
        onClose={() => setQuickviewCompId(null)}
        onSelectAll={handleSpasSelect}
      />
    </form>
  );
}
