'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { useRouter } from 'next/navigation';
import { SearchInput } from '@/components/ui/SearchInput';

interface UhtdStats {
  scdb: {
    brands: number;
    modelLines: number;
    spaModels: number;
  };
  pcdb: {
    parts: number;
    categories: number;
  };
  compatibility: {
    comps: number;
    pending: number;
    confirmed: number;
  };
  recent: {
    brands: { id: string; name: string; createdAt: string }[];
    parts: { id: string; name: string; createdAt: string }[];
  };
}

interface SearchResult {
  id: string;
  name: string;
  type: 'brand' | 'part' | 'spa' | 'comp';
  partNumber?: string;
}

export default function UhtdOverviewPage() {
  const router = useRouter();
  const fetchWithAuth = useSuperAdminFetch();
  const [stats, setStats] = useState<UhtdStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetchWithAuth('/api/dashboard/super-admin/stats/uhtd');
        const data = await res.json();
        if (data.success) {
          setStats(data.data);
        }
      } catch (err) {
        console.error('Error fetching stats:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [fetchWithAuth]);

  const handleSearch = useCallback(async (term: string) => {
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await fetchWithAuth(`/api/dashboard/super-admin/stats/search?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      if (data.success) {
        setSearchResults([
          ...data.data.brands,
          ...data.data.parts,
          ...data.data.spas,
          ...data.data.comps,
        ]);
      }
    } catch (err) {
      console.error('Error searching:', err);
    } finally {
      setSearching(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, handleSearch]);

  const handleResultClick = (result: SearchResult) => {
    switch (result.type) {
      case 'brand':
        router.push(`/super-admin/uhtd/brands/${result.id}`);
        break;
      case 'part':
        router.push(`/super-admin/uhtd/parts/${result.id}`);
        break;
      case 'spa':
        router.push(`/super-admin/uhtd/models/${result.id}`);
        break;
      case 'comp':
        router.push(`/super-admin/uhtd/comps/${encodeURIComponent(result.id)}`);
        break;
    }
    setSearch('');
    setSearchResults([]);
  };

  const quickActions = [
    { label: 'Add Brand', href: '/super-admin/uhtd/brands/new', color: 'blue' },
    { label: 'Add Model Line', href: '/super-admin/uhtd/model-lines/new', color: 'cyan' },
    { label: 'Add Spa', href: '/super-admin/uhtd/spas/new', color: 'teal' },
    { label: 'Add Part', href: '/super-admin/uhtd/parts/new', color: 'green' },
    { label: 'Create Comp', href: '/super-admin/uhtd/comps/new', color: 'purple' },
    { label: 'Import CSV', href: '/super-admin/uhtd/import', color: 'orange' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">UHTD Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Universal Hot Tub Database management</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search brands, parts, spas, comps..."
          className="w-full"
        />
        {searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
            {searchResults.map((result, i) => (
              <button
                key={`${result.type}-${result.id}-${i}`}
                onClick={() => handleResultClick(result)}
                className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-0"
              >
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    result.type === 'brand'
                      ? 'bg-blue-100 text-blue-700'
                      : result.type === 'part'
                      ? 'bg-green-100 text-green-700'
                      : result.type === 'spa'
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-orange-100 text-orange-700'
                  }`}
                >
                  {result.type}
                </span>
                <span className="text-gray-900">{result.name}</span>
                {result.partNumber && (
                  <span className="text-xs text-gray-400">({result.partNumber})</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {quickActions.map((action) => {
          const colorClasses: Record<string, string> = {
            blue: 'border-blue-200 text-blue-600 hover:bg-blue-50',
            cyan: 'border-cyan-200 text-cyan-600 hover:bg-cyan-50',
            teal: 'border-teal-200 text-teal-600 hover:bg-teal-50',
            green: 'border-green-200 text-green-600 hover:bg-green-50',
            purple: 'border-purple-200 text-purple-600 hover:bg-purple-50',
            orange: 'border-orange-200 text-orange-600 hover:bg-orange-50',
          };
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`p-3 rounded-lg border-2 border-dashed text-center transition-colors ${
                colorClasses[action.color] || 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <span className="text-xl">+</span>
              <div className="font-medium text-sm mt-1">{action.label}</div>
            </Link>
          );
        })}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        {/* SCdb Stats */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Spa Configuration (SCdb)
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Brands</span>
              <span className="text-xl font-bold text-gray-900">{stats?.scdb.brands || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Model Lines</span>
              <span className="text-xl font-bold text-gray-900">{stats?.scdb.modelLines || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Spa Models</span>
              <span className="text-xl font-bold text-gray-900">{stats?.scdb.spaModels || 0}</span>
            </div>
          </div>
        </div>

        {/* PCdb Stats */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Parts Catalog (PCdb)
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Parts</span>
              <span className="text-xl font-bold text-gray-900">{stats?.pcdb.parts || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Categories</span>
              <span className="text-xl font-bold text-gray-900">{stats?.pcdb.categories || 0}</span>
            </div>
          </div>
        </div>

        {/* Compatibility Stats */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Compatibility
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Comp Groups</span>
              <span className="text-xl font-bold text-gray-900">{stats?.compatibility.comps || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Pending</span>
              <span className="text-xl font-bold text-yellow-600">{stats?.compatibility.pending || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Confirmed</span>
              <span className="text-xl font-bold text-green-600">{stats?.compatibility.confirmed || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Recent Brands
          </h3>
          {stats?.recent.brands && stats.recent.brands.length > 0 ? (
            <ul className="space-y-2">
              {stats.recent.brands.map((brand) => (
                <li key={brand.id} className="flex justify-between items-center">
                  <Link
                    href={`/super-admin/uhtd/brands/${brand.id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {brand.name}
                  </Link>
                  <span className="text-xs text-gray-400">
                    {new Date(brand.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm">No brands yet</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
            Recent Parts
          </h3>
          {stats?.recent.parts && stats.recent.parts.length > 0 ? (
            <ul className="space-y-2">
              {stats.recent.parts.map((part) => (
                <li key={part.id} className="flex justify-between items-center">
                  <Link
                    href={`/super-admin/uhtd/parts/${part.id}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    {part.name}
                  </Link>
                  <span className="text-xs text-gray-400">
                    {new Date(part.createdAt).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400 text-sm">No parts yet</p>
          )}
        </div>
      </div>

      {/* Review Queue Alert */}
      {stats?.compatibility.pending && stats.compatibility.pending > 0 && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
          <div>
            <h4 className="font-medium text-yellow-900">
              {stats.compatibility.pending} items pending review
            </h4>
            <p className="text-sm text-yellow-700">
              Review and confirm compatibility records before they appear in the app
            </p>
          </div>
          <Link
            href="/super-admin/uhtd/review-queue"
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            Review Now
          </Link>
        </div>
      )}
    </div>
  );
}
