'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';

type ShopifyCollection = {
  shopify_collection_id: string;
  collection_type: string;
  handle: string | null;
  title: string | null;
};

type CategoryMapRow = {
  shopify_collection_id: string;
  pcdb_category_id: string;
  collection_title: string | null;
  category_display_name: string | null;
};

type PcdbCategory = { id: string; name: string; display_name: string };

export default function AdminProductCategoriesPage() {
  const { getIdToken } = useAuth();
  const api = useMemo(() => createTenantApiClient(async () => await getIdToken()), [getIdToken]);

  const [collections, setCollections] = useState<ShopifyCollection[]>([]);
  const [maps, setMaps] = useState<CategoryMapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catSearch, setCatSearch] = useState('');
  const [catHits, setCatHits] = useState<PcdbCategory[]>([]);
  const [allCats, setAllCats] = useState<PcdbCategory[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const mapByCollectionId = useMemo(() => {
    const m = new Map<string, CategoryMapRow>();
    for (const row of maps) m.set(row.shopify_collection_id, row);
    return m;
  }, [maps]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [cRes, mRes] = await Promise.all([
        api.get('/admin/shopify-collections') as Promise<any>,
        api.get('/admin/collection-category-maps') as Promise<any>,
      ]);
      if (cRes?.success) setCollections(cRes.data || []);
      else setError(cRes?.error?.message || 'Failed to load collections');
      if (mRes?.success) setMaps(mRes.data || []);
    } catch (err: any) {
      setError(err?.error?.message || err?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    (async () => {
      try {
        const res = (await api.get('/admin/pcdb-categories')) as any;
        if (res?.success) setAllCats(res.data || []);
      } catch {
        setAllCats([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    const q = catSearch.trim();
    if (q.length < 1) {
      setCatHits([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await api.get(`/admin/pcdb-categories?q=${encodeURIComponent(q)}`) as any;
        if (!cancelled && res?.success) setCatHits(res.data || []);
      } catch {
        if (!cancelled) setCatHits([]);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [api, catSearch]);

  const setMapping = useCallback(
    async (shopifyCollectionId: string, pcdbCategoryId: string) => {
      setSavingId(shopifyCollectionId);
      setError(null);
      try {
        const enc = encodeURIComponent(shopifyCollectionId);
        const res = await api.put(`/admin/collection-category-maps/${enc}`, {
          pcdbCategoryId,
        }) as any;
        if (!res?.success) {
          setError(res?.error?.message || 'Save failed');
          return;
        }
        await load();
      } catch (err: any) {
        setError(err?.error?.message || err?.message || 'Save failed');
      } finally {
        setSavingId(null);
      }
    },
    [api]
  );

  const clearMapping = useCallback(
    async (shopifyCollectionId: string) => {
      setSavingId(shopifyCollectionId);
      setError(null);
      try {
        const enc = encodeURIComponent(shopifyCollectionId);
        const res = await api.delete(`/admin/collection-category-maps/${enc}`) as any;
        if (!res?.success && res?.error?.code !== 'NOT_FOUND') {
          setError(res?.error?.message || 'Delete failed');
          return;
        }
        await load();
      } catch (err: any) {
        setError(err?.error?.message || err?.message || 'Delete failed');
      } finally {
        setSavingId(null);
      }
    },
    [api]
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">Shopify collections → UHTD categories</h2>
        <p className="text-sm text-gray-500 mt-1">
          Map each Shopify collection to a PCdb category to boost part suggestions when products sit in that collection.{' '}
          <Link href="/admin/products" className="text-blue-600 hover:text-blue-800 underline-offset-2 hover:underline">
            Back to products
          </Link>
        </p>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>}

      <div className="card rounded-lg p-4 mb-4">
        <div className="text-xs font-medium text-gray-600 mb-1">Search UHTD category to assign</div>
        <SearchInput
          value={catSearch}
          onChange={setCatSearch}
          placeholder="Type category name…"
        />
        {catHits.length > 0 && (
          <ul className="mt-2 border border-gray-200 rounded-md max-h-40 overflow-auto text-sm">
            {catHits.map((c) => (
              <li key={c.id} className="px-3 py-2 border-b border-gray-100 last:border-0">
                <span className="font-medium text-gray-900">{c.display_name}</span>
                <span className="text-gray-500 ml-2">({c.name})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Collection</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Handle</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">UHTD category</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Loading…
                </td>
              </tr>
            ) : collections.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No collections synced yet. Run catalog sync from Settings → POS Integration.
                </td>
              </tr>
            ) : (
              collections.map((c) => {
                const mapped = mapByCollectionId.get(c.shopify_collection_id);
                return (
                  <tr key={c.shopify_collection_id}>
                    <td className="px-4 py-3 text-gray-900">
                      {c.title || `Collection ${c.shopify_collection_id}`}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">{c.handle || '—'}</td>
                    <td className="px-4 py-3">
                      {mapped ? (
                        <span className="text-gray-900">{mapped.category_display_name || mapped.collection_title}</span>
                      ) : (
                        <span className="text-gray-400">Not mapped</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <select
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm max-w-[220px]"
                        value={mapped?.pcdb_category_id || ''}
                        disabled={!!savingId}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v) void setMapping(c.shopify_collection_id, v);
                        }}
                      >
                        <option value="">Assign category…</option>
                        {allCats.map((h) => (
                          <option key={h.id} value={h.id}>
                            {h.display_name}
                          </option>
                        ))}
                        {mapped &&
                          !catHits.some((h) => h.id === mapped.pcdb_category_id) && (
                            <option value={mapped.pcdb_category_id}>
                              {mapped.category_display_name || mapped.pcdb_category_id}
                            </option>
                          )}
                      </select>
                      {mapped && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={savingId === c.shopify_collection_id}
                          onClick={() => void clearMapping(c.shopify_collection_id)}
                        >
                          Clear
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
