'use client';

import React, { useEffect, useState } from 'react';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

interface QualifierAllowedValue {
  value: string;
  displayName: string;
  brandIds?: string[] | null;
}

interface Section {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}

interface Brand {
  id: string;
  name: string;
}

interface Qualifier {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  dataType: 'boolean' | 'enum' | 'array' | 'number' | 'text';
  allowedValues: QualifierAllowedValue[] | string[] | null;
  appliesTo: 'spa' | 'part' | 'both';
  sectionId: string | null;
  isUniversal: boolean;
  isRequired: boolean;
  createdAt: string;
}

function normDataType(dt: string): Qualifier['dataType'] {
  if (dt === 'single_select') return 'enum';
  if (dt === 'multi_select') return 'array';
  if (['boolean', 'enum', 'array', 'number', 'text'].includes(dt)) return dt as Qualifier['dataType'];
  return 'boolean';
}

function normAllowedValues(
  av: QualifierAllowedValue[] | string[] | null
): QualifierAllowedValue[] {
  if (!av || !Array.isArray(av)) return [];
  return av.map((item) =>
    typeof item === 'string' ? { value: item, displayName: item, brandIds: null } : item
  );
}

export default function QualifiersPage() {
  const fetchWithAuth = useSuperAdminFetch();
  const [sections, setSections] = useState<Section[]>([]);
  const [qualifiers, setQualifiers] = useState<Qualifier[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQualifier, setEditingQualifier] = useState<Qualifier | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionName, setSectionName] = useState('');
  const [sectionSaving, setSectionSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    dataType: 'boolean' as Qualifier['dataType'],
    allowedValues: [] as QualifierAllowedValue[],
    appliesTo: 'both' as 'spa' | 'part' | 'both',
    sectionId: null as string | null,
    isUniversal: true,
    isRequired: false,
  });

  async function fetchSections() {
    try {
      const res = await fetchWithAuth('/api/dashboard/super-admin/qdb/sections');
      const data = await res.json();
      if (data.success) setSections((data.data || []).sort((a: Section, b: Section) => a.sortOrder - b.sortOrder));
    } catch (err) {
      console.error('Error fetching sections:', err);
    }
  }

  async function fetchQualifiers() {
    try {
      const res = await fetchWithAuth('/api/dashboard/super-admin/qdb/qualifiers');
      const data = await res.json();
      if (data.success) setQualifiers(data.data || []);
    } catch (err) {
      console.error('Error fetching qualifiers:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchBrands() {
    try {
      const res = await fetchWithAuth('/api/dashboard/super-admin/scdb/brands?page=1&pageSize=500');
      const data = await res.json();
      if (data.success) setBrands(Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      console.error('Error fetching brands:', err);
    }
  }

  useEffect(() => {
    Promise.all([fetchSections(), fetchQualifiers(), fetchBrands()]);
  }, [fetchWithAuth]);

  const openCreateModal = () => {
    setEditingQualifier(null);
    setError('');
    setFormData({
      name: '',
      displayName: '',
      description: '',
      dataType: 'boolean',
      allowedValues: [],
      appliesTo: 'both',
      sectionId: null,
      isUniversal: true,
      isRequired: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (qualifier: Qualifier) => {
    setEditingQualifier(qualifier);
    setError('');
    const av = normAllowedValues(qualifier.allowedValues);
    setFormData({
      name: qualifier.name,
      displayName: qualifier.displayName,
      description: qualifier.description || '',
      dataType: normDataType(qualifier.dataType),
      allowedValues: av,
      appliesTo: qualifier.appliesTo,
      sectionId: qualifier.sectionId ?? null,
      isUniversal: qualifier.isUniversal ?? true,
      isRequired: qualifier.isRequired ?? false,
    });
    setIsModalOpen(true);
  };

  const handleSectionReorder = async (section: Section, direction: 'up' | 'down') => {
    const idx = sections.findIndex((s) => s.id === section.id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sections.length) return;
    const other = sections[swapIdx];
    try {
      await fetchWithAuth(`/api/dashboard/super-admin/qdb/sections/${section.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: other.sortOrder }),
      });
      await fetchWithAuth(`/api/dashboard/super-admin/qdb/sections/${other.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sortOrder: section.sortOrder }),
      });
      fetchSections();
    } catch (err) {
      console.error('Error reordering:', err);
    }
  };

  const openAddSection = () => {
    setEditingSection(null);
    setSectionName('');
    setSectionModalOpen(true);
  };

  const openEditSection = (s: Section) => {
    setEditingSection(s);
    setSectionName(s.name);
    setSectionModalOpen(true);
  };

  const handleSectionSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSectionSaving(true);
    try {
      if (editingSection) {
        await fetchWithAuth(`/api/dashboard/super-admin/qdb/sections/${editingSection.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sectionName }),
        });
      } else {
        await fetchWithAuth('/api/dashboard/super-admin/qdb/sections', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: sectionName, sortOrder: sections.length }),
        });
      }
      setSectionModalOpen(false);
      fetchSections();
    } catch (err) {
      console.error('Error saving section:', err);
    } finally {
      setSectionSaving(false);
    }
  };

  const handleSectionDelete = async (id: string) => {
    if (!confirm('Delete this section? Qualifiers in it will be unassigned.')) return;
    try {
      await fetchWithAuth(`/api/dashboard/super-admin/qdb/sections/${id}`, { method: 'DELETE' });
      fetchSections();
      fetchQualifiers();
    } catch (err) {
      console.error('Error deleting section:', err);
    }
  };

  const addAllowedValueRow = () => {
    setFormData({
      ...formData,
      allowedValues: [...formData.allowedValues, { value: '', displayName: '', brandIds: null }],
    });
  };

  const updateAllowedValue = (idx: number, field: keyof QualifierAllowedValue, val: string | string[] | null) => {
    const next = [...formData.allowedValues];
    next[idx] = { ...next[idx], [field]: val };
    setFormData({ ...formData, allowedValues: next });
  };

  const removeAllowedValue = (idx: number) => {
    setFormData({
      ...formData,
      allowedValues: formData.allowedValues.filter((_, i) => i !== idx),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      let allowedValuesPayload: QualifierAllowedValue[] | null = null;
      if (formData.dataType === 'enum' || formData.dataType === 'array') {
        const valid = formData.allowedValues.filter((a) => a.value.trim() && a.displayName.trim());
        if (formData.dataType === 'enum' && valid.length === 0) {
          setError('Enum type requires at least one allowed value');
          setSaving(false);
          return;
        }
        if (formData.dataType === 'array' && valid.length === 0) {
          allowedValuesPayload = null;
        } else if (valid.length > 0) {
          allowedValuesPayload = valid.map((a) => ({
            value: a.value.trim(),
            displayName: a.displayName.trim(),
            brandIds: a.brandIds && a.brandIds.length > 0 ? a.brandIds : null,
          }));
        }
      }

      const payload = {
        name: formData.name,
        displayName: formData.displayName,
        description: formData.description || null,
        dataType: formData.dataType,
        allowedValues: allowedValuesPayload,
        appliesTo: formData.appliesTo,
        sectionId: formData.sectionId || null,
        isUniversal: formData.isUniversal,
        isRequired: formData.isRequired,
      };

      const url = editingQualifier
        ? `/api/dashboard/super-admin/qdb/qualifiers/${editingQualifier.id}`
        : '/api/dashboard/super-admin/qdb/qualifiers';

      const res = await fetchWithAuth(url, {
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
      const res = await fetchWithAuth(`/api/dashboard/super-admin/qdb/qualifiers/${id}`, { method: 'DELETE' });
      if (res.ok) fetchQualifiers();
    } catch (err) {
      console.error('Error deleting qualifier:', err);
    }
  };

  const getSectionName = (sectionId: string | null) => {
    if (!sectionId) return '-';
    return sections.find((s) => s.id === sectionId)?.name ?? sectionId;
  };

  const formatAllowedValues = (q: Qualifier) => {
    if (q.dataType === 'boolean') return 'true / false';
    const av = normAllowedValues(q.allowedValues);
    if (av.length === 0) return q.dataType === 'array' ? '(no fixed options)' : '-';
    return av.map((a) => `${a.displayName}${a.brandIds?.length ? ' (brand)' : ''}`).join(', ');
  };

  const columns = [
    {
      key: 'displayName',
      header: 'Qualifier',
      render: (q: Qualifier) => (
        <div>
          <div className="font-medium text-gray-900">{q.displayName}</div>
          <div className="text-xs text-gray-500 font-mono">{q.name}</div>
        </div>
      ),
    },
    {
      key: 'section',
      header: 'Section',
      render: (q: Qualifier) => <span className="text-sm text-gray-600">{getSectionName(q.sectionId)}</span>,
    },
    {
      key: 'dataType',
      header: 'Type',
      render: (q: Qualifier) => {
        const variant = q.dataType === 'boolean' ? 'default' : q.dataType === 'enum' ? 'info' : 'warning';
        return <Badge variant={variant}>{q.dataType}</Badge>;
      },
    },
    {
      key: 'universal',
      header: 'Universal',
      render: (q: Qualifier) => (q.isUniversal ? 'Yes' : 'No'),
    },
    {
      key: 'required',
      header: 'Required',
      render: (q: Qualifier) => (q.isRequired ? 'Yes' : 'No'),
    },
    {
      key: 'appliesTo',
      header: 'Applies To',
      render: (q: Qualifier) => {
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
      render: (q: Qualifier) => <span className="text-gray-600 text-sm">{formatAllowedValues(q)}</span>,
    },
    {
      key: 'actions',
      header: '',
      className: 'w-32',
      render: (q: Qualifier) => (
        <div className="flex gap-2">
          <button onClick={() => openEditModal(q)} className="text-sm text-blue-600 hover:text-blue-800">Edit</button>
          <button onClick={() => handleDelete(q.id)} className="text-sm text-red-600 hover:text-red-800">Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Qualifiers</h1>
          <p className="text-sm text-gray-500 mt-1">Manage spa and part qualifiers for conditional compatibility</p>
        </div>
        <Button onClick={openCreateModal}>+ Add Qualifier</Button>
      </div>

      {/* Sections */}
      <div className="mb-8 bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Sections</h3>
        <p className="text-sm text-gray-500 mb-4">Group qualifiers in Add Spa form. Reorder to control display order.</p>
        <div className="space-y-2">
          {sections.map((s, idx) => (
            <div
              key={s.id}
              className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <span className="font-medium text-gray-900">{s.name}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSectionReorder(s, 'up')}
                  disabled={idx === 0}
                  className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => handleSectionReorder(s, 'down')}
                  disabled={idx === sections.length - 1}
                  className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Down
                </button>
                <button type="button" onClick={() => openEditSection(s)} className="text-sm text-gray-600 hover:text-gray-800">Edit</button>
                <button type="button" onClick={() => handleSectionDelete(s.id)} className="text-sm text-red-600 hover:text-red-800">Delete</button>
              </div>
            </div>
          ))}
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={openAddSection} className="mt-4">
          + Add Section
        </Button>
      </div>

      {/* Qualifiers Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table
          columns={columns as any}
          data={qualifiers as any}
          keyField="id"
          loading={loading}
          emptyMessage="No qualifiers defined yet. Add your first qualifier to enable conditional compatibility."
        />
      </div>

      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-medium text-yellow-900 mb-2">About Qualifiers</h3>
        <ul className="text-sm text-yellow-800 space-y-1">
          <li>• <strong>Boolean</strong> – Yes/no values</li>
          <li>• <strong>Enum</strong> – Single value from a list</li>
          <li>• <strong>Array</strong> – Multiple values; can have fixed options or free-form (e.g. electrical configs)</li>
          <li>• <strong>Universal</strong> – Shows for all brands; otherwise assign to brands on Brand edit page</li>
          <li>• <strong>Required</strong> – Must be set when adding/editing a spa</li>
          <li>• <strong>Electrical simplification:</strong> Electrical Configurations (array) captures full configs (e.g. 240V/50A). Voltage Requirement (enum) is simpler (120V/240V). You typically only need one—use Electrical Configurations if you need amperage details; otherwise Voltage Requirement is enough.</li>
        </ul>
      </div>

      {/* Section Modal */}
      <Modal isOpen={sectionModalOpen} onClose={() => setSectionModalOpen(false)} title={editingSection ? 'Edit Section' : 'Add Section'}>
        <form onSubmit={handleSectionSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={sectionName}
              onChange={(e) => setSectionName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Specifications"
              required
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setSectionModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={sectionSaving}>{editingSection ? 'Save' : 'Create'}</Button>
          </div>
        </form>
      </Modal>

      {/* Qualifier Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingQualifier ? 'Edit Qualifier' : 'Add Qualifier'} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Internal Name *</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Name *</label>
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
            <select
              value={formData.sectionId ?? ''}
              onChange={(e) => setFormData({ ...formData, sectionId: e.target.value || null })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">None</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isUniversal"
              checked={formData.isUniversal}
              onChange={(e) => setFormData({ ...formData, isUniversal: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isUniversal" className="text-sm text-gray-700">Universal (shows for all brands)</label>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isRequired"
              checked={formData.isRequired}
              onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isRequired" className="text-sm text-gray-700">Required when adding/editing spa</label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Applies To *</label>
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Data Type *</label>
            <select
              value={formData.dataType}
              onChange={(e) => setFormData({ ...formData, dataType: e.target.value as Qualifier['dataType'] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="boolean">Boolean (Yes/No)</option>
              <option value="enum">Enum (single select)</option>
              <option value="array">Array (multi-select or free-form)</option>
              <option value="number">Number</option>
              <option value="text">Text</option>
            </select>
          </div>

          {(formData.dataType === 'enum' || formData.dataType === 'array') && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Allowed Values</label>
                {formData.dataType === 'array' && (
                  <span className="text-xs text-gray-500">Leave empty for free-form (e.g. electrical configs)</span>
                )}
                <Button type="button" variant="secondary" size="sm" onClick={addAllowedValueRow}>+ Add</Button>
              </div>
              <div className="space-y-2">
                {formData.allowedValues.map((av, idx) => (
                  <div key={idx} className="grid grid-cols-[minmax(100px,1fr)_minmax(120px,1fr)_minmax(220px,1.5fr)_auto] gap-3 items-center p-3 bg-gray-50 rounded border border-gray-200">
                    <input
                      type="text"
                      value={av.value}
                      onChange={(e) => updateAllowedValue(idx, 'value', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                      placeholder="value"
                      className="w-full min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded"
                    />
                    <input
                      type="text"
                      value={av.displayName}
                      onChange={(e) => updateAllowedValue(idx, 'displayName', e.target.value)}
                      placeholder="Display name"
                      className="w-full min-w-0 px-2 py-1.5 text-sm border border-gray-300 rounded"
                    />
                    <div className="min-w-0">
                      <span className="text-xs text-gray-500 block mb-1">Brands (empty = universal)</span>
                      <select
                        multiple
                        value={av.brandIds || []}
                        onChange={(e) => {
                          const opts = Array.from(e.target.selectedOptions, (o) => o.value);
                          updateAllowedValue(idx, 'brandIds', opts.length ? opts : null);
                        }}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded max-h-28 min-h-[2.5rem]"
                      >
                        {brands.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <button type="button" onClick={() => removeAllowedValue(idx)} className="flex-shrink-0 px-3 py-1.5 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded whitespace-nowrap">Remove</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" loading={saving}>{editingQualifier ? 'Save Changes' : 'Create Qualifier'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
