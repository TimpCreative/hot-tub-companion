'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Badge, StatusBadge } from '@/components/ui/Badge';

interface Comp {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CompSpa {
  id: string;
  spaModelId: string;
  spaModel?: {
    modelName: string;
    modelYear: number;
    brandName?: string;
    modelLineName?: string;
  };
}

interface ComputedPart {
  partId: string;
  partName: string;
  partNumber: string | null;
  categoryName: string | null;
  manufacturer: string | null;
  isOem: boolean;
  matchingSpas: number;
  totalSpas: number;
}

export default function CompDetailPage() {
  const params = useParams();
  const router = useRouter();
  const compId = decodeURIComponent(params.id as string);

  const [comp, setComp] = useState<Comp | null>(null);
  const [spas, setSpas] = useState<CompSpa[]>([]);
  const [parts, setParts] = useState<ComputedPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'spas' | 'parts'>('spas');

  useEffect(() => {
    async function fetchData() {
      try {
        const [compRes, spasRes, partsRes] = await Promise.all([
          fetch(`/api/dashboard/super-admin/comps/${encodeURIComponent(compId)}`),
          fetch(`/api/dashboard/super-admin/comps/${encodeURIComponent(compId)}/spas`),
          fetch(`/api/dashboard/super-admin/comps/${encodeURIComponent(compId)}/parts`),
        ]);

        const compData = await compRes.json();
        const spasData = await spasRes.json();
        const partsData = await partsRes.json();

        if (compData.success) setComp(compData.data);
        if (spasData.success) setSpas(spasData.data || []);
        if (partsData.success) setParts(partsData.data || []);
      } catch (err) {
        console.error('Error fetching comp:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [compId]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this compatibility group? This will NOT delete the associated parts or spas.')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/dashboard/super-admin/comps/${encodeURIComponent(compId)}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.push('/super-admin/uhtd/comps');
      }
    } catch (err) {
      console.error('Error deleting comp:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleRemoveSpa = async (spaModelId: string) => {
    try {
      await fetch(`/api/dashboard/super-admin/comps/${encodeURIComponent(compId)}/spas/${spaModelId}`, {
        method: 'DELETE',
      });
      setSpas((prev) => prev.filter((s) => s.spaModelId !== spaModelId));
    } catch (err) {
      console.error('Error removing spa:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!comp) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Compatibility Group not found</h2>
        <Link href="/super-admin/uhtd/comps" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
          Back to Comps
        </Link>
      </div>
    );
  }

  const spaColumns = [
    {
      key: 'spa',
      header: 'Spa Model',
      render: (cs: CompSpa) => (
        <div>
          <div className="font-medium text-gray-900">{cs.spaModel?.modelName || 'Unknown'}</div>
          <div className="text-xs text-gray-500">
            {cs.spaModel?.brandName} - {cs.spaModel?.modelLineName} ({cs.spaModel?.modelYear})
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-24',
      render: (cs: CompSpa) => (
        <button
          onClick={() => handleRemoveSpa(cs.spaModelId)}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Remove
        </button>
      ),
    },
  ];

  const partColumns = [
    {
      key: 'part',
      header: 'Part',
      render: (p: ComputedPart) => (
        <div>
          <div className="font-medium text-gray-900">{p.partName}</div>
          {p.partNumber && <div className="text-xs text-gray-500">{p.partNumber}</div>}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (p: ComputedPart) => <span className="text-gray-600">{p.categoryName || '-'}</span>,
    },
    {
      key: 'manufacturer',
      header: 'Manufacturer',
      render: (p: ComputedPart) => <span className="text-gray-600">{p.manufacturer || '-'}</span>,
    },
    {
      key: 'coverage',
      header: 'Coverage',
      render: (p: ComputedPart) => (
        <div className="flex items-center gap-2">
          <div className="w-24 bg-gray-200 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{ width: `${(p.matchingSpas / p.totalSpas) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">
            {p.matchingSpas}/{p.totalSpas}
          </span>
        </div>
      ),
    },
    {
      key: 'oem',
      header: '',
      render: (p: ComputedPart) => p.isOem && <Badge variant="info" size="sm">OEM</Badge>,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-20',
      render: (p: ComputedPart) => (
        <Link
          href={`/super-admin/uhtd/parts/${p.partId}`}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          View
        </Link>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6">
        <Link href="/super-admin/uhtd/comps" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Comps
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900">{comp.name}</h1>
            <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">{comp.id}</span>
          </div>
          {comp.description && <p className="text-gray-500 mt-1">{comp.description}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="danger" onClick={handleDelete} loading={deleting}>
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{spas.length}</div>
          <div className="text-sm text-gray-500">Spas in Group</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{parts.length}</div>
          <div className="text-sm text-gray-500">Compatible Parts (computed)</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">
            {parts.filter((p) => p.matchingSpas === p.totalSpas).length}
          </div>
          <div className="text-sm text-gray-500">Parts Fitting All Spas</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('spas')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'spas'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Spas ({spas.length})
            </button>
            <button
              onClick={() => setActiveTab('parts')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'parts'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Computed Parts ({parts.length})
            </button>
          </nav>
        </div>

        {activeTab === 'spas' ? (
          <Table
            columns={spaColumns}
            data={spas}
            keyField="id"
            emptyMessage="No spas in this group yet. Add spas to see compatible parts."
          />
        ) : (
          <div>
            <div className="p-4 bg-blue-50 border-b border-blue-100">
              <p className="text-sm text-blue-800">
                <strong>Computed Parts:</strong> These parts are dynamically calculated based on
                which parts have compatibility records with the spas in this group.
              </p>
            </div>
            <Table
              columns={partColumns}
              data={parts}
              keyField="partId"
              emptyMessage="No parts are compatible with spas in this group yet."
            />
          </div>
        )}
      </div>
    </div>
  );
}
