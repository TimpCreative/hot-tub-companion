'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import Link from 'next/link';
import { PartForm } from '@/components/uhtd/PartForm';

interface Part {
  id: string;
  name: string;
  partNumber: string | null;
  upc: string | null;
  ean: string | null;
  manufacturer: string | null;
  categoryId: string;
  isOem: boolean;
  isUniversal: boolean;
  displayImportance: number;
  imageUrl: string | null;
  notes: string | null;
  dataSource: string | null;
}

interface Compatibility {
  id: string;
  spaModelId: string;
}

export default function EditPartPage() {
  const params = useParams();
  const router = useRouter();
  const fetchWithAuth = useSuperAdminFetch();
  const partId = params.id as string;

  const [part, setPart] = useState<Part | null>(null);
  const [existingSpaIds, setExistingSpaIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        const [partRes, compatRes] = await Promise.all([
          fetchWithAuth(`/api/dashboard/super-admin/pcdb/parts/${partId}`),
          fetchWithAuth(`/api/dashboard/super-admin/comps/compatibility?partId=${partId}`),
        ]);

        const partData = await partRes.json();
        const compatData = await compatRes.json();

        if (partData.success) setPart(partData.data);
        if (compatData.success) {
          const ids = (compatData.data || []).map((c: Compatibility) => c.spaModelId);
          setExistingSpaIds(ids);
        }
      } catch (err) {
        console.error('Error fetching part:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [partId, fetchWithAuth]);

  const handleSubmit = async (formData: any, spaIds: string[]) => {
    setSaving(true);
    setError('');

    try {
      // Update the part
      const partRes = await fetchWithAuth(`/api/dashboard/super-admin/pcdb/parts/${partId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!partRes.ok) {
        const data = await partRes.json();
        throw new Error(data.error?.message || 'Failed to update part');
      }

      // Handle compatibility changes
      if (!formData.isUniversal) {
        const toAdd = spaIds.filter((id) => !existingSpaIds.includes(id));
        const toRemove = existingSpaIds.filter((id) => !spaIds.includes(id));

        // Add new compatibilities
        if (toAdd.length > 0) {
          await fetchWithAuth('/api/dashboard/super-admin/comps/compatibility/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              partId,
              spaModelIds: toAdd,
              status: 'pending',
            }),
          });
        }

        // Remove old compatibilities
        for (const spaModelId of toRemove) {
          await fetchWithAuth(`/api/dashboard/super-admin/comps/compatibility`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partId, spaModelId }),
          });
        }
      }

      router.push(`/super-admin/uhtd/parts/${partId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!part) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Part not found</h2>
        <Link href="/super-admin/uhtd/parts" className="text-blue-600 hover:text-blue-800 mt-2 inline-block">
          Back to Parts
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/super-admin/uhtd/parts/${partId}`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to Part
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">Edit Part</h1>
        <p className="text-sm text-gray-500">{part.name}</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <PartForm
        initialData={{
          categoryId: part.categoryId,
          partNumber: part.partNumber || '',
          upc: part.upc || '',
          ean: part.ean || '',
          name: part.name,
          manufacturer: part.manufacturer || '',
          isOem: part.isOem,
          isUniversal: part.isUniversal,
          displayImportance: part.displayImportance,
          imageUrl: part.imageUrl || '',
          notes: part.notes || '',
          dataSource: part.dataSource || '',
        }}
        selectedSpaIds={existingSpaIds}
        onSubmit={handleSubmit}
        submitLabel="Save Changes"
        loading={saving}
      />
    </div>
  );
}
