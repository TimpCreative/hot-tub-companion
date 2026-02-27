'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';

interface SpaModel {
  id: string;
  modelName: string;
  modelYear: number;
  brandId: string;
  brandName: string;
  modelLineId: string;
  modelLineName: string;
  seatingCapacity: number | null;
  jetCount: number | null;
  dimensions: string | null;
  waterCapacity: string | null;
  dryWeight: string | null;
  isDiscontinued: boolean;
  notes: string | null;
  dataSource: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CompatiblePart {
  id: string;
  partId: string;
  partName: string;
  partNumber: string | null;
  categoryName: string | null;
  status: 'pending' | 'confirmed';
  fitNotes: string | null;
  quantityRequired: number | null;
}

export default function SpaDetailPage() {
  const params = useParams();
  const router = useRouter();
  const spaId = params.id as string;

  const [spa, setSpa] = useState<SpaModel | null>(null);
  const [parts, setParts] = useState<CompatiblePart[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [spaRes, partsRes] = await Promise.all([
          fetch(`/api/dashboard/super-admin/scdb/spa-models/${spaId}`),
          fetch(`/api/dashboard/super-admin/comps/spa/${spaId}/parts`),
        ]);

        const spaData = await spaRes.json();
        const partsData = await partsRes.json();

        if (spaData.success) setSpa(spaData.data);
        if (partsData.success) setParts(partsData.data || []);
      } catch (err) {
        console.error('Error fetching spa data:', err);
      } finally {
        setLoading(false);
      }
    }

    if (spaId) fetchData();
  }, [spaId]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this spa model? This cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/dashboard/super-admin/scdb/spa-models/${spaId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        router.push('/super-admin/uhtd/spas');
      } else {
        alert(data.error?.message || 'Failed to delete spa model');
      }
    } catch (err) {
      console.error('Error deleting spa:', err);
      alert('Failed to delete spa model');
    } finally {
      setDeleting(false);
    }
  };

  const partColumns = [
    {
      key: 'part',
      header: 'Part',
      render: (part: any) => (
        <div>
          <Link
            href={`/super-admin/uhtd/parts/${part.partId}`}
            className="font-medium text-blue-600 hover:text-blue-800"
          >
            {part.partName}
          </Link>
          {part.partNumber && (
            <div className="text-xs text-gray-500">{part.partNumber}</div>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (part: any) => (
        <span className="text-gray-600">{part.categoryName || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (part: any) => (
        <Badge variant={part.status === 'confirmed' ? 'success' : 'warning'}>
          {part.status}
        </Badge>
      ),
    },
    {
      key: 'fitNotes',
      header: 'Notes',
      render: (part: any) => (
        <span className="text-sm text-gray-500">{part.fitNotes || '-'}</span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (!spa) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Spa not found</h2>
        <Link href="/super-admin/uhtd/spas" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
          Back to Spas
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/super-admin/uhtd/spas" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Spas
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{spa.modelName}</h1>
            <Badge variant={spa.isDiscontinued ? 'warning' : 'success'}>
              {spa.isDiscontinued ? 'Discontinued' : 'Current'}
            </Badge>
          </div>
          <p className="text-gray-500 mt-1">
            <Link href={`/super-admin/uhtd/brands/${spa.brandId}`} className="hover:text-blue-600">
              {spa.brandName}
            </Link>
            {' • '}
            <Link href={`/super-admin/uhtd/model-lines/${spa.modelLineId}`} className="hover:text-blue-600">
              {spa.modelLineName}
            </Link>
            {' • '}{spa.modelYear}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleDelete} loading={deleting}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Specifications</h3>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
            <div>
              <dt className="text-sm text-gray-500">Seating Capacity</dt>
              <dd className="text-sm font-medium text-gray-900">{spa.seatingCapacity || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Jet Count</dt>
              <dd className="text-sm font-medium text-gray-900">{spa.jetCount || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Dimensions</dt>
              <dd className="text-sm font-medium text-gray-900">{spa.dimensions || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Water Capacity</dt>
              <dd className="text-sm font-medium text-gray-900">{spa.waterCapacity || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Dry Weight</dt>
              <dd className="text-sm font-medium text-gray-900">{spa.dryWeight || '-'}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Data Source</dt>
              <dd className="text-sm font-medium text-gray-900">{spa.dataSource || '-'}</dd>
            </div>
          </dl>

          {spa.notes && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Notes</h4>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{spa.notes}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Details</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-gray-500">ID</dt>
              <dd className="text-sm font-mono text-gray-900 truncate">{spa.id}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Created</dt>
              <dd className="text-sm text-gray-900">{new Date(spa.createdAt).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Last Updated</dt>
              <dd className="text-sm text-gray-900">{new Date(spa.updatedAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Compatible Parts ({parts.length})</h3>
          <p className="text-sm text-gray-500 mt-1">Parts that fit this spa model</p>
        </div>

        <Table
          columns={partColumns}
          data={parts}
          keyField="id"
          emptyMessage="No compatible parts found"
        />
      </div>
    </div>
  );
}
