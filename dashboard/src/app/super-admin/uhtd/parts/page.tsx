'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';

interface Part {
  id: string;
  name: string;
  partNumber: string | null;
  manufacturer: string | null;
  categoryDisplayName?: string;
  isOem: boolean;
  isUniversal: boolean;
}

interface Category {
  id: string;
  name: string;
  displayName: string;
}

export default function PartsListPage() {
  const router = useRouter();
  const fetchWithAuth = useSuperAdminFetch();
  const [parts, setParts] = useState<Part[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetchWithAuth('/api/dashboard/super-admin/pcdb/categories');
        const data = await res.json();
        if (data.success) {
          setCategories(data.data || []);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    }
    fetchCategories();
  }, [fetchWithAuth]);

  useEffect(() => {
    async function fetchParts() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (search) params.append('search', search);
        if (selectedCategory) params.append('categoryId', selectedCategory);

        const res = await fetchWithAuth(`/api/dashboard/super-admin/pcdb/parts?${params}`);
        const data = await res.json();
        if (data.success) {
          setParts(data.data || []);
          setTotal(data.pagination?.total || 0);
        }
      } catch (err) {
        console.error('Error fetching parts:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchParts();
  }, [page, pageSize, search, selectedCategory, fetchWithAuth]);

  const columns = [
    {
      key: 'name',
      header: 'Part',
      render: (part: any) => (
        <div>
          <div className="font-medium text-gray-900">{part.name}</div>
          {part.partNumber && <div className="text-xs text-gray-500">{part.partNumber}</div>}
        </div>
      ),
    },
    {
      key: 'categoryDisplayName',
      header: 'Category',
      render: (part: any) => (
        <span className="text-gray-600">{part.categoryDisplayName || '-'}</span>
      ),
    },
    {
      key: 'manufacturer',
      header: 'Manufacturer',
      render: (part: any) => <span className="text-gray-600">{part.manufacturer || '-'}</span>,
    },
    {
      key: 'badges',
      header: 'Type',
      render: (part: any) => (
        <div className="flex gap-1">
          {part.isOem && <Badge variant="info" size="sm">OEM</Badge>}
          {part.isUniversal && <Badge variant="success" size="sm">Universal</Badge>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (part: any) => (
        <Link
          href={`/super-admin/uhtd/parts/${part.id}`}
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
          <h1 className="text-2xl font-semibold text-gray-900">Parts</h1>
          <p className="text-sm text-gray-500 mt-1">Manage parts catalog</p>
        </div>
        <Link href="/super-admin/uhtd/parts/new">
          <Button>+ Add Part</Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex gap-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search parts..."
            className="flex-1 max-w-sm"
          />
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.displayName}
              </option>
            ))}
          </select>
        </div>

        <Table
          columns={columns}
          data={parts}
          keyField="id"
          loading={loading}
          onRowClick={(part) => router.push(`/super-admin/uhtd/parts/${part.id}`)}
          emptyMessage="No parts found. Add your first part to get started."
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
    </div>
  );
}
