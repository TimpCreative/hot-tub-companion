'use client';

import { useEffect, useState } from 'react';
import { Table } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface Category {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  partCount?: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    sortOrder: 0,
  });

  async function fetchCategories() {
    try {
      const res = await fetch('/api/dashboard/super-admin/pcdb/categories');
      const data = await res.json();
      if (data.success) {
        setCategories(data.data || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCategories();
  }, []);

  const openCreateModal = () => {
    setEditingCategory(null);
    setFormData({
      name: '',
      displayName: '',
      description: '',
      sortOrder: categories.length,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      displayName: category.displayName,
      description: category.description || '',
      sortOrder: category.sortOrder,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const url = editingCategory
        ? `/api/dashboard/super-admin/pcdb/categories/${editingCategory.id}`
        : '/api/dashboard/super-admin/pcdb/categories';

      const res = await fetch(url, {
        method: editingCategory ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          displayName: formData.displayName,
          description: formData.description || null,
          sortOrder: formData.sortOrder,
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchCategories();
      }
    } catch (err) {
      console.error('Error saving category:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;

    try {
      const res = await fetch(`/api/dashboard/super-admin/pcdb/categories/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchCategories();
      }
    } catch (err) {
      console.error('Error deleting category:', err);
    }
  };

  const columns = [
    {
      key: 'sortOrder',
      header: '#',
      className: 'w-12',
      render: (cat: Category) => (
        <span className="text-gray-400 text-sm">{cat.sortOrder}</span>
      ),
    },
    {
      key: 'displayName',
      header: 'Category',
      render: (cat: Category) => (
        <div>
          <div className="font-medium text-gray-900">{cat.displayName}</div>
          <div className="text-xs text-gray-500 font-mono">{cat.name}</div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (cat: Category) => (
        <span className="text-gray-500 text-sm">{cat.description || '-'}</span>
      ),
    },
    {
      key: 'partCount',
      header: 'Parts',
      className: 'text-center',
      render: (cat: Category) => (
        <span className="text-gray-600">{cat.partCount || 0}</span>
      ),
    },
    {
      key: 'actions',
      header: '',
      className: 'w-32',
      render: (cat: Category) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEditModal(cat)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Edit
          </button>
          <button
            onClick={() => handleDelete(cat.id)}
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
          <h1 className="text-2xl font-semibold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-1">Manage part categories</p>
        </div>
        <Button onClick={openCreateModal}>+ Add Category</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table
          columns={columns}
          data={categories}
          keyField="id"
          loading={loading}
          emptyMessage="No categories found. Add your first category to organize parts."
        />
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? 'Edit Category' : 'Add Category'}
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Internal Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="filters"
                required
                disabled={!!editingCategory}
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
                placeholder="Filters"
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
                placeholder="Water filtration components"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={0}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
