'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';

interface ModelLine {
  id: string;
  brandId: string;
  brandName?: string;
  name: string;
  description: string | null;
  isActive: boolean;
  dataSource: string | null;
  createdAt: string;
}

interface SpaModel {
  id: string;
  name: string;
  year: number;
  jetCount: number | null;
  seatingCapacity: number | null;
  isDiscontinued: boolean;
}

export default function ModelLineDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [modelLine, setModelLine] = useState<ModelLine | null>(null);
  const [spaModels, setSpaModels] = useState<SpaModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [modelLineRes, spasRes] = await Promise.all([
          fetch(`/api/dashboard/super-admin/scdb/model-lines/${params.id}`),
          fetch(`/api/dashboard/super-admin/scdb/spa-models?modelLineId=${params.id}`),
        ]);

        const modelLineData = await modelLineRes.json();
        const spasData = await spasRes.json();

        if (modelLineData.success) {
          setModelLine(modelLineData.data);
        }
        if (spasData.success) {
          setSpaModels(spasData.data || []);
        }
      } catch (err) {
        console.error('Error fetching model line:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this model line? This will also delete all spa models under it.')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/dashboard/super-admin/scdb/model-lines/${params.id}`, {
        method: 'DELETE',
      });

      if (res.ok && modelLine) {
        router.push(`/super-admin/uhtd/brands/${modelLine.brandId}`);
      }
    } catch (err) {
      console.error('Error deleting model line:', err);
    } finally {
      setDeleting(false);
    }
  };

  const spaModelColumns = [
    {
      key: 'name',
      header: 'Model',
      render: (spa: any) => <span className="font-medium">{spa.name}</span>,
    },
    { key: 'year', header: 'Year' },
    { key: 'seatingCapacity', header: 'Seats', render: (spa: any) => spa.seatingCapacity || '-' },
    { key: 'jetCount', header: 'Jets', render: (spa: any) => spa.jetCount || '-' },
    {
      key: 'isDiscontinued',
      header: 'Status',
      render: (spa: any) => (
        <Badge variant={spa.isDiscontinued ? 'warning' : 'success'}>
          {spa.isDiscontinued ? 'Discontinued' : 'Current'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (spa: any) => (
        <Link
          href={`/super-admin/uhtd/models/${spa.id}`}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View
        </Link>
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

  if (!modelLine) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Model Line not found</h2>
        <Link href="/super-admin/uhtd/brands" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
          Back to Brands
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href={`/super-admin/uhtd/brands/${modelLine.brandId}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to {modelLine.brandName || 'Brand'}
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="text-sm text-gray-500 mb-1">{modelLine.brandName}</div>
          <h1 className="text-2xl font-semibold text-gray-900">{modelLine.name}</h1>
          {modelLine.description && (
            <p className="text-gray-600 mt-1">{modelLine.description}</p>
          )}
          <div className="mt-2">
            <Badge variant={modelLine.isActive ? 'success' : 'default'}>
              {modelLine.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/super-admin/uhtd/model-lines/${modelLine.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Delete
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 mb-6 p-6">
        <h3 className="text-sm font-medium text-gray-500 mb-4">Details</h3>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs text-gray-500">Data Source</dt>
            <dd className="text-sm text-gray-900">{modelLine.dataSource || 'Not specified'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Total Models</dt>
            <dd className="text-sm text-gray-900">{spaModels.length}</dd>
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Spa Models</h3>
          <Link href={`/super-admin/uhtd/model-lines/${modelLine.id}/models/new`}>
            <Button size="sm">+ Add Spa Model</Button>
          </Link>
        </div>

        <Table
          columns={spaModelColumns}
          data={spaModels}
          keyField="id"
          onRowClick={(spa) => router.push(`/super-admin/uhtd/models/${spa.id}`)}
          emptyMessage="No spa models yet. Add individual model-year records."
        />
      </div>
    </div>
  );
}
