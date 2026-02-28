'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface Category {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  parentId: string | null;
  fullPath: string | null;
  depth: number;
  sortOrder: number;
  partCount?: number;
  children?: Category[];
}

function CategoryRow({
  category,
  allCategories,
  onEdit,
  onDelete,
  onAddChild,
  depth = 0,
}: {
  category: Category;
  allCategories: Category[];
  onEdit: (cat: Category) => void;
  onDelete: (id: string) => void;
  onAddChild: (parentId: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = category.children && category.children.length > 0;

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-4 py-3" style={{ paddingLeft: `${depth * 24 + 16}px` }}>
          <div className="flex items-center gap-2">
            {hasChildren ? (
              <button
                onClick={() => setExpanded(!expanded)}
                className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600"
              >
                <svg
                  className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <span className="w-5" />
            )}
            <div>
              <div className="font-medium text-gray-900">{category.displayName}</div>
              <div className="text-xs text-gray-500 font-mono">{category.name}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="text-gray-500 text-sm">{category.description || '-'}</span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-gray-600">{category.partCount || 0}</span>
        </td>
        <td className="px-4 py-3 text-center">
          <span className="text-gray-400 text-sm">{category.depth}</span>
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => onAddChild(category.id)}
              className="text-sm text-green-600 hover:text-green-800"
              title="Add subcategory"
            >
              + Sub
            </button>
            <button
              onClick={() => onEdit(category)}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Edit
            </button>
            <button
              onClick={() => onDelete(category.id)}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Delete
            </button>
          </div>
        </td>
      </tr>
      {expanded && hasChildren && category.children!.map((child) => (
        <CategoryRow
          key={child.id}
          category={child}
          allCategories={allCategories}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
          depth={depth + 1}
        />
      ))}
    </>
  );
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [flatCategories, setFlatCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    sortOrder: 0,
    parentId: '' as string | null,
  });

  async function fetchCategories() {
    try {
      const [treeRes, flatRes] = await Promise.all([
        fetch('/api/dashboard/super-admin/pcdb/categories?tree=true'),
        fetch('/api/dashboard/super-admin/pcdb/categories'),
      ]);
      const treeData = await treeRes.json();
      const flatData = await flatRes.json();
      if (treeData.success) {
        setCategories(treeData.data || []);
      }
      if (flatData.success) {
        setFlatCategories(flatData.data || []);
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

  const openCreateModal = (parentId?: string) => {
    setEditingCategory(null);
    setFormData({
      name: '',
      displayName: '',
      description: '',
      sortOrder: flatCategories.length,
      parentId: parentId || null,
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
      parentId: category.parentId,
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
          parentId: formData.parentId || null,
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
    if (!confirm('Are you sure you want to delete this category? Subcategories will be orphaned.')) return;

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

  const getParentOptions = (excludeId?: string) => {
    return flatCategories.filter((c) => c.id !== excludeId);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Categories</h1>
          <p className="text-sm text-gray-500 mt-1">Manage part categories with nested hierarchy</p>
        </div>
        <Button onClick={() => openCreateModal()}>+ Add Category</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : categories.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No categories found. Add your first category to organize parts.
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Category</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Description</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Parts</th>
                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">Depth</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {categories.map((category) => (
                <CategoryRow
                  key={category.id}
                  category={category}
                  allCategories={flatCategories}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  onAddChild={openCreateModal}
                />
              ))}
            </tbody>
          </table>
        )}
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
                Parent Category
              </label>
              <select
                value={formData.parentId || ''}
                onChange={(e) => setFormData({ ...formData, parentId: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">None (Root Category)</option>
                {getParentOptions(editingCategory?.id).map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {'—'.repeat(cat.depth)} {cat.displayName}
                  </option>
                ))}
              </select>
            </div>

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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sort Order
                <span
                  className="ml-1 inline-flex items-center justify-center w-4 h-4 text-xs bg-gray-200 text-gray-600 rounded-full cursor-help"
                  title="0 = highest priority (appears first), higher numbers = lower priority (appears later)"
                >
                  ?
                </span>
              </label>
              <input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min={0}
              />
              <p className="text-xs text-gray-500 mt-1">
                0 = top of list (highest priority). Higher numbers appear lower in the list.
              </p>
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
