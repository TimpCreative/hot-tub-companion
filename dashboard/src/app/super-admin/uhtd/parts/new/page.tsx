'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { PartForm } from '@/components/uhtd/PartForm';
import { Accordion } from '@/components/ui/Accordion';
import { BulkAddTable } from '@/components/ui/BulkAddTable';

interface Category {
  id: string;
  name: string;
  displayName: string;
}

export default function NewPartPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/dashboard/super-admin/pcdb/categories');
        const data = await res.json();
        if (data.success) setCategories(data.data || []);
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    }
    fetchCategories();
  }, []);

  const handleSubmit = async (formData: any, spaIds: string[]) => {
    setLoading(true);
    setError('');

    try {
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

  const handleBulkAdd = async (rows: Record<string, any>[]) => {
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      if (!row.name) {
        failed++;
        errors.push(`Row: Name is required`);
        continue;
      }

      try {
        const res = await fetch('/api/dashboard/super-admin/pcdb/parts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: row.name,
            partNumber: row.partNumber || null,
            categoryId: row.categoryId || null,
            manufacturer: row.manufacturer || null,
            upc: row.upc || null,
            isOem: row.isOem === true,
            isUniversal: row.isUniversal === true,
            dataSource: row.dataSource || 'Bulk import',
          }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          success++;
        } else {
          failed++;
          errors.push(`${row.name}: ${data.error?.message || 'Failed'}`);
        }
      } catch (err) {
        failed++;
        errors.push(`${row.name}: Network error`);
      }
    }

    return { success, failed, errors };
  };

  const bulkColumns = [
    { key: 'name', header: 'Part Name', required: true, placeholder: 'e.g., Filter Cartridge', width: '180px' },
    { key: 'partNumber', header: 'Part #', placeholder: 'SKU/Part #', width: '100px' },
    {
      key: 'categoryId',
      header: 'Category',
      type: 'select' as const,
      options: categories.map((c) => ({ value: c.id, label: c.displayName })),
      width: '140px',
    },
    { key: 'manufacturer', header: 'Manufacturer', placeholder: 'Brand', width: '110px' },
    { key: 'upc', header: 'UPC', placeholder: 'UPC code', width: '120px' },
    { key: 'dataSource', header: 'Data Source', placeholder: 'Source', width: '100px' },
    { key: 'isOem', header: 'OEM', type: 'checkbox' as const, width: '50px' },
    { key: 'isUniversal', header: 'Univ.', type: 'checkbox' as const, width: '50px' },
  ];

  return (
    <div>
      <div className="mb-6">
        <Link href="/super-admin/uhtd/parts" className="text-sm text-gray-500 hover:text-gray-700">
          ← Back to Parts
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900 mt-2">Add New Part</h1>
        <p className="text-sm text-gray-500">
          Add parts individually with full details, or bulk add basic parts
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <Accordion title="Add Single Part with Compatibility" subtitle="Full two-panel form with spa compatibility selection" defaultOpen={true}>
          <PartForm onSubmit={handleSubmit} submitLabel="Create Part" loading={loading} />
        </Accordion>

        <Accordion title="Bulk Add Parts" subtitle="Add multiple parts quickly - spa compatibility can be added later">
          <p className="text-sm text-gray-600 mb-4">
            Note: Bulk-added parts won&apos;t have spa compatibility set. Edit each part after creation to add compatible spas.
          </p>
          <BulkAddTable columns={bulkColumns} onSubmit={handleBulkAdd} />
        </Accordion>
      </div>
    </div>
  );
}
