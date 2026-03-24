'use client';

import { useEffect, useState } from 'react';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { Table } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';

interface AuditLog {
  id: string;
  tableName: string;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  changedBy: string | null;
  createdAt: string;
}

interface AuditStats {
  total: number;
  last24Hours: number;
  byTable: { table: string; count: number }[];
  byAction: { action: string; count: number }[];
  topContributors: { user: string; count: number }[];
}

export default function AuditLogPage() {
  const fetchWithAuth = useSuperAdminFetch();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState({
    tableName: '',
    action: '',
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetchWithAuth('/api/dashboard/super-admin/audit/stats');
        const data = await res.json();
        if (data.success) setStats(data.data);
      } catch (err) {
        console.error('Error fetching stats:', err);
      }
    }
    fetchStats();
  }, [fetchWithAuth]);

  useEffect(() => {
    async function fetchLogs() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
        });
        if (filters.tableName) params.append('tableName', filters.tableName);
        if (filters.action) params.append('action', filters.action);

        const res = await fetchWithAuth(`/api/dashboard/super-admin/audit/logs?${params}`);
        const data = await res.json();
        if (data.success) {
          setLogs(data.data || []);
          setTotal(data.pagination?.total || 0);
        }
      } catch (err) {
        console.error('Error fetching logs:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchLogs();
  }, [page, pageSize, filters, fetchWithAuth]);

  const actionVariant = (action: string) => {
    switch (action) {
      case 'INSERT':
        return 'success';
      case 'UPDATE':
        return 'info';
      case 'DELETE':
        return 'danger';
      default:
        return 'default';
    }
  };

  const columns = [
    {
      key: 'createdAt',
      header: 'Time',
      render: (log: any) => (
        <span className="text-sm text-gray-500">
          {new Date(log.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      render: (log: any) => <Badge variant={actionVariant(log.action)}>{log.action}</Badge>,
    },
    {
      key: 'tableName',
      header: 'Table',
      render: (log: any) => (
        <span className="font-mono text-sm text-gray-700">{log.tableName}</span>
      ),
    },
    {
      key: 'recordId',
      header: 'Record ID',
      render: (log: any) => (
        <span className="font-mono text-xs text-gray-500 truncate max-w-32 block">
          {log.recordId}
        </span>
      ),
    },
    {
      key: 'changedBy',
      header: 'Changed By',
      render: (log: any) => (
        <span className="text-sm text-gray-600">{log.changedBy || 'System'}</span>
      ),
    },
    {
      key: 'expand',
      header: '',
      className: 'w-20',
      render: (log: any) => (
        <button
          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          {expandedId === log.id ? 'Hide' : 'Details'}
        </button>
      ),
    },
  ];

  const tables = [...new Set(logs.map((l) => l.tableName))].sort();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Audit Log</h1>
        <p className="text-sm text-gray-500 mt-1">Track all changes to UHTD data</p>
      </div>

      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total.toLocaleString()}</div>
            <div className="text-sm text-gray-500">Total Changes</div>
          </div>
          <div className="card rounded-lg p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.last24Hours}</div>
            <div className="text-sm text-gray-500">Last 24 Hours</div>
          </div>
          <div className="card rounded-lg p-4">
            <div className="text-2xl font-bold text-green-600">
              {stats.byAction.find((a) => a.action === 'INSERT')?.count || 0}
            </div>
            <div className="text-sm text-gray-500">Inserts</div>
          </div>
          <div className="card rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-600">
              {stats.byAction.find((a) => a.action === 'UPDATE')?.count || 0}
            </div>
            <div className="text-sm text-gray-500">Updates</div>
          </div>
        </div>
      )}

      <div className="card rounded-lg">
        <div className="p-4 border-b border-gray-200 flex gap-4">
          <select
            value={filters.tableName}
            onChange={(e) => {
              setFilters({ ...filters, tableName: e.target.value });
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Tables</option>
            {tables.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={filters.action}
            onChange={(e) => {
              setFilters({ ...filters, action: e.target.value });
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Actions</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
          </select>
        </div>

        <Table
          columns={columns}
          data={logs}
          keyField="id"
          loading={loading}
          emptyMessage="No audit logs found."
        />

        {expandedId && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            {(() => {
              const log = logs.find((l) => l.id === expandedId);
              if (!log) return null;
              return (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">Old Values</h4>
                    <pre className="text-xs bg-card p-3 rounded border overflow-auto max-h-64">
                      {log.oldValues ? JSON.stringify(log.oldValues, null, 2) : 'N/A'}
                    </pre>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-700 mb-2">New Values</h4>
                    <pre className="text-xs bg-card p-3 rounded border overflow-auto max-h-64">
                      {log.newValues ? JSON.stringify(log.newValues, null, 2) : 'N/A'}
                    </pre>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

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
