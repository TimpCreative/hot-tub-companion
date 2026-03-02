'use client';

import React, { useState, useEffect } from 'react';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { QuickCreateBrandModal } from './QuickCreateBrandModal';

interface Brand {
  id: string;
  name: string;
}

interface QuickCreateModelLineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (modelLine: { id: string; name: string; brandId: string; brandName: string }) => void;
  preSelectedBrandId?: string;
}

export function QuickCreateModelLineModal({
  isOpen,
  onClose,
  onCreated,
  preSelectedBrandId,
}: QuickCreateModelLineModalProps) {
  const fetchWithAuth = useSuperAdminFetch();
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState(preSelectedBrandId || '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showBrandModal, setShowBrandModal] = useState(false);

  useEffect(() => {
    async function fetchBrands() {
      try {
        const res = await fetchWithAuth('/api/dashboard/super-admin/scdb/brands');
        const data = await res.json();
        if (data.success) setBrands(data.data || []);
      } catch (err) {
        console.error('Error fetching brands:', err);
      }
    }
    if (isOpen) {
      fetchBrands();
    }
  }, [isOpen, fetchWithAuth]);

  useEffect(() => {
    if (preSelectedBrandId) {
      setBrandId(preSelectedBrandId);
    }
  }, [preSelectedBrandId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetchWithAuth('/api/dashboard/super-admin/scdb/model-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId,
          name,
          description: description || null,
          isActive: true,
          dataSource: 'Quick create',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to create model line');
      }

      const brand = brands.find((b) => b.id === brandId);
      onCreated({
        id: data.data.id,
        name: data.data.name,
        brandId: data.data.brandId,
        brandName: brand?.name || '',
      });
      setName('');
      setDescription('');
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBrandCreated = (brand: { id: string; name: string }) => {
    setBrands((prev) => [...prev, brand]);
    setBrandId(brand.id);
    setShowBrandModal(false);
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Quick Create Model Line" size="sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Brand <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select a brand...</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowBrandModal(true)}
                className="whitespace-nowrap"
              >
                + New Brand
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Model Line Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., J-300 Collection"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Brief description of this model line..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create Model Line
            </Button>
          </div>
        </form>
      </Modal>

      <QuickCreateBrandModal
        isOpen={showBrandModal}
        onClose={() => setShowBrandModal(false)}
        onCreated={handleBrandCreated}
      />
    </>
  );
}
