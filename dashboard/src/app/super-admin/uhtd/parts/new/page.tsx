'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PartForm } from '@/components/uhtd/PartForm';

export default function NewPartPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (formData: any, spaIds: string[]) => {
    setLoading(true);
    setError('');

    try {
      // Create the part
      const partRes = await fetch('/api/dashboard/super-admin/pcdb/parts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const partData = await partRes.json();

      if (!partRes.ok) {
        throw new Error(partData.error?.message || 'Failed to create part');
      }

      const partId = partData.data.id;

      // Create compatibility records if spas were selected
      if (spaIds.length > 0 && !formData.isUniversal) {
        await fetch('/api/dashboard/super-admin/comps/compatibility/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partId,
            spaModelIds: spaIds,
            status: 'pending',
          }),
        });
      }

      router.push(`/super-admin/uhtd/parts/${partId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Link href="/super-admin/uhtd/parts" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Parts
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">Add New Part</h1>
        <p className="text-sm text-gray-500">
          Fill in part details and select compatible spas using the two-panel form
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <PartForm onSubmit={handleSubmit} submitLabel="Create Part" loading={loading} />
    </div>
  );
}
