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

type TabType = 'brands' | 'model-lines' | 'spas' | 'parts' | 'compatibility' | 'consumer-spa';

const TABS: { key: TabType; label: string }[] = [
  { key: 'brands', label: 'Brands' },
  { key: 'model-lines', label: 'Model Lines' },
  { key: 'spas', label: 'Spas' },
  { key: 'parts', label: 'Parts' },
  { key: 'compatibility', label: 'Compatibility' },
  { key: 'consumer-spa', label: 'Consumer spa requests' },
];

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

  async function fetchData() {
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

      {activeTab === 'consumer-spa' ? (
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
