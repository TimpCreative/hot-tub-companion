'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { SearchInput } from '@/components/ui/SearchInput';
import { Pagination } from '@/components/ui/Pagination';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface Brand {
  id: string;
  name: string;
}

interface ModelLine {
  id: string;
  name: string;
  brandId: string;
  brandName: string;
  description: string | null;
  isActive: boolean;
  spaCount?: number;
}

export default function ModelLinesPage() {
  const [modelLines, setModelLines] = useState<ModelLine[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');

  useEffect(() => {
    async function fetchBrands() {
      try {
        const res = await fetch('/api/dashboard/super-admin/scdb/brands');
        const data = await res.json();
        if (data.success) setBrands(data.data || []);
      } catch (err) {
        console.error('Error fetching brands:', err);
      }
    }
    fetchBrands();
  }, []);

  useEffect(() => {
    async function fetchModelLines() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (search) params.append('search', search);
        if (selectedBrand) params.append('brandId', selectedBrand);

        const res = await fetch(`/api/dashboard/super-admin/scdb/model-lines?${params}`);
        const data = await res.json();
        if (data.success) {
          setModelLines(data.data || []);
          setTotal(data.pagination?.total || data.data?.length || 0);
        }
      } catch (err) {
        console.error('Error fetching model lines:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchModelLines();
  }, [page, pageSize, search, selectedBrand]);

  const columns = [
    {
      key: 'name',
      header: 'Model Line',
      render: (ml: any) => (
        <div>
          <div className="font-medium text-gray-900">{ml.name}</div>
          {ml.description && (
            <div className="text-xs text-gray-500 truncate max-w-xs">{ml.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'brand',
      header: 'Brand',
      render: (ml: any) => (
        <Link
          href={`/super-admin/uhtd/brands/${ml.brandId}`}
          className="text-blue-600 hover:text-blue-800"
        >
          {ml.brandName}
        </Link>
      ),
    },
    {
      key: 'spaCount',
      header: 'Spas',
      className: 'text-center',
      render: (ml: any) => (
        <span className="text-gray-600">{ml.spaCount || 0}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (ml: any) => (
        <Badge variant={ml.isActive ? 'success' : 'default'}>
          {ml.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (ml: any) => (
        <Link
          href={`/super-admin/uhtd/model-lines/${ml.id}`}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View
        </Link>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Model Lines</h1>
          <p className="text-sm text-gray-500 mt-1">Manage model line series across all brands</p>
        </div>
        <Link href="/super-admin/uhtd/model-lines/new">
          <Button>Add Model Line</Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search model lines..."
              className="w-64"
            />
            <select
              value={selectedBrand}
              onChange={(e) => {
                setSelectedBrand(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Brands</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
            <div className="ml-auto text-sm text-gray-500">
              {total.toLocaleString()} model lines total
            </div>
          </div>
        </div>

        <Table
          columns={columns}
          data={modelLines}
          keyField="id"
          loading={loading}
          emptyMessage="No model lines found"
        />

        {total > pageSize && (
          <div className="p-4 border-t border-gray-200">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
