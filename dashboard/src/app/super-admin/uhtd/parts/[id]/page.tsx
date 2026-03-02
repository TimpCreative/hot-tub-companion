'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { Button } from '@/components/ui/Button';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';

interface Part {
  id: string;
  name: string;
  partNumber: string | null;
  upc: string | null;
  ean: string | null;
  manufacturer: string | null;
  categoryId: string;
  categoryDisplayName?: string;
  isOem: boolean;
  isUniversal: boolean;
  displayImportance: number;
  imageUrl: string | null;
  notes: string | null;
  dataSource: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Compatibility {
  id: string;
  spaModelId: string;
  status: 'pending' | 'confirmed';
  spaModel?: {
    modelName: string;
    modelYear: number;
    brandName?: string;
    modelLineName?: string;
  };
}

export default function PartDetailPage() {
  const params = useParams();
  const router = useRouter();
  const fetchWithAuth = useSuperAdminFetch();
  const partId = params.id as string;

  const [part, setPart] = useState<Part | null>(null);
  const [compatibilities, setCompatibilities] = useState<Compatibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const [partRes, compatRes] = await Promise.all([
          fetchWithAuth(`/api/dashboard/super-admin/pcdb/parts/${partId}`),
          fetchWithAuth(`/api/dashboard/super-admin/comps/compatibility?partId=${partId}`),
        ]);

        const partData = await partRes.json();
        const compatData = await compatRes.json();

        if (partData.success) setPart(partData.data);
        if (compatData.success) setCompatibilities(compatData.data || []);
      } catch (err) {
        console.error('Error fetching part:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [partId, fetchWithAuth]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this part? This action cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetchWithAuth(`/api/dashboard/super-admin/pcdb/parts/${partId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/super-admin/uhtd/parts');
      }
    } catch (err) {
      console.error('Error deleting part:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusUpdate = async (compatId: string, newStatus: 'pending' | 'confirmed') => {
    try {
      await fetchWithAuth(`/api/dashboard/super-admin/comps/compatibility/${compatId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      setCompatibilities((prev) =>
        prev.map((c) => (c.id === compatId ? { ...c, status: newStatus } : c))
      );
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!part) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Part not found</h2>
        <Link href="/super-admin/uhtd/parts" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
          Back to Parts
        </Link>
      </div>
    );
  }

  const compatColumns = [
    {
      key: 'spa',
      header: 'Spa Model',
      render: (compat: any) => (
        <div>
          <div className="font-medium text-gray-900">
            {compat.spaModel?.modelName || 'Unknown'}
          </div>
          <div className="text-xs text-gray-500">
            {compat.spaModel?.brandName} - {compat.spaModel?.modelLineName} ({compat.spaModel?.modelYear})
          </div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (compat: any) => <StatusBadge status={compat.status} />,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-32',
      render: (compat: any) => (
        <div className="flex gap-2">
          {compat.status === 'pending' ? (
            <button
              onClick={() => handleStatusUpdate(compat.id, 'confirmed')}
              className="text-xs text-green-600 hover:text-green-800"
            >
              Confirm
            </button>
          ) : (
            <button
              onClick={() => handleStatusUpdate(compat.id, 'pending')}
              className="text-xs text-yellow-600 hover:text-yellow-800"
            >
              Mark Pending
            </button>
          )}
        </div>
      ),
    },
  ];

  const pendingCount = compatibilities.filter((c) => c.status === 'pending').length;
  const confirmedCount = compatibilities.filter((c) => c.status === 'confirmed').length;

  return (
    <div>
      <div className="mb-6">
        <Link href="/super-admin/uhtd/parts" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Parts
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{part.name}</h1>
            <div className="flex gap-2">
              {part.isOem && <Badge variant="info">OEM</Badge>}
              {part.isUniversal && <Badge variant="success">Universal</Badge>}
            </div>
          </div>
          {part.partNumber && (
            <p className="text-gray-500 mt-1">Part #: {part.partNumber}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/super-admin/uhtd/parts/${partId}/edit`}>
            <Button variant="secondary">Edit Part</Button>
          </Link>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
              Part Details
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">Category</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {part.categoryDisplayName || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Manufacturer</dt>
                <dd className="text-sm font-medium text-gray-900">{part.manufacturer || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">UPC</dt>
                <dd className="text-sm font-medium text-gray-900 font-mono">{part.upc || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">EAN</dt>
                <dd className="text-sm font-medium text-gray-900 font-mono">{part.ean || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Data Source</dt>
                <dd className="text-sm font-medium text-gray-900">{part.dataSource || '-'}</dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Created</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {new Date(part.createdAt).toLocaleDateString()}
                </dd>
              </div>
            </dl>
          </div>

          {part.notes && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-2">
                Notes
              </h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{part.notes}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">Compatible Spas</h3>
                <p className="text-sm text-gray-500">
                  {part.isUniversal
                    ? 'This is a universal part - fits all spas'
                    : `${compatibilities.length} spa models linked`}
                </p>
              </div>
              {!part.isUniversal && (
                <div className="flex gap-2 text-sm">
                  <span className="text-yellow-600">{pendingCount} pending</span>
                  <span className="text-gray-400">|</span>
                  <span className="text-green-600">{confirmedCount} confirmed</span>
                </div>
              )}
            </div>

            {part.isUniversal ? (
              <div className="p-8 text-center text-gray-500">
                Universal parts automatically fit all spa models in the database.
              </div>
            ) : (
              <Table
                columns={compatColumns}
                data={compatibilities}
                keyField="id"
                emptyMessage="No spa compatibility records. Edit this part to add compatible spas."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
