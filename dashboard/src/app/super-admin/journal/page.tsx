'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';

const JOURNAL_BUCKETS = [
  { value: 'notes', label: 'Notes' },
  { value: 'ideas', label: 'Ideas' },
  { value: 'archive', label: 'Archive' },
] as const;

type JournalBucket = (typeof JOURNAL_BUCKETS)[number]['value'];

type JournalEntry = {
  id: string;
  bucket: JournalBucket;
  sortOrder: number;
  title: string;
  content: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

type DraftState = {
  title: string;
  content: string;
  bucket: JournalBucket;
};

const EMPTY_DRAFT: DraftState = {
  title: '',
  content: '',
  bucket: 'notes',
};

export default function SuperAdminJournalPage() {
  const fetchWithAuth = useSuperAdminFetch();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth('/api/dashboard/super-admin/journal');
      const data = await res.json();
      if (data.success && Array.isArray(data.data?.entries)) {
        setEntries(data.data.entries);
      } else {
        setError(data.error?.message || 'Failed to load journal');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load journal');
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const groupedEntries = useMemo(() => {
    return JOURNAL_BUCKETS.reduce<Record<JournalBucket, JournalEntry[]>>(
      (acc, bucket) => {
        acc[bucket.value] = entries
          .filter((entry) => entry.bucket === bucket.value)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        return acc;
      },
      { notes: [], ideas: [], archive: [] }
    );
  }, [entries]);

  const resetDraft = () => {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
  };

  const submitEntry = async () => {
    const title = draft.title.trim();
    const content = draft.content.trim();

    if (!title) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithAuth(
        editingId ? `/api/dashboard/super-admin/journal/${editingId}` : '/api/dashboard/super-admin/journal',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title,
            content,
            bucket: draft.bucket,
          }),
        }
      );
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || 'Failed to save entry');
        return;
      }

      resetDraft();
      await loadEntries();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save entry');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setDraft({
      title: entry.title,
      content: entry.content,
      bucket: entry.bucket,
    });
    setError(null);
  };

  const deleteEntry = async (entry: JournalEntry) => {
    if (!confirm(`Delete "${entry.title}"?`)) {
      return;
    }

    setBusyAction(`delete:${entry.id}`);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/dashboard/super-admin/journal/${entry.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || 'Failed to delete entry');
        return;
      }
      if (editingId === entry.id) {
        resetDraft();
      }
      await loadEntries();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    } finally {
      setBusyAction(null);
    }
  };

  const moveEntry = async (entry: JournalEntry, bucket: JournalBucket) => {
    setBusyAction(`move:${entry.id}`);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/dashboard/super-admin/journal/${entry.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucket }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || 'Failed to move entry');
        return;
      }
      if (editingId === entry.id) {
        setDraft((current) => ({ ...current, bucket }));
      }
      await loadEntries();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to move entry');
    } finally {
      setBusyAction(null);
    }
  };

  const reorderEntry = async (entry: JournalEntry, direction: 'up' | 'down') => {
    setBusyAction(`reorder:${entry.id}:${direction}`);
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/dashboard/super-admin/journal/${entry.id}/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error?.message || 'Failed to reorder entry');
        return;
      }
      await loadEntries();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reorder entry');
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Journal</h2>
          <p className="mt-2 text-gray-600">
            Keep quick notes, capture ideas, and archive older items without losing them.
          </p>
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>}

      <div className="card rounded-lg p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              value={draft.title}
              onChange={(e) => setDraft((current) => ({ ...current, title: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="What do you want to remember?"
              maxLength={255}
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Details</label>
            <textarea
              value={draft.content}
              onChange={(e) => setDraft((current) => ({ ...current, content: e.target.value }))}
              className="min-h-[120px] w-full rounded-lg border border-gray-300 px-3 py-2"
              placeholder="Add context, next steps, links, or rough thoughts."
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Bucket</label>
            <select
              value={draft.bucket}
              onChange={(e) =>
                setDraft((current) => ({ ...current, bucket: e.target.value as JournalBucket }))
              }
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              {JOURNAL_BUCKETS.map((bucket) => (
                <option key={bucket.value} value={bucket.value}>
                  {bucket.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={submitEntry} loading={saving}>
            {editingId ? 'Save Changes' : 'Add Entry'}
          </Button>
          {editingId ? (
            <Button variant="secondary" onClick={resetDraft} disabled={saving}>
              Cancel Edit
            </Button>
          ) : null}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-3">
          {JOURNAL_BUCKETS.map((bucket) => {
            const bucketEntries = groupedEntries[bucket.value];
            return (
              <section key={bucket.value} className="card rounded-lg p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">{bucket.label}</h3>
                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                    {bucketEntries.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {bucketEntries.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                      No entries yet.
                    </div>
                  ) : null}

                  {bucketEntries.map((entry, index) => (
                    <article key={entry.id} className="rounded-lg border border-gray-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="font-medium text-gray-900">{entry.title}</h4>
                          {entry.content ? (
                            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{entry.content}</p>
                          ) : (
                            <p className="mt-2 text-sm italic text-gray-400">No details yet.</p>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 text-xs text-gray-400">
                        Updated {new Date(entry.updatedAt).toLocaleString()}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" onClick={() => startEdit(entry)}>
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => reorderEntry(entry, 'up')}
                          disabled={index === 0 || busyAction !== null}
                        >
                          Up
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => reorderEntry(entry, 'down')}
                          disabled={index === bucketEntries.length - 1 || busyAction !== null}
                        >
                          Down
                        </Button>
                        {JOURNAL_BUCKETS.filter((option) => option.value !== entry.bucket).map((option) => (
                          <Button
                            key={option.value}
                            variant="ghost"
                            size="sm"
                            onClick={() => moveEntry(entry, option.value)}
                            disabled={busyAction !== null}
                          >
                            Move to {option.label}
                          </Button>
                        ))}
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => deleteEntry(entry)}
                          disabled={busyAction !== null}
                        >
                          Delete
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
