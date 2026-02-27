'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';

interface Brand {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  isActive: boolean;
  dataSource: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ModelLine {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export default function BrandDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [modelLines, setModelLines] = useState<ModelLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const [brandRes, modelLinesRes] = await Promise.all([
          fetch(`/api/dashboard/super-admin/scdb/brands/${params.id}`),
          fetch(`/api/dashboard/super-admin/scdb/model-lines?brandId=${params.id}`),
        ]);

        const brandData = await brandRes.json();
        const modelLinesData = await modelLinesRes.json();

        if (brandData.success) {
          setBrand(brandData.data);
        }
        if (modelLinesData.success) {
          setModelLines(modelLinesData.data || []);
        }
      } catch (err) {
        console.error('Error fetching brand:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this brand? This will also delete all model lines and spa models under it.')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/dashboard/super-admin/scdb/brands/${params.id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/super-admin/uhtd/brands');
      }
    } catch (err) {
      console.error('Error deleting brand:', err);
    } finally {
      setDeleting(false);
    }
  };

  const modelLineColumns = [
    {
      key: 'name',
      header: 'Name',
      render: (ml: ModelLine) => <span className="font-medium">{ml.name}</span>,
    },
    {
      key: 'description',
      header: 'Description',
      render: (ml: ModelLine) => (
        <span className="text-gray-500 text-sm truncate max-w-[300px] block">
          {ml.description || '-'}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (ml: ModelLine) => (
        <Badge variant={ml.isActive ? 'success' : 'default'}>
          {ml.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (ml: ModelLine) => (
        <Link
          href={`/super-admin/uhtd/model-lines/${ml.id}`}
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

  if (!brand) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Brand not found</h2>
        <Link href="/super-admin/uhtd/brands" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
          Back to Brands
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/super-admin/uhtd/brands" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Brands
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} className="w-16 h-16 object-contain rounded-lg border border-gray-200" />
          ) : (
            <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-2xl text-gray-400">
              {brand.name.charAt(0)}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{brand.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={brand.isActive ? 'success' : 'default'}>
                {brand.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {brand.websiteUrl && (
                <a
                  href={brand.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Visit Website →
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/super-admin/uhtd/brands/${brand.id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Details</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-gray-500">Data Source</dt>
              <dd className="text-sm text-gray-900">{brand.dataSource || 'Not specified'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Created</dt>
              <dd className="text-sm text-gray-900">
                {new Date(brand.createdAt).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Last Updated</dt>
              <dd className="text-sm text-gray-900">
                {new Date(brand.updatedAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-500 mb-4">Summary</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs text-gray-500">Model Lines</dt>
              <dd className="text-2xl font-bold text-gray-900">{modelLines.length}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Model Lines</h3>
          <Link href={`/super-admin/uhtd/model-lines/new?brandId=${brand.id}`}>
            <Button size="sm">+ Add Model Line</Button>
          </Link>
        </div>

        <Table
          columns={modelLineColumns}
          data={modelLines}
          keyField="id"
          onRowClick={(ml) => router.push(`/super-admin/uhtd/model-lines/${ml.id}`)}
          emptyMessage="No model lines yet. Add the first model line for this brand."
        />
      </div>
    </div>
  );
}
