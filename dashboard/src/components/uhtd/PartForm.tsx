'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
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
  upc: string;
  ean: string;
  name: string;
  manufacturer: string;
  isOem: boolean;
  isUniversal: boolean;
  displayImportance: number;
  imageUrl: string;
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
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedSpaIds, setSelectedSpaIds] = useState<string[]>(initialSpaIds);
  const [quickviewCompId, setQuickviewCompId] = useState<string | null>(null);

  const [formData, setFormData] = useState<PartFormData>({
    categoryId: initialData?.categoryId || '',
    partNumber: initialData?.partNumber || '',
    upc: initialData?.upc || '',
    ean: initialData?.ean || '',
    name: initialData?.name || '',
    manufacturer: initialData?.manufacturer || '',
    isOem: initialData?.isOem ?? false,
    isUniversal: initialData?.isUniversal ?? false,
    displayImportance: initialData?.displayImportance ?? 2,
    imageUrl: initialData?.imageUrl || '',
    notes: initialData?.notes || '',
    dataSource: initialData?.dataSource || '',
  });

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/dashboard/super-admin/pcdb/categories');
        const data = await res.json();
        if (data.success) {
          setCategories(data.data || []);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    }
    fetchCategories();
  }, []);

  const handleCompSelect = async (compId: string) => {
    try {
      const res = await fetch(`/api/dashboard/super-admin/comps/${compId}/spas`);
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
                <label className="block text-sm font-medium text-gray-700 mb-1">UPC</label>
                <input
                  type="text"
                  value={formData.upc}
                  onChange={(e) => setFormData({ ...formData, upc: e.target.value })}
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Source</label>
              <input
                type="text"
                value={formData.dataSource}
                onChange={(e) => setFormData({ ...formData, dataSource: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Where did this info come from?"
              />
            </div>
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
        onSelectAll={handleCompSelect}
      />
    </form>
  );
}
