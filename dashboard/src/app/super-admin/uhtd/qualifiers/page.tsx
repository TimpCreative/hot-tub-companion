'use client';

import { useEffect, useState } from 'react';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

interface Qualifier {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  dataType: 'boolean' | 'single_select' | 'multi_select';
  allowedValues: string[] | null;
  appliesTo: 'spa' | 'part' | 'both';
  createdAt: string;
}

export default function QualifiersPage() {
  const [qualifiers, setQualifiers] = useState<Qualifier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQualifier, setEditingQualifier] = useState<Qualifier | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    dataType: 'boolean' as 'boolean' | 'single_select' | 'multi_select',
    allowedValues: '',
    appliesTo: 'both' as 'spa' | 'part' | 'both',
  });

  async function fetchQualifiers() {
    try {
      const res = await fetch('/api/dashboard/super-admin/qdb/qualifiers');
      const data = await res.json();
      if (data.success) {
        setQualifiers(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching qualifiers:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchQualifiers();
  }, []);

  const openCreateModal = () => {
    setEditingQualifier(null);
    setError('');
    setFormData({
      name: '',
      displayName: '',
      description: '',
      dataType: 'boolean',
      allowedValues: '',
      appliesTo: 'both',
    });
    setIsModalOpen(true);
  };

  const openEditModal = (qualifier: Qualifier) => {
    setEditingQualifier(qualifier);
    setError('');
    setFormData({
      name: qualifier.name,
      displayName: qualifier.displayName,
      description: qualifier.description || '',
      dataType: qualifier.dataType,
      allowedValues: qualifier.allowedValues?.join(', ') || '',
      appliesTo: qualifier.appliesTo,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const payload = {
        name: formData.name,
        displayName: formData.displayName,
        description: formData.description || null,
        dataType: formData.dataType,
        allowedValues:
          formData.dataType !== 'boolean' && formData.allowedValues
            ? formData.allowedValues.split(',').map((v) => v.trim()).filter(Boolean)
            : null,
        appliesTo: formData.appliesTo,
      };

      const url = editingQualifier
        ? `/api/dashboard/super-admin/qdb/qualifiers/${editingQualifier.id}`
        : '/api/dashboard/super-admin/qdb/qualifiers';

      const res = await fetch(url, {
        method: editingQualifier ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setIsModalOpen(false);
        fetchQualifiers();
      } else {
        setError(data.error?.message || 'Failed to save qualifier');
      }
    } catch (err) {
      console.error('Error saving qualifier:', err);
      setError('Network error - please try again');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this qualifier?')) return;

    try {
      const res = await fetch(`/api/dashboard/super-admin/qdb/qualifiers/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchQualifiers();
      }
    } catch (err) {
      console.error('Error deleting qualifier:', err);
    }
  };

  const columns = [
    {
      key: 'displayName',
      header: 'Qualifier',
      render: (q: any) => (
        <div>
          <div className="font-medium text-gray-900">{q.displayName}</div>
          <div className="text-xs text-gray-500 font-mono">{q.name}</div>
        </div>
      ),
    },
    {
      key: 'dataType',
      header: 'Type',
      render: (q: any) => {
        const variant = q.dataType === 'boolean' ? 'default' : q.dataType === 'single_select' ? 'info' : 'warning';
        return <Badge variant={variant}>{q.dataType.replace('_', ' ')}</Badge>;
      },
    },
    {
      key: 'appliesTo',
      header: 'Applies To',
      render: (q: any) => {
        const colors: Record<string, 'info' | 'success' | 'warning'> = {
          spa: 'info',
          part: 'success',
          both: 'warning',
        };
        return <Badge variant={colors[q.appliesTo] || 'default'}>{q.appliesTo}</Badge>;
      },
    },
    {
      key: 'allowedValues',
      header: 'Allowed Values',
      render: (q: any) => (
        <span className="text-gray-600 text-sm">
          {q.dataType === 'boolean' ? 'true / false' : q.allowedValues?.join(', ') || '-'}
        </span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (q: any) => (
        <span className="text-gray-500 text-sm truncate max-w-xs block">
          {q.description || '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-32',
      render: (q: any) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEditModal(q)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(q.id)}
            className="text-sm text-red-600 hover:text-red-800"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Qualifiers</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage spa and part qualifiers for conditional compatibility
          </p>
        </div>
        <Button onClick={openCreateModal}>+ Add Qualifier</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table
          columns={columns}
          data={qualifiers}
          keyField="id"
          loading={loading}
          emptyMessage="No qualifiers defined yet. Add your first qualifier to enable conditional compatibility."
        />
      </div>

      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-medium text-yellow-900 mb-2">About Qualifiers</h3>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• <strong>Boolean</strong> - Simple yes/no values (e.g., "Has Ozonator")</li>
          <li>• <strong>Single Select</strong> - One value from a list (e.g., "Voltage: 120V / 240V")</li>
          <li>• <strong>Multi Select</strong> - Multiple values (e.g., "Sanitization: Chlorine, Bromine, Salt")</li>
          <li>• <strong>Applies To</strong> - Spa (spa attribute), Part (part requirement), Both (used by both)</li>
          <li>• Use qualifiers to define conditions where parts only fit certain spa configurations</li>
        </ul>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingQualifier ? 'Edit Qualifier' : 'Add Qualifier'}
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Internal Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="voltage_rating"
                required
                disabled={!!editingQualifier}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Voltage Rating"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="The electrical voltage of the spa"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Applies To <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.appliesTo}
                onChange={(e) => setFormData({ ...formData, appliesTo: e.target.value as 'spa' | 'part' | 'both' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="both">Both (Spa & Part)</option>
                <option value="spa">Spa Only</option>
                <option value="part">Part Only</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Spa: attribute of spas (e.g., voltage). Part: requirement of parts. Both: used by both.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Data Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.dataType}
                onChange={(e) => setFormData({ ...formData, dataType: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="boolean">Boolean (Yes/No)</option>
                <option value="single_select">Single Select</option>
                <option value="multi_select">Multi Select</option>
              </select>
            </div>

            {formData.dataType !== 'boolean' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Allowed Values <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.allowedValues}
                  onChange={(e) => setFormData({ ...formData, allowedValues: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="120V, 240V"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Comma-separated list of allowed values (spaces will be trimmed)</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingQualifier ? 'Save Changes' : 'Create Qualifier'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
