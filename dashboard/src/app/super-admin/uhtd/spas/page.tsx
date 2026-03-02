'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Table } from '@/components/ui/Table';
import { SearchInput } from '@/components/ui/SearchInput';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { MergeModal } from '@/components/uhtd/MergeModal';

interface Brand {
  id: string;
  name: string;
}

interface SpaModel {
  id: string;
  name: string;
  year: number;
  brandId: string;
  brandName: string;
  modelLineId: string;
  modelLineName: string;
  seatingCapacity: number | null;
  jetCount: number | null;
  isDiscontinued: boolean;
}

export default function SpasPage() {
  const [spas, setSpas] = useState<SpaModel[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);

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
    async function fetchSpas() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (search) params.append('search', search);
        if (selectedBrand) params.append('brandId', selectedBrand);
        if (selectedYear) params.append('year', selectedYear);

        const res = await fetch(`/api/dashboard/super-admin/scdb/spa-models?${params}`);
        const data = await res.json();
        if (data.success) {
          setSpas(data.data || []);
          setTotal(data.pagination?.total || 0);
        }
      } catch (err) {
        console.error('Error fetching spas:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchSpas();
  }, [page, pageSize, search, selectedBrand, selectedYear]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === spas.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(spas.map(s => s.id));
    }
  };

  const handleMergeComplete = () => {
    setSelectedIds([]);
    setPage(1);
  };

  const columns = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={spas.length > 0 && selectedIds.length === spas.length}
          onChange={toggleSelectAll}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
      className: 'w-10',
      render: (spa: any) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(spa.id)}
          onChange={(e) => {
            e.stopPropagation();
            toggleSelection(spa.id);
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
    },
    {
      key: 'name',
      header: 'Model',
      render: (spa: any) => (
        <div>
          <div className="font-medium text-gray-900">{spa.name}</div>
          <div className="text-xs text-gray-500">{spa.year}</div>
        </div>
      ),
    },
    {
      key: 'brand',
      header: 'Brand',
      render: (spa: any) => (
        <Link
          href={`/super-admin/uhtd/brands/${spa.brandId}`}
          className="text-blue-600 hover:text-blue-800"
        >
          {spa.brandName}
        </Link>
      ),
    },
    {
      key: 'modelLine',
      header: 'Model Line',
      render: (spa: any) => (
        <Link
          href={`/super-admin/uhtd/model-lines/${spa.modelLineId}`}
          className="text-blue-600 hover:text-blue-800"
        >
          {spa.modelLineName}
        </Link>
      ),
    },
    {
      key: 'specs',
      header: 'Specs',
      render: (spa: any) => (
        <div className="text-sm text-gray-600">
          {spa.seatingCapacity && <span>{spa.seatingCapacity} seats</span>}
          {spa.seatingCapacity && spa.jetCount && <span className="mx-1">•</span>}
          {spa.jetCount && <span>{spa.jetCount} jets</span>}
          {!spa.seatingCapacity && !spa.jetCount && <span className="text-gray-400">-</span>}
        </div>
      ),
    },
    {
      key: 'status',
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
          href={`/super-admin/uhtd/spas/${spa.id}`}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View
        </Link>
      ),
    },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 40 }, (_, i) => currentYear - i);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Spa Models</h1>
          <p className="text-sm text-gray-500 mt-1">Browse all spa models across all brands</p>
        </div>
        <Link href="/super-admin/uhtd/spas/new">
          <Button>Add Spa</Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-4">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search spas..."
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
            <select
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Years</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <div className="ml-auto text-sm text-gray-500">
              {total.toLocaleString()} spas total
            </div>
          </div>
        </div>

        {selectedIds.length >= 2 && (
          <div className="p-4 border-b border-gray-200 bg-blue-50 flex items-center justify-between">
            <span className="text-sm text-blue-700">
              {selectedIds.length} spa{selectedIds.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setSelectedIds([])}>
                Clear Selection
              </Button>
              <Button size="sm" onClick={() => setShowMergeModal(true)}>
                Merge Selected
              </Button>
            </div>
          </div>
        )}

        <Table
          columns={columns}
          data={spas}
          keyField="id"
          loading={loading}
          emptyMessage="No spa models found"
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

      <MergeModal
        isOpen={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        entityType="spa"
        selectedItems={spas.filter(s => selectedIds.includes(s.id)).map(s => ({ id: s.id, name: `${s.brandName} ${s.modelLineName} ${s.name} (${s.year})` }))}
        onMergeComplete={handleMergeComplete}
      />
    </div>
  );
}
