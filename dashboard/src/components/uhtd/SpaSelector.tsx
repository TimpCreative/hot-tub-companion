'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SearchInput } from '../ui/SearchInput';

interface SpaModel {
  id: string;
  name: string;
  year: number;
  brandName?: string;
  modelLineName?: string;
}

interface SpaSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  brandId?: string;
  modelLineId?: string;
}

export function SpaSelector({ selectedIds, onChange, brandId, modelLineId }: SpaSelectorProps) {
  const [spas, setSpas] = useState<SpaModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const fetchSpas = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (brandId) params.append('brandId', brandId);
      if (modelLineId) params.append('modelLineId', modelLineId);
      if (search) params.append('search', search);

      const res = await fetch(`/api/dashboard/super-admin/scdb/spa-models?${params}`);
      const data = await res.json();
      if (data.success) {
        setSpas(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching spas:', err);
    } finally {
      setLoading(false);
    }
  }, [brandId, modelLineId, search]);

  useEffect(() => {
    fetchSpas();
  }, [fetchSpas]);

  const handleToggle = (spaId: string) => {
    if (selectedIds.includes(spaId)) {
      onChange(selectedIds.filter((id) => id !== spaId));
    } else {
      onChange([...selectedIds, spaId]);
    }
  };

  const handleSelectAll = () => {
    const visibleIds = filteredSpas.map((s) => s.id);
    const newSelected = new Set([...selectedIds, ...visibleIds]);
    onChange(Array.from(newSelected));
  };

  const handleDeselectAll = () => {
    const visibleIds = new Set(filteredSpas.map((s) => s.id));
    onChange(selectedIds.filter((id) => !visibleIds.has(id)));
  };

  const filteredSpas = showSelectedOnly
    ? spas.filter((s) => selectedIds.includes(s.id))
    : spas;

  const selectedSet = new Set(selectedIds);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 space-y-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search spas..."
          className="w-full"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showSelectedOnly}
              onChange={(e) => setShowSelectedOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Show selected only
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleSelectAll}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Select all visible
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={handleDeselectAll}
              className="text-xs text-gray-600 hover:text-gray-800"
            >
              Deselect all visible
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <svg className="animate-spin h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : filteredSpas.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {showSelectedOnly ? 'No spas selected' : 'No spas found'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredSpas.map((spa) => (
              <label
                key={spa.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  selectedSet.has(spa.id)
                    ? 'bg-blue-50 hover:bg-blue-100'
                    : 'hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(spa.id)}
                  onChange={() => handleToggle(spa.id)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {spa.brandName} {spa.name}
                  </div>
                  <div className="text-xs text-gray-500">
                    {spa.modelLineName} • {spa.year}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <div className="text-sm font-medium text-gray-700">
          {selectedIds.length} spa{selectedIds.length !== 1 ? 's' : ''} selected
        </div>
      </div>
    </div>
  );
}
