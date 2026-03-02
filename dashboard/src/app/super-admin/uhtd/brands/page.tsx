'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { MergeModal } from '@/components/uhtd/MergeModal';

interface Brand {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function BrandsListPage() {
  const router = useRouter();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showMergeModal, setShowMergeModal] = useState(false);

  useEffect(() => {
    async function fetchBrands() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (search) params.append('search', search);

        const res = await fetch(`/api/dashboard/super-admin/scdb/brands?${params}`);
        const data = await res.json();
        if (data.success) {
          setBrands(data.data || []);
          setTotal(data.pagination?.total || 0);
        }
      } catch (err) {
        console.error('Error fetching brands:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchBrands();
  }, [page, pageSize, search]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === brands.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(brands.map(b => b.id));
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
          checked={brands.length > 0 && selectedIds.length === brands.length}
          onChange={toggleSelectAll}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
      className: 'w-10',
      render: (brand: any) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(brand.id)}
          onChange={(e) => {
            e.stopPropagation();
            toggleSelection(brand.id);
          }}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (brand: any) => (
        <div className="flex items-center gap-3">
          {brand.logoUrl ? (
            <img src={brand.logoUrl} alt={brand.name} className="w-8 h-8 object-contain" />
          ) : (
            <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
              {brand.name.charAt(0)}
            </div>
          )}
          <span className="font-medium">{brand.name}</span>
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (brand: any) => (
        <Badge variant={brand.isActive ? 'success' : 'default'}>
          {brand.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      key: 'websiteUrl',
      header: 'Website',
      render: (brand: any) =>
        brand.websiteUrl ? (
          <a
            href={brand.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 text-sm truncate max-w-[200px] block"
          >
            {brand.websiteUrl.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          <span className="text-gray-400">-</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (brand: any) => (
        <Link
          href={`/super-admin/uhtd/brands/${brand.id}`}
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
          <h1 className="text-2xl font-semibold text-gray-900">Brands</h1>
          <p className="text-sm text-gray-500 mt-1">Manage hot tub manufacturers</p>
        </div>
        <Link href="/super-admin/uhtd/brands/new">
          <Button>+ Add Brand</Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search brands..."
            className="max-w-sm"
          />
        </div>

        {selectedIds.length >= 2 && (
          <div className="p-4 border-b border-gray-200 bg-blue-50 flex items-center justify-between">
            <span className="text-sm text-blue-700">
              {selectedIds.length} brand{selectedIds.length !== 1 ? 's' : ''} selected
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
          data={brands}
          keyField="id"
          loading={loading}
          onRowClick={(brand) => router.push(`/super-admin/uhtd/brands/${brand.id}`)}
          emptyMessage="No brands found. Add your first brand to get started."
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

      <MergeModal
        isOpen={showMergeModal}
        onClose={() => setShowMergeModal(false)}
        entityType="brand"
        selectedItems={brands.filter(b => selectedIds.includes(b.id)).map(b => ({ id: b.id, name: b.name }))}
        onMergeComplete={handleMergeComplete}
      />
    </div>
  );
}
