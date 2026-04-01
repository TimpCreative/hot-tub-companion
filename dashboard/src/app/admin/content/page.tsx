'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SearchInput } from '@/components/ui/SearchInput';
import {
  ContentEditorModal,
  type ContentCategoryOption,
  type ContentItemDraft,
} from '@/components/content/ContentEditorModal';
import { stripHtml } from '@/components/content/RichTextEditor';

interface ContentTarget {
  targetType: 'brand' | 'model_line' | 'spa_model' | 'sanitation_system';
  targetEntityId?: string | null;
  targetValue?: string | null;
  isExclusion?: boolean;
}

interface ContentItem {
  id: string;
  title: string;
  scope: 'universal' | 'retailer';
  contentType: 'article' | 'video';
  summary: string | null;
  bodyMarkdown: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  author: string | null;
  transcript: string | null;
  videoFormat: 'masterclass' | 'clip' | null;
  hiddenSearchTags: string[];
  hiddenSearchAliases: string[];
  status: 'draft' | 'published' | 'archived';
  priority: number;
  slug: string;
  categories: ContentCategoryOption[];
  targets: ContentTarget[];
  isSuppressed?: boolean;
}

function lineTextToArray(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function AdminContentPage() {
  const { getIdToken } = useAuth();
  const { config } = useTenant();
  const api = useMemo(() => createTenantApiClient(async () => await getIdToken()), [getIdToken]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [categories, setCategories] = useState<ContentCategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ContentItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [itemsRes, categoriesRes] = await Promise.all([
        api.get('/admin/content', { params: { includeUniversal: true, search: search || undefined } }),
        api.get('/content/categories'),
      ]);
      setItems(itemsRes.data ?? []);
      setCategories(categoriesRes.data ?? []);
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? (err as { error?: { message?: string } }).error?.message
          : 'Failed to load content';
      setError(message ?? 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [api, search]);

  useEffect(() => {
    void load();
  }, [load]);

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
        await api.put(`/admin/content/${editing.id}`, payload);
      } else {
        await api.post('/admin/content', payload);
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
      await api.delete(`/admin/content/${item.id}`);
      await load();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? (err as { error?: { message?: string } }).error?.message
          : 'Failed to delete content';
      setError(message ?? 'Failed to delete content');
    }
  }

  async function toggleSuppression(item: ContentItem) {
    try {
      await api.put(`/admin/content/${item.id}/suppress`, { suppressed: !item.isSuppressed });
      await load();
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'error' in err
          ? (err as { error?: { message?: string } }).error?.message
          : 'Failed to update suppression';
      setError(message ?? 'Failed to update suppression');
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Content Library</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your tenant’s guides and videos, and hide universal items you do not want customers to see.</p>
        </div>
        <Button onClick={() => { setEditing(null); setModalOpen(true); }}>+ New Content</Button>
      </div>

      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <SearchInput value={search} onChange={setSearch} placeholder="Search content..." className="max-w-xl" />

      <div className="rounded-xl border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_180px] gap-4 bg-gray-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <div>Content</div>
          <div>Categories</div>
          <div>Status</div>
          <div>Actions</div>
        </div>
        {loading ? (
          <div className="px-4 py-10 text-sm text-gray-500">Loading content...</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-10 text-sm text-gray-500">No content found.</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_180px] gap-4 border-t border-gray-100 px-4 py-4 text-sm">
              <div>
                <div className="font-medium text-gray-900">{item.title}</div>
                <div className="mt-1 flex flex-wrap gap-2">
                  <Badge variant={item.scope === 'retailer' ? 'warning' : 'success'} size="sm">{item.scope}</Badge>
                  <Badge variant="info" size="sm">{item.contentType}</Badge>
                  {item.videoFormat ? <Badge variant="default" size="sm">{item.videoFormat}</Badge> : null}
                </div>
                {item.summary ? <p className="mt-2 text-gray-600 line-clamp-2">{stripHtml(item.summary)}</p> : null}
              </div>
              <div className="flex flex-wrap gap-2 content-start">
                {item.categories.map((entry) => (
                  <Badge key={entry.id} variant="default" size="sm">{entry.label}</Badge>
                ))}
              </div>
              <div className="space-y-1">
                <Badge
                  variant={item.status === 'published' ? 'success' : item.status === 'archived' ? 'warning' : 'pending'}
                  size="sm"
                >
                  {item.status}
                </Badge>
                {item.scope === 'universal' && item.isSuppressed ? (
                  <div className="text-xs text-red-600">Hidden for this tenant</div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {item.scope === 'retailer' ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={() => { setEditing(item); setModalOpen(true); }}>Edit</Button>
                    <Button variant="danger" size="sm" onClick={() => void remove(item)}>Delete</Button>
                  </>
                ) : (
                  <Button variant="secondary" size="sm" onClick={() => void toggleSuppression(item)}>
                    {item.isSuppressed ? 'Show' : 'Hide'}
                  </Button>
                )}
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
          title={editing ? 'Edit Retailer Content' : 'New Retailer Content'}
          categories={categories}
          existingSlugs={items.filter((item) => item.scope === 'retailer').map((item) => item.slug)}
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
            sanitationSystems:
              config?.sanitationSystemOptions?.length
                ? config.sanitationSystemOptions
                : (config?.sanitizationSystems ?? []).map((value) => ({ value, displayName: value })),
            allowedTargetTypes: ['sanitation_system'],
          }}
        />
      ) : null}
    </div>
  );
}
