'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';

interface PendingCompatibility {
  id: string;
  partId: string;
  spaModelId: string;
  status: string;
  fitNotes: string | null;
  dataSource: string | null;
  createdAt: string;
  part: {
    name: string;
    partNumber: string | null;
  };
  spaModel: {
    modelName: string;
    modelYear: number;
    brandName: string | null;
    modelLineName: string | null;
  };
}

interface ReviewStats {
  pending: number;
  confirmed: number;
  topPendingParts: { partName: string; pendingCount: number }[];
}

type ConsumerSuggestionRow = Record<string, unknown> & {
  id: string;
  status: string;
  payload: Record<string, unknown>;
  createdAt: string;
  user: { email?: string; firstName?: string; lastName?: string };
  tenantName?: string;
};

type TabType =
  | 'brands'
  | 'model-lines'
  | 'spas'
  | 'parts'
  | 'compatibility'
  | 'consumer-spa'
  | 'shopify-imports';

const TABS: { key: TabType; label: string }[] = [
  { key: 'brands', label: 'Brands' },
  { key: 'model-lines', label: 'Model Lines' },
  { key: 'spas', label: 'Spas' },
  { key: 'parts', label: 'Parts' },
  { key: 'compatibility', label: 'Compatibility' },
  { key: 'shopify-imports', label: 'Shopify part imports' },
  { key: 'consumer-spa', label: 'Consumer spa requests' },
];

type ShopifyReviewRow = {
  id: string;
  pos_product_id: string;
  tenant_id: string;
  draft_payload: Record<string, unknown>;
  source_super_admin_email: string | null;
  created_at: string;
  pos_title: string | null;
  pos_sku: string | null;
  pos_barcode: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
};

function PlaceholderTab({ entityType }: { entityType: string }) {
  return (
    <div className="card rounded-lg p-8 text-center">
      <div className="text-gray-400 mb-4">
        <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">No Pending {entityType}</h3>
      <p className="text-sm text-gray-500 max-w-md mx-auto">
        Imported {entityType.toLowerCase()} that need review will appear here.
        Use the Import page to bulk import data.
      </p>
    </div>
  );
}

export default function ReviewQueuePage() {
  const fetchWithAuth = useSuperAdminFetch();
  const [activeTab, setActiveTab] = useState<TabType>('compatibility');
  const [items, setItems] = useState<PendingCompatibility[]>([]);
  const [consumerItems, setConsumerItems] = useState<ConsumerSuggestionRow[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [shopifyItems, setShopifyItems] = useState<ShopifyReviewRow[]>([]);
  const [shopifyApproveId, setShopifyApproveId] = useState<string | null>(null);
  const [shopifyApproveMode, setShopifyApproveMode] = useState<'link' | 'create'>('link');
  const [shopifyLinkPartId, setShopifyLinkPartId] = useState('');
  const [shopifyCreateCategoryId, setShopifyCreateCategoryId] = useState('');
  const [shopifyCreateName, setShopifyCreateName] = useState('');
  const [shopifyCategories, setShopifyCategories] = useState<{ id: string; displayName: string }[]>([]);

  async function fetchData() {
    if (activeTab === 'shopify-imports') {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        const res = await fetchWithAuth(
          `/api/dashboard/super-admin/uhtd/shopify-map/review-queue?${params}`
        );
        const data = await res.json();
        if (data.success && data.data) {
          setShopifyItems(data.data.rows || []);
          setTotal(data.data.pagination?.total || 0);
        } else {
          setShopifyItems([]);
          setTotal(0);
        }
      } catch (err) {
        console.error('Error fetching Shopify import review queue:', err);
        setShopifyItems([]);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (activeTab === 'consumer-spa') {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          status: 'pending',
        });
        const res = await fetchWithAuth(`/api/dashboard/super-admin/consumer-uhtd-suggestions?${params}`);
        const data = await res.json();
        if (data.success && data.data) {
          setConsumerItems(data.data.suggestions || []);
          setTotal(data.data.pagination?.total || 0);
        } else {
          setConsumerItems([]);
          setTotal(0);
        }
      } catch (err) {
        console.error('Error fetching consumer suggestions:', err);
      } finally {
        setLoading(false);
      }
      return;
    }

    if (activeTab !== 'compatibility') {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });

      const [itemsRes, statsRes] = await Promise.all([
        fetchWithAuth(`/api/dashboard/super-admin/audit/review/pending?${params}`),
        fetchWithAuth('/api/dashboard/super-admin/audit/review/stats'),
      ]);

      const itemsData = await itemsRes.json();
      const statsData = await statsRes.json();

      if (itemsData.success) {
        setItems(itemsData.data || []);
        setTotal(itemsData.pagination?.total || 0);
      }
      if (statsData.success) setStats(statsData.data);
    } catch (err) {
      console.error('Error fetching review queue:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [page, pageSize, activeTab, fetchWithAuth]);

  useEffect(() => {
    setSelectedIds([]);
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'shopify-imports') return;
    (async () => {
      try {
        const res = await fetchWithAuth('/api/dashboard/super-admin/pcdb/categories');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setShopifyCategories(
            data.data.map((c: { id: string; displayName: string; name: string }) => ({
              id: c.id,
              displayName: c.displayName || c.name,
            }))
          );
        }
      } catch {
        /* ignore */
      }
    })();
  }, [activeTab, fetchWithAuth]);

  const openShopifyApprove = (row: ShopifyReviewRow) => {
    setShopifyApproveId(row.id);
    setShopifyApproveMode('link');
    setShopifyLinkPartId('');
    setShopifyCreateCategoryId('');
    setShopifyCreateName(row.pos_title || '');
  };

  const submitShopifyApprove = async () => {
    if (!shopifyApproveId) return;
    if (shopifyApproveMode === 'link' && !shopifyLinkPartId.trim()) {
      alert('Enter part UUID');
      return;
    }
    if (shopifyApproveMode === 'create' && (!shopifyCreateCategoryId || !shopifyCreateName.trim())) {
      alert('Category and name required');
      return;
    }
    setProcessing(true);
    try {
      const body =
        shopifyApproveMode === 'link'
          ? { mode: 'link' as const, uhtdPartId: shopifyLinkPartId.trim() }
          : {
              mode: 'create' as const,
              part: {
                categoryId: shopifyCreateCategoryId,
                name: shopifyCreateName.trim(),
              },
            };
      const res = await fetchWithAuth(
        `/api/dashboard/super-admin/uhtd/shopify-map/review-queue/${shopifyApproveId}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error?.message || 'Approve failed');
        return;
      }
      setShopifyApproveId(null);
      fetchData();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Approve failed');
    } finally {
      setProcessing(false);
    }
  };

  const dismissShopifyReview = async (id: string) => {
    if (!confirm('Dismiss this item without mapping?')) return;
    setProcessing(true);
    try {
      await fetchWithAuth(`/api/dashboard/super-admin/uhtd/shopify-map/review-queue/${id}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((i) => i.id));
    }
  };

  const handleConfirmSelected = async () => {
    if (selectedIds.length === 0) return;
    setProcessing(true);
    try {
      await fetchWithAuth('/api/dashboard/super-admin/audit/review/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      console.error('Error confirming:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleConsumerDecision = async (id: string, status: 'approved' | 'rejected') => {
    const reviewNotes =
      status === 'rejected'
        ? typeof window !== 'undefined'
          ? window.prompt('Optional notes for the team (not shown to customer):') || undefined
          : undefined
        : undefined;
    setProcessing(true);
    try {
      await fetchWithAuth(`/api/dashboard/super-admin/consumer-uhtd-suggestions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, reviewNotes }),
      });
      fetchData();
    } catch (err) {
      console.error('Error updating suggestion:', err);
    } finally {
      setProcessing(false);
    }
  };

  const handleRejectSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to reject ${selectedIds.length} compatibility records? This cannot be undone.`)) return;

    setProcessing(true);
    try {
      await fetchWithAuth('/api/dashboard/super-admin/audit/review/reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: selectedIds }),
      });
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      console.error('Error rejecting:', err);
    } finally {
      setProcessing(false);
    }
  };

  const columns = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={selectedIds.length === items.length && items.length > 0}
          onChange={handleSelectAll}
          className="rounded border-gray-300"
        />
      ),
      className: 'w-10',
      render: (item: any) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(item.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedIds([...selectedIds, item.id]);
            } else {
              setSelectedIds(selectedIds.filter((id: string) => id !== item.id));
            }
          }}
          className="rounded border-gray-300"
        />
      ),
    },
    {
      key: 'part',
      header: 'Part',
      render: (item: any) => (
        <div>
          <Link
            href={`/super-admin/uhtd/parts/${item.partId}`}
            className="font-medium text-blue-600 hover:text-blue-800"
          >
            {item.part.name}
          </Link>
          {item.part.partNumber && (
            <div className="text-xs text-gray-500">{item.part.partNumber}</div>
          )}
        </div>
      ),
    },
    {
      key: 'spa',
      header: 'Spa Model',
      render: (item: any) => (
        <div>
          <div className="font-medium text-gray-900">{item.spaModel.modelName}</div>
          <div className="text-xs text-gray-500">
            {item.spaModel.brandName} - {item.spaModel.modelLineName} ({item.spaModel.modelYear})
          </div>
        </div>
      ),
    },
    {
      key: 'dataSource',
      header: 'Source',
      render: (item: any) => (
        <span className="text-sm text-gray-600">{item.dataSource || '-'}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Added',
      render: (item: any) => (
        <span className="text-sm text-gray-500">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Review Queue</h1>
          <p className="text-sm text-gray-500 mt-1">
            Review imported data and consumer-submitted spa details before they affect UHTD
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex gap-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'shopify-imports' ? (
        <>
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            Items sent from <strong>Map from Shopify</strong> with <em>Send for review</em>. Approve by linking
            or creating a part (same as Save &amp; Publish). Dismiss to close without mapping.
          </div>
          <div className="rounded-lg card">
            <Table
              columns={[
                {
                  key: 'tenant',
                  header: 'Retailer',
                  render: (row: ShopifyReviewRow) => (
                    <span className="text-sm text-gray-900">{row.tenant_name || row.tenant_slug || '—'}</span>
                  ),
                },
                {
                  key: 'product',
                  header: 'POS product',
                  render: (row: ShopifyReviewRow) => (
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">{row.pos_title || '—'}</div>
                      <div className="text-xs text-gray-500">
                        SKU {row.pos_sku || '—'} · {row.pos_barcode || '—'}
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'from',
                  header: 'Submitted by',
                  render: (row: ShopifyReviewRow) => (
                    <span className="text-xs text-gray-600">{row.source_super_admin_email || '—'}</span>
                  ),
                },
                {
                  key: 'when',
                  header: 'Queued',
                  render: (row: ShopifyReviewRow) => (
                    <span className="text-xs text-gray-500">{new Date(row.created_at).toLocaleString()}</span>
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  render: (row: ShopifyReviewRow) => (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={processing}
                        onClick={() => dismissShopifyReview(row.id)}
                      >
                        Dismiss
                      </Button>
                      <Button size="sm" loading={processing} onClick={() => openShopifyApprove(row)}>
                        Approve…
                      </Button>
                      <Link
                        href={`/super-admin/uhtd/map-from-shopify`}
                        className="text-xs text-blue-600 self-center"
                      >
                        Inbox
                      </Link>
                    </div>
                  ),
                },
              ]}
              data={shopifyItems}
              keyField="id"
              loading={loading}
              emptyMessage="No open Shopify import review items."
            />
            {total > 0 && (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            )}
          </div>

          {shopifyApproveId && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              role="dialog"
              aria-modal="true"
            >
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Approve import</h3>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={shopifyApproveMode === 'link'}
                      onChange={() => setShopifyApproveMode('link')}
                    />
                    Link part
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={shopifyApproveMode === 'create'}
                      onChange={() => setShopifyApproveMode('create')}
                    />
                    Create part
                  </label>
                </div>
                {shopifyApproveMode === 'link' ? (
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="UHTD part UUID"
                    value={shopifyLinkPartId}
                    onChange={(e) => setShopifyLinkPartId(e.target.value)}
                  />
                ) : (
                  <div className="space-y-2">
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={shopifyCreateCategoryId}
                      onChange={(e) => setShopifyCreateCategoryId(e.target.value)}
                    >
                      <option value="">Category…</option>
                      {shopifyCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.displayName}
                        </option>
                      ))}
                    </select>
                    <input
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      placeholder="Part name"
                      value={shopifyCreateName}
                      onChange={(e) => setShopifyCreateName(e.target.value)}
                    />
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" size="sm" onClick={() => setShopifyApproveId(null)}>
                    Cancel
                  </Button>
                  <Button size="sm" loading={processing} onClick={submitShopifyApprove}>
                    Approve &amp; map
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : activeTab === 'consumer-spa' ? (
        <>
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>Does not add to SCdb.</strong> Approve/reject here is only for workflow tracking. After
            approval, create or map the spa in UHTD manually, then update the customer&apos;s spa profile with
            the correct <code className="rounded bg-amber-100 px-1">uhtd_spa_model_id</code>.
          </div>
          <div className="rounded-lg card">
            <Table
              columns={[
                {
                  key: 'tenant',
                  header: 'Retailer',
                  render: (row: ConsumerSuggestionRow) => (
                    <span className="text-sm text-gray-900">{row.tenantName || '—'}</span>
                  ),
                },
                {
                  key: 'user',
                  header: 'Customer',
                  render: (row: ConsumerSuggestionRow) => (
                    <span className="text-sm text-gray-700">{row.user?.email || '—'}</span>
                  ),
                },
                {
                  key: 'details',
                  header: 'Submitted details',
                  render: (row: ConsumerSuggestionRow) => {
                    const p = row.payload;
                    const ce = p.customerEntered;
                    const customerLines: string[] = [];
                    if (ce && typeof ce === 'object') {
                      const o = ce as Record<string, unknown>;
                      if (typeof o.brand === 'string' && o.brand.trim()) customerLines.push(`Brand: ${o.brand.trim()}`);
                      if (typeof o.model === 'string' && o.model.trim()) customerLines.push(`Model: ${o.model.trim()}`);
                      if (typeof o.modelLine === 'string' && o.modelLine.trim())
                        customerLines.push(`Line: ${o.modelLine.trim()}`);
                    }
                    const usageMonths =
                      Array.isArray(p.usageMonths) && p.usageMonths.every((m) => typeof m === 'number')
                        ? (p.usageMonths as number[]).join(', ')
                        : null;
                    return (
                      <div className="text-sm text-gray-800 space-y-0.5 max-w-md">
                        <div>
                          <span className="font-medium">Make:</span> {String(p.brandName ?? '—')}
                        </div>
                        <div>
                          <span className="font-medium">Model:</span> {String(p.modelName ?? '—')}
                          {p.year != null && Number(p.year) > 0 ? ` (${p.year})` : ''}
                        </div>
                        {p.modelLineName ? (
                          <div>
                            <span className="font-medium">Line:</span> {String(p.modelLineName)}
                          </div>
                        ) : null}
                        {customerLines.length > 0 ? (
                          <div className="mt-2 pt-2 border-t border-gray-200 text-gray-700">
                            <div className="font-medium text-gray-900">As typed by customer</div>
                            {customerLines.map((line, idx) => (
                              <div key={idx}>{line}</div>
                            ))}
                          </div>
                        ) : null}
                        {usageMonths ? (
                          <div>
                            <span className="font-medium">Usage months:</span> {usageMonths}
                          </div>
                        ) : null}
                        {typeof p.winterStrategy === 'string' && p.winterStrategy ? (
                          <div>
                            <span className="font-medium">Winter strategy:</span> {p.winterStrategy}
                          </div>
                        ) : null}
                        <div>
                          <span className="font-medium">Sanitizer:</span> {String(p.sanitizationSystem ?? '—')}
                          {p.customSanitizerNote
                            ? ` — ${String(p.customSanitizerNote)}`
                            : null}
                        </div>
                      </div>
                    );
                  },
                },
                {
                  key: 'when',
                  header: 'Submitted',
                  render: (row: ConsumerSuggestionRow) => (
                    <span className="text-xs text-gray-500">
                      {new Date(row.createdAt).toLocaleString()}
                    </span>
                  ),
                },
                {
                  key: 'actions',
                  header: '',
                  render: (row: ConsumerSuggestionRow) => (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={processing}
                        onClick={() => handleConsumerDecision(row.id, 'rejected')}
                      >
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        loading={processing}
                        onClick={() => handleConsumerDecision(row.id, 'approved')}
                      >
                        Mark reviewed
                      </Button>
                    </div>
                  ),
                },
              ]}
              data={consumerItems}
              keyField="id"
              loading={loading}
              emptyMessage="No pending consumer spa requests."
            />
            {total > 0 && (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            )}
          </div>
        </>
      ) : activeTab === 'compatibility' ? (
        <>
          {stats && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
                <div className="text-sm text-yellow-600">Pending Review</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-700">{stats.confirmed}</div>
                <div className="text-sm text-green-600">Confirmed</div>
              </div>
              <div className="card rounded-lg p-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Top Pending Parts</div>
                {stats.topPendingParts.length > 0 ? (
                  <ul className="text-xs text-gray-600 space-y-1">
                    {stats.topPendingParts.slice(0, 3).map((p, i) => (
                      <li key={i}>
                        {p.partName}: <span className="font-medium">{p.pendingCount}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-gray-400">No pending items</p>
                )}
              </div>
            </div>
          )}

          <div className="card rounded-lg">
            {selectedIds.length > 0 && (
              <div className="p-4 border-b border-gray-200 bg-blue-50 flex items-center justify-between">
                <span className="text-sm text-blue-700">
                  {selectedIds.length} item{selectedIds.length !== 1 ? 's' : ''} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleRejectSelected}
                    loading={processing}
                  >
                    Reject
                  </Button>
                  <Button size="sm" onClick={handleConfirmSelected} loading={processing}>
                    Confirm
                  </Button>
                </div>
              </div>
            )}

            <Table
              columns={columns}
              data={items}
              keyField="id"
              loading={loading}
              emptyMessage="No pending items to review. All compatibility records have been confirmed."
            />

            {total > 0 && (
              <Pagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            )}
          </div>

          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Review Workflow</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Pending</strong> items are created during bulk imports or manual entry</li>
              <li>• <strong>Confirm</strong> to verify that a part truly fits the spa model</li>
              <li>• <strong>Reject</strong> to remove incorrect compatibility records</li>
              <li>• Confirmed records appear in the mobile app for customers</li>
            </ul>
          </div>
        </>
      ) : (
        <PlaceholderTab entityType={TABS.find((t) => t.key === activeTab)?.label || ''} />
      )}
    </div>
  );
}
