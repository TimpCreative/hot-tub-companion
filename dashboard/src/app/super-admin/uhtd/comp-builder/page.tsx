'use client';

import { useState, useEffect, useCallback } from 'react';
import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/Button';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';

interface Part {
  id: string;
  name: string;
  partNumber: string | null;
  categoryName?: string;
  categoryDisplayName?: string;
}

interface SpaModel {
  id: string;
  name: string;
  year: number;
  brandName?: string;
  modelLineName?: string;
}

export default function CompBuilderPage() {
  const fetchWithAuth = useSuperAdminFetch();
  const [partsSearch, setPartsSearch] = useState('');
  const [spasSearch, setSpasSearch] = useState('');
  const [parts, setParts] = useState<Part[]>([]);
  const [spas, setSpas] = useState<SpaModel[]>([]);
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(new Set());
  const [selectedSpaIds, setSelectedSpaIds] = useState<Set<string>>(new Set());
  const [partsLoading, setPartsLoading] = useState(false);
  const [spasLoading, setSpasLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchParts = useCallback(async () => {
    if (partsSearch.length < 2) {
      setParts([]);
      return;
    }
    setPartsLoading(true);
    try {
      const params = new URLSearchParams({
        q: partsSearch,
        limit: '100',
      });
      const res = await fetchWithAuth(
        `/api/dashboard/super-admin/pcdb/parts/search?${params}`
      );
      const data = await res.json();
      if (data.success) {
        setParts(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching parts:', err);
      setError('Failed to search parts');
    } finally {
      setPartsLoading(false);
    }
  }, [partsSearch, fetchWithAuth]);

  const fetchSpas = useCallback(async () => {
    if (spasSearch.length < 2) {
      setSpas([]);
      return;
    }
    setSpasLoading(true);
    try {
      const params = new URLSearchParams({
        q: spasSearch,
        limit: '100',
      });
      const res = await fetchWithAuth(
        `/api/dashboard/super-admin/scdb/spa-models/search?${params}`
      );
      const data = await res.json();
      if (data.success) {
        setSpas(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching spas:', err);
      setError('Failed to search spas');
    } finally {
      setSpasLoading(false);
    }
  }, [spasSearch, fetchWithAuth]);

  useEffect(() => {
    fetchParts();
  }, [fetchParts]);

  useEffect(() => {
    fetchSpas();
  }, [fetchSpas]);

  const handlePartToggle = (id: string) => {
    setSelectedPartIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSpaToggle = (id: string) => {
    setSelectedSpaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePartsSelectAll = () => {
    const visibleIds = new Set(parts.map((p) => p.id));
    setSelectedPartIds((prev) => new Set([...prev, ...visibleIds]));
  };

  const handlePartsClear = () => {
    const visibleIds = new Set(parts.map((p) => p.id));
    setSelectedPartIds((prev) => new Set([...prev].filter((id) => !visibleIds.has(id))));
  };

  const handleSpasSelectAll = () => {
    const visibleIds = new Set(spas.map((s) => s.id));
    setSelectedSpaIds((prev) => new Set([...prev, ...visibleIds]));
  };

  const handleSpasClear = () => {
    const visibleIds = new Set(spas.map((s) => s.id));
    setSelectedSpaIds((prev) => new Set([...prev].filter((id) => !visibleIds.has(id))));
  };

  const handleConnect = async () => {
    const partIds = Array.from(selectedPartIds);
    const spaIds = Array.from(selectedSpaIds);
    if (partIds.length === 0 || spaIds.length === 0) return;

    setConnectLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetchWithAuth('/api/dashboard/super-admin/comps/compatibility/matrix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          partIds,
          spaModelIds: spaIds,
          status: 'pending',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to create compatibilities');
      }

      const { created, skipped } = data.data || {};
      setSuccess(
        `Created ${created} compatibilities${skipped > 0 ? `, ${skipped} skipped (already exist)` : ''}`
      );
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    } finally {
      setConnectLoading(false);
    }
  };

  const partCount = selectedPartIds.size;
  const spaCount = selectedSpaIds.size;
  const connectionCount = partCount * spaCount;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Comp Builder</h1>
      <p className="text-sm text-gray-500 mt-1">
        Select parts and spas to bulk-create compatibility links
      </p>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-6">
        {/* Parts Column */}
        <div className="flex flex-col card rounded-lg min-h-[400px]">
          <div className="p-4 border-b border-gray-200 space-y-3">
            <h3 className="font-medium text-gray-900">Parts</h3>
            <SearchInput
              value={partsSearch}
              onChange={setPartsSearch}
              placeholder="Search parts (min 2 chars)..."
              debounceMs={300}
              className="w-full"
            />
            <div className="flex gap-2">
              <button
                onClick={handlePartsSelectAll}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={handlePartsClear}
                className="text-xs text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 min-h-[200px]">
            {partsSearch.length < 2 ? (
              <div className="text-center py-8 text-gray-500">
                Type 2+ characters to search parts
              </div>
            ) : partsLoading ? (
              <div className="flex justify-center py-8">
                <svg
                  className="animate-spin h-6 w-6 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            ) : parts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No parts found</div>
            ) : (
              <div className="space-y-1">
                {parts.map((part) => (
                  <label
                    key={part.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      selectedPartIds.has(part.id)
                        ? 'bg-blue-50 hover:bg-blue-100'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedPartIds.has(part.id)}
                      onChange={() => handlePartToggle(part.id)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {part.name}
                      </div>
                      <div className="text-xs text-gray-500">
                        {part.partNumber || '-'} • {part.categoryDisplayName || part.categoryName || '-'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Spas Column */}
        <div className="flex flex-col card rounded-lg min-h-[400px]">
          <div className="p-4 border-b border-gray-200 space-y-3">
            <h3 className="font-medium text-gray-900">Spas</h3>
            <SearchInput
              value={spasSearch}
              onChange={setSpasSearch}
              placeholder="Search spas (min 2 chars)..."
              debounceMs={300}
              className="w-full"
            />
            <div className="flex gap-2">
              <button
                onClick={handleSpasSelectAll}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Select All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={handleSpasClear}
                className="text-xs text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 min-h-[200px]">
            {spasSearch.length < 2 ? (
              <div className="text-center py-8 text-gray-500">
                Type 2+ characters to search spas
              </div>
            ) : spasLoading ? (
              <div className="flex justify-center py-8">
                <svg
                  className="animate-spin h-6 w-6 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
            ) : spas.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No spas found</div>
            ) : (
              <div className="space-y-1">
                {spas.map((spa) => (
                  <label
                    key={spa.id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                      selectedSpaIds.has(spa.id)
                        ? 'bg-blue-50 hover:bg-blue-100'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedSpaIds.has(spa.id)}
                      onChange={() => handleSpaToggle(spa.id)}
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
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="mt-6 flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
        <span className="text-sm text-gray-600">
          {partCount} parts × {spaCount} spas = {connectionCount} connections
        </span>
        <Button
          onClick={handleConnect}
          disabled={partCount === 0 || spaCount === 0 || connectLoading}
          loading={connectLoading}
        >
          Connect
        </Button>
      </div>
    </div>
  );
}
