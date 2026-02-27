'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface CreateCompModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (comp: { id: string; name: string }) => void;
  preSelectedSpaIds?: string[];
  categoryId?: string;
}

export function CreateCompModal({
  isOpen,
  onClose,
  onCreated,
  preSelectedSpaIds = [],
  categoryId,
}: CreateCompModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    compId: '',
    name: '',
    description: '',
    spaIds: preSelectedSpaIds,
  });
  
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      spaIds: preSelectedSpaIds,
    }));
  }, [preSelectedSpaIds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/dashboard/super-admin/comps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: formData.compId.trim(),
          name: formData.name.trim() || null,
          description: formData.description.trim() || null,
          spaModelIds: formData.spaIds,
          isActive: true,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to create Comp');
      }

      onCreated({
        id: data.data.id,
        name: formData.name || formData.compId,
      });

      setFormData({
        compId: '',
        name: '',
        description: '',
        spaIds: [],
      });
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      compId: '',
      name: '',
      description: '',
      spaIds: [],
    });
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create New Compatibility Group" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-sm font-medium text-blue-800 mb-1">
            Selected Spas: {preSelectedSpaIds.length}
          </div>
          <p className="text-xs text-blue-600">
            This Comp will group the currently selected spa models together.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Comp ID <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.compId}
            onChange={(e) => setFormData({ ...formData, compId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., COMP-JAC-FILT-001"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Use format: COMP-BRAND-TYPE-XXX (e.g., COMP-JAC-FILT-001, COMP-HOTSPRING-PUMP-003)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Display Name (optional)
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Jacuzzi J-300 Series Filter Housing"
          />
          <p className="text-xs text-gray-500 mt-1">
            Human-readable name for easier identification
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description (optional)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Notes about this compatibility group..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} disabled={preSelectedSpaIds.length === 0}>
            Create Comp
          </Button>
        </div>
      </form>
    </Modal>
  );
}
