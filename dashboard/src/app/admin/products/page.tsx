'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';

type MappingStatus = 'unmapped' | 'auto_suggested' | 'confirmed';

type PosProductRow = Record<string, unknown> & {
  id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  price: number;
  inventory_quantity: number;
  mapping_status: MappingStatus;
  mapping_confidence: number | null;
  is_hidden: boolean;
  uhtd_part_id: string | null;
  pos_product_id: string;
  pos_variant_id: string | null;
  last_synced_at: string;
  updated_at: string;
};

interface Suggestion {
  partId: string;
  name: string;
  partNumber: string | null;
  manufacturer: string | null;
  score: number;
  reason: string;
}

function formatCents(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function statusBadge(status: MappingStatus) {
  switch (status) {
    case 'confirmed':
      return <Badge variant="success">Confirmed</Badge>;
    case 'auto_suggested':
      return <Badge variant="pending">Suggested</Badge>;
    default:
      return <Badge variant="default">Unmapped</Badge>;
  }
}

export default function AdminProductsPage() {
  const { getIdToken } = useAuth();
  const api = useMemo(() => createTenantApiClient(async () => await getIdToken()), [getIdToken]);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PosProductRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [mappingStatus, setMappingStatus] = useState<MappingStatus | 'all'>('all');
  const [isHidden, setIsHidden] = useState<'all' | 'true' | 'false'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  const [selected, setSelected] = useState<PosProductRow | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  async function fetchProducts() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set('search', search);
      if (mappingStatus !== 'all') params.set('mappingStatus', mappingStatus);
      if (isHidden !== 'all') params.set('isHidden', isHidden);

      const res = await api.get(`/admin/products?${params.toString()}`) as any;
      if (res?.success) {
        setRows(res.data || []);
        setTotal(res.pagination?.total || 0);
      } else {
        setError(res?.error?.message || 'Failed to load products');
      }
    } catch (err: any) {
      setError(err?.error?.message || err?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, search, mappingStatus, isHidden]);

  useEffect(() => {
    setPage(1);
  }, [search, mappingStatus, isHidden, pageSize]);

  async function loadSuggestions(productId: string) {
    setSuggestions([]);
    setSuggestionsLoading(true);
    try {
      const res = await api.get(`/admin/products/${productId}/uhtd-suggestions`) as any;
      if (res?.success) setSuggestions(res.data || []);
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function toggleHidden(row: PosProductRow) {
    setActionLoading(true);
    try {
      await api.put(`/admin/products/${row.id}/visibility`, { isHidden: !row.is_hidden });
      await fetchProducts();
      if (selected?.id === row.id) {
        setSelected({ ...row, is_hidden: !row.is_hidden });
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmMappingTo(partId: string, confidence?: number) {
    if (!selected) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/products/${selected.id}/map`, {
        uhtdPartId: partId,
        mappingConfidence: typeof confidence === 'number' ? confidence : null,
      });
      await fetchProducts();
      setSelected(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function clearMapping() {
    if (!selected) return;
    setActionLoading(true);
    try {
      await api.delete(`/admin/products/${selected.id}/map`);
      await fetchProducts();
      setSelected(null);
    } finally {
      setActionLoading(false);
    }
  }

  async function syncNow() {
    setActionLoading(true);
    try {
      await api.post('/admin/products/sync', {});
      await fetchProducts();
    } finally {
      setActionLoading(false);
    }
  }

  // Table component is generically typed but does not export Column type.
  // Keep columns typed broadly while ensuring runtime shape is correct.
  const columns = [
    {
      key: 'title',
      header: 'Product',
      render: (item: PosProductRow) => (
        <div className="min-w-[280px]">
          <div className="font-medium text-gray-900 truncate">{item.title}</div>
          <div className="text-xs text-gray-500">
            SKU: {item.sku || '—'} · Barcode: {item.barcode || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      render: (item: PosProductRow) => formatCents(item.price),
      className: 'w-32',
    },
    {
      key: 'inventory',
      header: 'Stock',
      render: (item: PosProductRow) => (
        <span className={item.inventory_quantity <= 0 ? 'text-red-600' : 'text-gray-900'}>
          {item.inventory_quantity}
        </span>
      ),
      className: 'w-24',
    },
    {
      key: 'mapping_status',
      header: 'Mapping',
      render: (item: PosProductRow) => (
        <div className="flex items-center gap-2">
          {statusBadge(item.mapping_status)}
          {typeof item.mapping_confidence === 'number' && (
            <span className="text-xs text-gray-500">{Math.round(item.mapping_confidence * 100)}%</span>
          )}
        </div>
      ),
      className: 'w-40',
    },
    {
      key: 'is_hidden',
      header: 'Visible',
      render: (item: PosProductRow) => (item.is_hidden ? <Badge variant="warning">Hidden</Badge> : <Badge variant="success">Shown</Badge>),
      className: 'w-28',
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Products</h2>
          <p className="text-sm text-gray-500 mt-1">Sync from POS and map to UHTD parts for compatibility filtering.</p>
        </div>
        <Button onClick={syncNow} loading={actionLoading} variant="secondary">
          Sync now
        </Button>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>}

      <div className="card rounded-lg p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <div className="text-xs font-medium text-gray-600 mb-1">Search</div>
            <SearchInput value={search} onChange={setSearch} placeholder="Search title, SKU, or barcode…" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Mapping status</div>
            <select
              value={mappingStatus}
              onChange={(e) => setMappingStatus(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="unmapped">Unmapped</option>
              <option value="auto_suggested">Suggested</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Visibility</div>
            <select
              value={isHidden}
              onChange={(e) => setIsHidden(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="false">Shown</option>
              <option value="true">Hidden</option>
            </select>
          </div>
        </div>
      </div>

      <Table<PosProductRow>
        columns={columns as any}
        data={rows}
        keyField="id"
        loading={loading}
        emptyMessage="No products found. Run a sync to import your catalog."
        onRowClick={(item) => {
          setSelected(item);
          loadSuggestions(item.id);
        }}
      />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Map Product: ${selected.title}` : 'Map Product'}
        size="xl"
        footer={
          selected ? (
            <div className="flex items-center justify-between">
              <Button
                variant="secondary"
                onClick={() => selected && toggleHidden(selected)}
                loading={actionLoading}
              >
                {selected.is_hidden ? 'Show product' : 'Hide product'}
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={clearMapping} loading={actionLoading}>
                  Clear mapping
                </Button>
                <Button onClick={() => setSelected(null)} variant="primary">
                  Close
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {!selected ? null : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-gray-500">SKU</div>
                <div className="font-mono">{selected.sku || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Barcode</div>
                <div className="font-mono">{selected.barcode || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Price</div>
                <div>{formatCents(selected.price)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Stock</div>
                <div>{selected.inventory_quantity}</div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">UHTD Suggestions</h3>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => selected && loadSuggestions(selected.id)}
                  loading={suggestionsLoading}
                >
                  Refresh
                </Button>
              </div>
              {suggestionsLoading ? (
                <div className="text-sm text-gray-500">Loading suggestions…</div>
              ) : suggestions.length === 0 ? (
                <div className="text-sm text-gray-500">
                  No suggestions found. Add UHTD parts (PCdb) and try again.
                </div>
              ) : (
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <div
                      key={s.partId}
                      className="flex items-center justify-between border border-gray-200 rounded-lg p-3"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{s.name}</div>
                        <div className="text-xs text-gray-500">
                          {s.partNumber ? `#${s.partNumber}` : '—'} · {s.manufacturer || '—'} · {s.reason} · {Math.round(s.score * 100)}%
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => confirmMappingTo(s.partId, s.score)}
                        loading={actionLoading}
                      >
                        Map
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
