'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

export default function ReviewQueuePage() {
  const [items, setItems] = useState<PendingCompatibility[]>([]);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [processing, setProcessing] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });

      const [itemsRes, statsRes] = await Promise.all([
        fetch(`/api/dashboard/super-admin/audit/review/pending?${params}`),
        fetch('/api/dashboard/super-admin/audit/review/stats'),
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
  }, [page, pageSize]);

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
      await fetch('/api/dashboard/super-admin/audit/review/confirm', {
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

  const handleRejectSelected = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to reject ${selectedIds.length} compatibility records? This cannot be undone.`)) return;

    setProcessing(true);
    try {
      await fetch('/api/dashboard/super-admin/audit/review/reject', {
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
            Confirm or reject pending part-spa compatibility records
          </p>
        </div>
      </div>

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
          <div className="bg-white border border-gray-200 rounded-lg p-4">
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

      <div className="bg-white rounded-lg border border-gray-200">
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
    </div>
  );
}
