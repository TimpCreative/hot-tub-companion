'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createSuperAdminApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SearchInput } from '@/components/ui/SearchInput';
import { Modal } from '@/components/ui/Modal';
import { stripHtml } from '@/components/content/RichTextEditor';
import {
  ContentEditorModal,
  type ContentCategoryOption,
  type ContentItemDraft,
  type LookupOption,
} from '@/components/content/ContentEditorModal';

interface ContentTarget {
  targetType: 'brand' | 'model_line' | 'spa_model' | 'sanitation_system' | 'part_category';
  targetEntityId?: string | null;
  targetValue?: string | null;
  isExclusion?: boolean;
}

interface ContentItem {
  id: string;
  title: string;
  slug: string;
  scope: 'universal' | 'retailer';
  contentType: 'article' | 'video';
  videoFormat: 'masterclass' | 'clip' | null;
  summary: string | null;
  bodyMarkdown: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  author: string | null;
  transcript: string | null;
  hiddenSearchTags: string[];
  hiddenSearchAliases: string[];
  status: 'draft' | 'published' | 'archived';
  priority: number;
  categories: ContentCategoryOption[];
  targets: ContentTarget[];
  updatedAt: string;
}

interface OptionResponseRow {
  id: string;
  name?: string;
  brandName?: string;
  modelLineName?: string;
  year?: number;
}

function lineTextToArray(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function SuperAdminContentPage() {
  const { getIdToken } = useAuth();
  const api = useMemo(() => createSuperAdminApiClient(async () => await getIdToken()), [getIdToken]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [categories, setCategories] = useState<ContentCategoryOption[]>([]);
  const [brands, setBrands] = useState<LookupOption[]>([]);
  const [modelLines, setModelLines] = useState<LookupOption[]>([]);
  const [spas, setSpas] = useState<LookupOption[]>([]);
  const [partCategories, setPartCategories] = useState<LookupOption[]>([]);
  const [sanitationSystems, setSanitationSystems] = useState<Array<{ value: string; displayName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');
  const [format, setFormat] = useState('');
  const [status, setStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [newCategoryLabel, setNewCategoryLabel] = useState('');
  const [editingCategory, setEditingCategory] = useState<{ id: string; label: string; key: string } | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [updatingCategory, setUpdatingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, categoriesRes, brandsRes, modelLinesRes, spasRes, partCategoriesRes, qualifiersRes] = await Promise.all([
        api.get('/content', {
          params: {
            search: search || undefined,
            category: category || undefined,
            type: type || undefined,
            format: format || undefined,
            status: status || undefined,
            scope: 'all',
          },
        }),
        api.get('/content/categories'),
        api.get('/scdb/brands?page=1&pageSize=500'),
        api.get('/scdb/model-lines'),
        api.get('/scdb/spa-models?page=1&pageSize=500'),
        api.get('/pcdb/categories'),
        api.get('/qdb/qualifiers'),
      ]);

      setItems(itemsRes.data ?? []);
      setCategories(categoriesRes.data ?? []);
      setBrands((brandsRes.data ?? []).map((row: OptionResponseRow) => ({ id: row.id, name: row.name ?? row.id })));
      setModelLines((modelLinesRes.data ?? []).map((row: OptionResponseRow) => ({ id: row.id, name: row.name ?? row.id })));
      setSpas(
        (spasRes.data ?? []).map((row: OptionResponseRow) => ({
          id: row.id,
          name: `${row.brandName ?? ''} ${row.modelLineName ?? ''} ${row.name ?? ''} ${row.year ?? ''}`.replace(/\s+/g, ' ').trim(),
        }))
      );
      setPartCategories(
        (partCategoriesRes.data ?? []).map((row: OptionResponseRow) => ({
          id: row.id,
          name: row.name ?? row.id,
        }))
      );
      const qualifier = (qualifiersRes.data ?? []).find(
        (entry: { name?: string }) => entry.name === 'sanitation_system' || entry.name === 'sanitization_system'
      );
      setSanitationSystems(
        Array.isArray(qualifier?.allowedValues)
          ? qualifier.allowedValues.map((option: { value: string; displayName?: string }) => ({
              value: option.value,
              displayName: option.displayName || option.value,
            }))
          : []
      );
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? (err as { error?: { message?: string } }).error?.message
          : 'Failed to load content library';
      setError(message ?? 'Failed to load content library');
    } finally {
      setLoading(false);
    }
  }, [api, category, format, search, status, type]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(item: ContentItem) {
    setEditing(item);
    setModalOpen(true);
  }

  async function save(draft: ContentItemDraft) {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: draft.title,
        slug: draft.slug,
        summary: draft.summary,
        contentType: draft.contentType,
        bodyMarkdown: draft.bodyMarkdown,
        videoUrl: draft.videoUrl,
        videoProvider: draft.contentType === 'video' ? 'youtube' : null,
        thumbnailUrl: draft.thumbnailUrl,
        author: draft.author,
        videoFormat: draft.videoFormat || null,
        transcript: draft.transcript,
        hiddenSearchTags: lineTextToArray(draft.hiddenSearchTags),
        hiddenSearchAliases: lineTextToArray(draft.hiddenSearchAliases),
        status: draft.status,
        isPublished: draft.status === 'published',
        priority: draft.priority,
        categoryKeys: draft.categoryKeys,
        targets: draft.targets,
      };

      if (editing) {
        await api.put(`/content/${editing.id}`, payload);
      } else {
        await api.post('/content', payload);
      }

      setModalOpen(false);
      setEditing(null);
      await load();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? (err as { error?: { message?: string } }).error?.message
          : 'Failed to save content';
      setError(message ?? 'Failed to save content');
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: ContentItem) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    try {
      await api.delete(`/content/${item.id}`);
      await load();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? (err as { error?: { message?: string } }).error?.message
          : 'Failed to delete content';
      setError(message ?? 'Failed to delete content');
    }
  }

  async function createCategory() {
    const label = newCategoryLabel.trim();
    if (!label) return;
    setCreatingCategory(true);
    setError(null);
    try {
      await api.post('/content/categories', { label, key: label });
      setNewCategoryLabel('');
      await load();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? (err as { error?: { message?: string } }).error?.message
          : 'Failed to create category';
      setError(message ?? 'Failed to create category');
    } finally {
      setCreatingCategory(false);
    }
  }

  async function saveCategoryEdit() {
    if (!editingCategory) return;
    const label = editingCategory.label.trim();
    const key = editingCategory.key.trim();
    if (!label || !key) return;
    setUpdatingCategory(true);
    setError(null);
    try {
      await api.put(`/content/categories/${editingCategory.id}`, { label, key });
      setEditingCategory(null);
      await load();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? (err as { error?: { message?: string } }).error?.message
          : 'Failed to update category';
      setError(message ?? 'Failed to update category');
    } finally {
      setUpdatingCategory(false);
    }
  }

  async function deleteCategory(categoryId: string) {
    if (!confirm('Delete this category?')) return;
    setDeletingCategoryId(categoryId);
    setError(null);
    try {
      await api.delete(`/content/categories/${categoryId}`);
      if (editingCategory?.id === categoryId) setEditingCategory(null);
      await load();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? (err as { error?: { message?: string } }).error?.message
          : 'Failed to delete category';
      setError(message ?? 'Failed to delete category');
    } finally {
      setDeletingCategoryId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Content Library</h1>
          <p className="text-sm text-gray-500 mt-1">Universal guides and videos for Water Care and future app surfaces.</p>
        </div>
        <Button onClick={openCreate}>+ New Content</Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <div className="grid grid-cols-5 gap-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search title, summary, transcript..." />
        <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((entry) => (
            <option key={entry.id} value={entry.key}>{entry.label}</option>
          ))}
        </select>
        <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          <option value="article">Article</option>
          <option value="video">Video</option>
        </select>
        <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="">All formats</option>
          <option value="masterclass">Masterclass</option>
          <option value="clip">Clip</option>
        </select>
        <select className="rounded-lg border border-gray-300 px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_160px] gap-4 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <div>Content</div>
          <div>Categories</div>
          <div>Targets</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        {loading ? (
          <div className="px-4 py-10 text-sm text-gray-500">Loading content...</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-sm text-gray-500">No content found.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_160px] gap-4 border-t border-gray-100 px-4 py-4 text-sm">
              <div>
                <div className="font-medium text-gray-900">{item.title}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant="info" size="sm">{item.contentType}</Badge>
                  {item.videoFormat ? <Badge variant="default" size="sm">{item.videoFormat}</Badge> : null}
                  <Badge variant={item.scope === 'universal' ? 'success' : 'warning'} size="sm">{item.scope}</Badge>
                </div>
                {item.summary ? <p className="mt-2 text-gray-600 line-clamp-2">{stripHtml(item.summary)}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2 content-start">
                {item.categories.map((entry) => (
                  <Badge key={entry.id} variant="default" size="sm">{entry.label}</Badge>
                ))}
              </div>
              <div className="text-gray-600">
                {item.targets.length === 0 ? 'All audiences' : `${item.targets.length} rule${item.targets.length === 1 ? '' : 's'}`}
              </div>
              <div className="space-y-1">
                <Badge
                  variant={item.status === 'published' ? 'success' : item.status === 'archived' ? 'warning' : 'pending'}
                  size="sm"
                >
                  {item.status}
                </Badge>
                <div className="text-xs text-gray-500">Priority {item.priority}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => openEdit(item)}>Edit</Button>
                <Button variant="danger" size="sm" onClick={() => void remove(item)}>Delete</Button>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen ? (
        <ContentEditorModal
          key={editing?.id ?? 'new'}
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSave={save}
          saving={saving}
          title={editing ? 'Edit Content' : 'New Content'}
          categories={categories}
          existingSlugs={items.filter((item) => item.scope === 'universal').map((item) => item.slug)}
          initialValue={
            editing
              ? {
                  title: editing.title,
                  slug: editing.slug,
                  summary: editing.summary ?? '',
                  contentType: editing.contentType,
                  bodyMarkdown: editing.bodyMarkdown ?? '',
                  videoUrl: editing.videoUrl ?? '',
                  thumbnailUrl: editing.thumbnailUrl ?? '',
                  author: editing.author ?? '',
                  videoFormat: editing.videoFormat ?? '',
                  transcript: editing.transcript ?? '',
                  hiddenSearchTags: editing.hiddenSearchTags.join('\n'),
                  hiddenSearchAliases: editing.hiddenSearchAliases.join('\n'),
                  status: editing.status,
                  priority: editing.priority,
                  categoryKeys: editing.categories.map((entry) => entry.key),
                  targets: editing.targets,
                }
              : undefined
          }
          targetOptions={{
            brands,
            modelLines,
            spas,
            partCategories,
            sanitationSystems,
          }}
          onManageCategories={() => setCategoryModalOpen(true)}
        />
      ) : null}

      <Modal
        isOpen={categoryModalOpen}
        onClose={() => {
          setCategoryModalOpen(false);
          setEditingCategory(null);
        }}
        title="Manage Categories"
        size="xl"
        footer={
          <div className="flex justify-end">
            <Button variant="secondary" onClick={() => {
              setCategoryModalOpen(false);
              setEditingCategory(null);
            }}>
              Done
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1 block text-sm font-medium text-gray-700">New Category</label>
                <input
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  value={newCategoryLabel}
                  onChange={(e) => setNewCategoryLabel(e.target.value)}
                  placeholder="Water Balance"
                />
              </div>
              <Button onClick={() => void createCategory()} loading={creatingCategory} disabled={!newCategoryLabel.trim()}>
                Add Category
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {categories.map((entry) => {
              const isEditing = editingCategory?.id === entry.id;
              return (
                <div key={entry.id} className="rounded-lg border border-gray-200 p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-700">Label</label>
                          <input
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            value={editingCategory.label}
                            onChange={(e) =>
                              setEditingCategory((current) => (current ? { ...current, label: e.target.value } : current))
                            }
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-gray-700">Key</label>
                          <input
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            value={editingCategory.key}
                            onChange={(e) =>
                              setEditingCategory((current) => (current ? { ...current, key: e.target.value } : current))
                            }
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => void saveCategoryEdit()} loading={updatingCategory}>Save</Button>
                        <Button variant="secondary" onClick={() => setEditingCategory(null)}>Cancel</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-gray-900">{entry.label}</div>
                        <div className="text-sm text-gray-500">{entry.key}</div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditingCategory({ id: entry.id, label: entry.label, key: entry.key })}
                        >
                          Rename
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => void deleteCategory(entry.id)}
                          loading={deletingCategoryId === entry.id}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
}
