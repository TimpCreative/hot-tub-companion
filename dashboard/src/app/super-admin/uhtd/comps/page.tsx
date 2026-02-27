'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Pagination } from '@/components/ui/Pagination';

interface Comp {
  id: string;
  name: string;
  description: string | null;
  spaCount?: number;
  partCount?: number;
  createdAt: string;
}

export default function CompsListPage() {
  const router = useRouter();
  const [comps, setComps] = useState<Comp[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    async function fetchComps() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (search) params.append('search', search);

        const res = await fetch(`/api/dashboard/super-admin/comps?${params}`);
        const data = await res.json();
        if (data.success) {
          setComps(data.data || []);
          setTotal(data.pagination?.total || 0);
        }
      } catch (err) {
        console.error('Error fetching comps:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchComps();
  }, [page, pageSize, search]);

  const columns = [
    {
      key: 'id',
      header: 'Comp ID',
      render: (comp: Comp) => (
        <span className="font-mono text-sm text-blue-600">{comp.id}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (comp: Comp) => (
        <div>
          <div className="font-medium text-gray-900">{comp.name}</div>
          {comp.description && (
            <div className="text-xs text-gray-500 truncate max-w-xs">{comp.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'spaCount',
      header: 'Spas',
      className: 'text-center',
      render: (comp: Comp) => (
        <span className="text-gray-600">{comp.spaCount || 0}</span>
      ),
    },
    {
      key: 'partCount',
      header: 'Parts (computed)',
      className: 'text-center',
      render: (comp: Comp) => (
        <span className="text-gray-600">{comp.partCount || 0}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (comp: Comp) => (
        <span className="text-gray-500 text-sm">
          {new Date(comp.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (comp: Comp) => (
        <Link
          href={`/super-admin/uhtd/comps/${encodeURIComponent(comp.id)}`}
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
          <h1 className="text-2xl font-semibold text-gray-900">Compatibility Groups</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage named groups of spas for efficient data entry
          </p>
        </div>
        <Link href="/super-admin/uhtd/comps/new">
          <Button>+ Create Comp</Button>
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by Comp ID or name..."
            className="max-w-sm"
          />
        </div>

        <Table
          columns={columns}
          data={comps}
          keyField="id"
          loading={loading}
          onRowClick={(comp) => router.push(`/super-admin/uhtd/comps/${encodeURIComponent(comp.id)}`)}
          emptyMessage="No compatibility groups found. Create your first Comp to start organizing spa groups."
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
        <h3 className="font-medium text-blue-900 mb-2">About Compatibility Groups (Comps)</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            • <strong>Comps</strong> are named groups of spas that share compatible parts
          </li>
          <li>
            • When adding parts, you can quickly select all spas in a Comp
          </li>
          <li>
            • Part membership is <strong>computed dynamically</strong> based on spa compatibility records
          </li>
          <li>
            • Comp IDs use a human-readable format like <code className="bg-blue-100 px-1 rounded">COMP-JAC-FILT-001</code>
          </li>
        </ul>
      </div>
    </div>
  );
}
