'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export type ContentType = 'article' | 'video';
export type ContentStatus = 'draft' | 'published' | 'archived';
export type VideoFormat = 'masterclass' | 'clip';
export type TargetType = 'brand' | 'model_line' | 'spa_model' | 'sanitation_system';

export interface ContentCategoryOption {
  id: string;
  key: string;
  label: string;
}

export interface ContentTargetDraft {
  targetType: TargetType;
  targetEntityId?: string | null;
  targetValue?: string | null;
  isExclusion?: boolean;
}

export interface ContentItemDraft {
  title: string;
  slug: string;
  summary: string;
  contentType: ContentType;
  bodyMarkdown: string;
  videoUrl: string;
  thumbnailUrl: string;
  author: string;
  videoFormat: VideoFormat | '';
  transcript: string;
  hiddenSearchTags: string;
  hiddenSearchAliases: string;
  status: ContentStatus;
  priority: number;
  categoryKeys: string[];
  targets: ContentTargetDraft[];
}

export interface LookupOption {
  id: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: ContentItemDraft) => Promise<void> | void;
  saving?: boolean;
  title: string;
  categories: ContentCategoryOption[];
  initialValue?: Partial<ContentItemDraft> | null;
  targetOptions?: {
    brands?: LookupOption[];
    modelLines?: LookupOption[];
    spas?: LookupOption[];
    sanitationSystems?: Array<{ value: string; displayName: string }>;
    allowedTargetTypes?: TargetType[];
  };
}

const EMPTY_DRAFT: ContentItemDraft = {
  title: '',
  slug: '',
  summary: '',
  contentType: 'article',
  bodyMarkdown: '',
  videoUrl: '',
  thumbnailUrl: '',
  author: '',
  videoFormat: '',
  transcript: '',
  hiddenSearchTags: '',
  hiddenSearchAliases: '',
  status: 'draft',
  priority: 0,
  categoryKeys: [],
  targets: [],
};

function buildInitialDraft(initialValue?: Partial<ContentItemDraft> | null): ContentItemDraft {
  return {
    ...EMPTY_DRAFT,
    ...initialValue,
    categoryKeys: initialValue?.categoryKeys ?? [],
    targets: initialValue?.targets ?? [],
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function ContentEditorModal({
  isOpen,
  onClose,
  onSave,
  saving = false,
  title,
  categories,
  initialValue,
  targetOptions,
}: Props) {
  const [draft, setDraft] = useState<ContentItemDraft>(() => buildInitialDraft(initialValue));
  const [error, setError] = useState<string | null>(null);

  const allowedTargetTypes = useMemo<TargetType[]>(
    () => targetOptions?.allowedTargetTypes ?? ['brand', 'model_line', 'spa_model', 'sanitation_system'],
    [targetOptions?.allowedTargetTypes]
  );

  function update<K extends keyof ContentItemDraft>(key: K, value: ContentItemDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function toggleCategory(categoryKey: string) {
    setDraft((current) => ({
      ...current,
      categoryKeys: current.categoryKeys.includes(categoryKey)
        ? current.categoryKeys.filter((key) => key !== categoryKey)
        : [...current.categoryKeys, categoryKey],
    }));
  }

  function addTarget() {
    const firstType: TargetType = allowedTargetTypes[0] ?? 'sanitation_system';
    setDraft((current) => ({
      ...current,
      targets: [...current.targets, { targetType: firstType }],
    }));
  }

  function updateTarget(index: number, next: Partial<ContentTargetDraft>) {
    setDraft((current) => ({
      ...current,
      targets: current.targets.map((target, targetIndex) =>
        targetIndex === index ? { ...target, ...next } : target
      ),
    }));
  }

  function removeTarget(index: number) {
    setDraft((current) => ({
      ...current,
      targets: current.targets.filter((_, targetIndex) => targetIndex !== index),
    }));
  }

  async function handleSave() {
    if (!draft.title.trim()) {
      setError('Title is required');
      return;
    }
    if (!draft.slug.trim()) {
      setError('Slug is required');
      return;
    }
    if (draft.categoryKeys.length === 0) {
      setError('Choose at least one category');
      return;
    }
    if (draft.contentType === 'article' && !draft.bodyMarkdown.trim()) {
      setError('Article body is required');
      return;
    }
    if (draft.contentType === 'video' && !draft.videoUrl.trim()) {
      setError('Video URL is required');
      return;
    }

    setError(null);
    await onSave(draft);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="2xl"
      footer={
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-red-600">{error}</div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={() => void handleSave()} loading={saving}>Save</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={draft.title}
              onChange={(e) => update('title', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
            <div className="flex gap-2">
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={draft.slug}
                onChange={(e) => update('slug', e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => update('slug', slugify(draft.title))}
              >
                Generate
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={draft.contentType}
              onChange={(e) => update('contentType', e.target.value as ContentType)}
            >
              <option value="article">Article</option>
              <option value="video">Video</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={draft.status}
              onChange={(e) => update('status', e.target.value as ContentStatus)}
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <input
              type="number"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={draft.priority}
              onChange={(e) => update('priority', Number(e.target.value || 0))}
            />
          </div>
          {draft.contentType === 'video' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={draft.videoFormat}
                onChange={(e) => update('videoFormat', e.target.value as VideoFormat | '')}
              >
                <option value="">None</option>
                <option value="masterclass">Masterclass</option>
                <option value="clip">Clip</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Read time</label>
              <div className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500">
                Optional in future
              </div>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Summary</label>
          <textarea
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[90px]"
            value={draft.summary}
            onChange={(e) => update('summary', e.target.value)}
          />
        </div>

        {draft.contentType === 'article' ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Body Markdown</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[220px] font-mono"
              value={draft.bodyMarkdown}
              onChange={(e) => update('bodyMarkdown', e.target.value)}
            />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Video URL</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={draft.videoUrl}
                onChange={(e) => update('videoUrl', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thumbnail URL</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={draft.thumbnailUrl}
                onChange={(e) => update('thumbnailUrl', e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Author</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              value={draft.author}
              onChange={(e) => update('author', e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Transcript</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[90px]"
              value={draft.transcript}
              onChange={(e) => update('transcript', e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hidden Search Tags</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[80px]"
              value={draft.hiddenSearchTags}
              onChange={(e) => update('hiddenSearchTags', e.target.value)}
              placeholder="One per line"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hidden Search Aliases</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm min-h-[80px]"
              value={draft.hiddenSearchAliases}
              onChange={(e) => update('hiddenSearchAliases', e.target.value)}
              placeholder="One per line"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const selected = draft.categoryKeys.includes(category.key);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.key)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    selected
                      ? 'border-blue-600 bg-blue-50 text-blue-700'
                      : 'border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  {category.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Targets</h3>
              <p className="text-xs text-gray-500">Leave empty to make this content broadly applicable.</p>
            </div>
            <Button type="button" variant="secondary" onClick={addTarget}>+ Add Target</Button>
          </div>
          {draft.targets.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
              No targeting rules yet.
            </div>
          ) : (
            <div className="space-y-3">
              {draft.targets.map((target, index) => (
                <div key={`${target.targetType}-${index}`} className="rounded-lg border border-gray-200 p-4">
                  <div className="grid grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                      <select
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        value={target.targetType}
                        onChange={(e) =>
                          updateTarget(index, {
                            targetType: e.target.value as TargetType,
                            targetEntityId: null,
                            targetValue: null,
                          })
                        }
                      >
                        {allowedTargetTypes.map((type) => (
                          <option key={type} value={type}>
                            {type.replace('_', ' ')}
                          </option>
                        ))}
                      </select>
                    </div>

                    {target.targetType === 'sanitation_system' ? (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Value</label>
                        <select
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          value={target.targetValue ?? ''}
                          onChange={(e) => updateTarget(index, { targetValue: e.target.value || null })}
                        >
                          <option value="">Select</option>
                          {(targetOptions?.sanitationSystems ?? []).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.displayName}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Entity</label>
                        <select
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          value={target.targetEntityId ?? ''}
                          onChange={(e) => updateTarget(index, { targetEntityId: e.target.value || null })}
                        >
                          <option value="">Select</option>
                          {((target.targetType === 'brand'
                            ? targetOptions?.brands
                            : target.targetType === 'model_line'
                              ? targetOptions?.modelLines
                              : targetOptions?.spas) ?? []
                          ).map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="flex items-center gap-2 pb-2">
                      <input
                        id={`exclude-${index}`}
                        type="checkbox"
                        checked={!!target.isExclusion}
                        onChange={(e) => updateTarget(index, { isExclusion: e.target.checked })}
                      />
                      <label htmlFor={`exclude-${index}`} className="text-sm text-gray-700">
                        Exclusion
                      </label>
                    </div>

                    <div className="flex justify-end">
                      <Button type="button" variant="danger" onClick={() => removeTarget(index)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
