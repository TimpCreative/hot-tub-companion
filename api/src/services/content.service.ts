import { db } from '../config/database';

export type ContentType = 'article' | 'video';
export type ContentScope = 'universal' | 'retailer';
export type ContentStatus = 'draft' | 'published' | 'archived';
export type VideoFormat = 'masterclass' | 'clip';
export type ContentTargetType =
  | 'brand'
  | 'model_line'
  | 'spa_model'
  | 'sanitation_system'
  | 'part'
  | 'part_category'
  | 'qualifier';

export interface ContentCategory {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface CreateContentCategoryInput {
  key: string;
  label: string;
}

export interface UpdateContentCategoryInput {
  key?: string;
  label?: string;
}

export interface ContentTarget {
  id?: string;
  targetType: ContentTargetType;
  targetEntityId?: string | null;
  targetValue?: string | null;
  isExclusion?: boolean;
}

export interface ContentItem {
  id: string;
  tenantId: string | null;
  scope: ContentScope;
  title: string;
  slug: string;
  contentType: ContentType;
  summary: string | null;
  bodyMarkdown: string | null;
  videoProvider: string | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  author: string | null;
  videoFormat: VideoFormat | null;
  parentContentId: string | null;
  hiddenSearchTags: string[];
  hiddenSearchAliases: string[];
  transcript: string | null;
  status: ContentStatus;
  priority: number;
  isPublished: boolean;
  publishedAt: Date | null;
  readTimeMinutes: number | null;
  viewCount: number;
  categories: ContentCategory[];
  targets: ContentTarget[];
  isSuppressed?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ContentWriteInput {
  title: string;
  slug: string;
  contentType: ContentType;
  summary?: string | null;
  bodyMarkdown?: string | null;
  videoProvider?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  author?: string | null;
  videoFormat?: VideoFormat | null;
  parentContentId?: string | null;
  hiddenSearchTags?: string[];
  hiddenSearchAliases?: string[];
  transcript?: string | null;
  status?: ContentStatus;
  priority?: number;
  isPublished?: boolean;
  publishedAt?: string | null;
  readTimeMinutes?: number | null;
  categoryKeys: string[];
  targets?: ContentTarget[];
}

interface ContentItemRow {
  id: string;
  tenant_id: string | null;
  scope: ContentScope;
  title: string;
  slug: string;
  content_type: ContentType;
  summary: string | null;
  body_markdown: string | null;
  video_provider: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
  author: string | null;
  video_format: VideoFormat | null;
  parent_content_id: string | null;
  hidden_search_tags: string[] | null;
  hidden_search_aliases: string[] | null;
  transcript: string | null;
  status: ContentStatus;
  priority: number;
  is_published: boolean;
  published_at: Date | null;
  read_time_minutes: number | null;
  view_count: number;
  created_at: Date;
  updated_at: Date;
}

interface ContentCategoryRow {
  id: string;
  key: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

interface ContentCategoryLinkRow {
  content_item_id: string;
  category_id: string;
}

interface ContentTargetRow {
  id: string;
  content_item_id: string;
  target_type: ContentTargetType;
  target_entity_id: string | null;
  target_value: string | null;
  is_exclusion: boolean;
}

interface SpaContentContext {
  spaProfileId: string;
  tenantId: string;
  brandId: string | null;
  modelLineId: string | null;
  spaModelId: string | null;
  sanitizationSystem: string | null;
}

interface ListFilters {
  tenantId?: string;
  includeUniversal?: boolean;
  category?: string | null;
  contentType?: ContentType | null;
  videoFormat?: VideoFormat | null;
  status?: ContentStatus | null;
  scope?: ContentScope | 'all' | null;
  search?: string | null;
  includeSuppressedForTenantId?: string | null;
}

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean);
}

function normalizeNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isPgUniqueViolation(err: unknown, constraintNamePart: string) {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code?: unknown }).code ?? '') : '';
  const constraint = 'constraint' in err ? String((err as { constraint?: unknown }).constraint ?? '') : '';
  return code === '23505' && constraint.includes(constraintNamePart);
}

async function assertSlugAvailable(tenantId: string | null, slug: string, excludeId?: string) {
  const normalizedSlug = slug.trim();
  let query = db('content_items').where({ slug: normalizedSlug });

  if (tenantId) {
    query = query.where({ tenant_id: tenantId });
  } else {
    query = query.whereNull('tenant_id');
  }

  if (excludeId) {
    query = query.whereNot({ id: excludeId });
  }

  const existing = await query.first();
  if (existing) {
    throw new Error('Slug already exists');
  }
}

function mapCategory(row: ContentCategoryRow): ContentCategory {
  return {
    id: row.id,
    key: row.key,
    label: row.label,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

function mapTarget(row: ContentTargetRow): ContentTarget {
  return {
    id: row.id,
    targetType: row.target_type,
    targetEntityId: row.target_entity_id,
    targetValue: row.target_value,
    isExclusion: row.is_exclusion,
  };
}

function mapItem(
  row: ContentItemRow,
  categoryRows: ContentCategoryRow[],
  categoryLinks: ContentCategoryLinkRow[],
  targetRows: ContentTargetRow[],
  suppressedIds: Set<string>
): ContentItem {
  const categoryMap = new Map(categoryRows.map((category) => [category.id, mapCategory(category)]));
  const categories = categoryLinks
    .filter((link) => link.content_item_id === row.id)
    .map((link) => categoryMap.get(link.category_id))
    .filter((category): category is ContentCategory => !!category)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));

  return {
    id: row.id,
    tenantId: row.tenant_id,
    scope: row.scope,
    title: row.title,
    slug: row.slug,
    contentType: row.content_type,
    summary: row.summary,
    bodyMarkdown: row.body_markdown,
    videoProvider: row.video_provider,
    videoUrl: row.video_url,
    thumbnailUrl: row.thumbnail_url,
    author: row.author,
    videoFormat: row.video_format,
    parentContentId: row.parent_content_id,
    hiddenSearchTags: row.hidden_search_tags ?? [],
    hiddenSearchAliases: row.hidden_search_aliases ?? [],
    transcript: row.transcript,
    status: row.status,
    priority: row.priority,
    isPublished: row.is_published,
    publishedAt: row.published_at,
    readTimeMinutes: row.read_time_minutes,
    viewCount: row.view_count,
    categories,
    targets: targetRows.filter((target) => target.content_item_id === row.id).map(mapTarget),
    isSuppressed: suppressedIds.has(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listCategoriesRaw(): Promise<ContentCategoryRow[]> {
  return (await db('content_categories').where({ is_active: true }).orderBy('sort_order').orderBy('label')) as ContentCategoryRow[];
}

async function getSpaContentContext(spaProfileId: string, tenantId: string, userId: string): Promise<SpaContentContext | null> {
  const row = await db('spa_profiles as sp')
    .leftJoin('scdb_spa_models as spa_model', 'sp.uhtd_spa_model_id', 'spa_model.id')
    .select(
      'sp.id as spaProfileId',
      'sp.tenant_id as tenantId',
      'sp.uhtd_spa_model_id as spaModelId',
      'sp.sanitization_system as sanitizationSystem',
      'spa_model.brand_id as brandId',
      'spa_model.model_line_id as modelLineId'
    )
    .where('sp.id', spaProfileId)
    .andWhere('sp.tenant_id', tenantId)
    .andWhere('sp.user_id', userId)
    .first();

  return (row as SpaContentContext | undefined) ?? null;
}

async function listContentInternal(filters: ListFilters): Promise<ContentItem[]> {
  let query = db('content_items').select('*');

  if (filters.scope && filters.scope !== 'all') {
    query = query.where('scope', filters.scope);
  }

  if (filters.tenantId) {
    if (filters.includeUniversal) {
      query = query.where((builder) =>
        builder.where('tenant_id', filters.tenantId!).orWhere('scope', 'universal')
      );
    } else {
      query = query.where('tenant_id', filters.tenantId);
    }
  }

  if (filters.status) {
    query = query.where('status', filters.status);
  }

  if (filters.contentType) {
    query = query.where('content_type', filters.contentType);
  }

  if (filters.videoFormat) {
    query = query.where('video_format', filters.videoFormat);
  }

  const items = (await query.orderBy('updated_at', 'desc')) as ContentItemRow[];
  if (items.length === 0) return [];

  const itemIds = items.map((item) => item.id);
  const categoryRows = await listCategoriesRaw();
  const categoryLinks = (await db('content_item_categories')
    .select('content_item_id', 'category_id')
    .whereIn('content_item_id', itemIds)) as ContentCategoryLinkRow[];
  const targetRows = (await db('content_targets')
    .select('*')
    .whereIn('content_item_id', itemIds)) as ContentTargetRow[];

  const suppressedIds =
    filters.includeSuppressedForTenantId == null
      ? new Set<string>()
      : new Set(
          (
            await db('tenant_content_suppressions')
              .select('content_item_id')
              .where({ tenant_id: filters.includeSuppressedForTenantId })
              .whereIn('content_item_id', itemIds)
          ).map((row: { content_item_id: string }) => row.content_item_id)
        );

  let mapped = items.map((item) => mapItem(item, categoryRows, categoryLinks, targetRows, suppressedIds));

  if (filters.category) {
    mapped = mapped.filter((item) => item.categories.some((category) => category.key === filters.category));
  }

  if (filters.search) {
    const search = filters.search.toLowerCase().trim();
    mapped = mapped.filter((item) =>
      [
        item.title,
        item.summary ?? '',
        item.transcript ?? '',
        ...(item.hiddenSearchTags ?? []),
        ...(item.hiddenSearchAliases ?? []),
      ]
        .join(' \n ')
        .toLowerCase()
        .includes(search)
    );
  }

  return mapped;
}

function targetTypeMatches(item: ContentItem, context: SpaContentContext): boolean {
  const groups = new Map<ContentTargetType, ContentTarget[]>();
  for (const target of item.targets) {
    const list = groups.get(target.targetType) ?? [];
    list.push(target);
    groups.set(target.targetType, list);
  }

  for (const [targetType, targets] of groups.entries()) {
    const inclusive = targets.filter((target) => !target.isExclusion);
    const exclusions = targets.filter((target) => !!target.isExclusion);

    const entityValue =
      targetType === 'brand'
        ? context.brandId
        : targetType === 'model_line'
          ? context.modelLineId
          : targetType === 'spa_model'
            ? context.spaModelId
            : null;
    const stringValue = targetType === 'sanitation_system' ? context.sanitizationSystem : null;

    const matchesTarget = (target: ContentTarget) => {
      if (target.targetEntityId) return target.targetEntityId === entityValue;
      if (target.targetValue) return target.targetValue === stringValue;
      return false;
    };

    if (inclusive.length > 0 && !inclusive.some(matchesTarget)) {
      return false;
    }

    if (exclusions.some(matchesTarget)) {
      return false;
    }
  }

  return true;
}

function computeSearchScore(item: ContentItem, search: string | null | undefined): number {
  if (!search) return 0;
  const query = search.toLowerCase().trim();
  if (!query) return 0;

  let score = 0;
  const title = item.title.toLowerCase();
  const summary = (item.summary ?? '').toLowerCase();
  const transcript = (item.transcript ?? '').toLowerCase();
  const tags = item.hiddenSearchTags.join(' ').toLowerCase();
  const aliases = item.hiddenSearchAliases.join(' ').toLowerCase();

  if (tags.includes(query)) score += 120;
  if (aliases.includes(query)) score += 110;
  if (title.includes(query)) score += 90;
  if (summary.includes(query)) score += 50;
  if (transcript.includes(query)) score += 20;

  return score;
}

function computeContextScore(item: ContentItem, context: SpaContentContext | null): number {
  if (!context) return 0;
  let score = 0;
  for (const target of item.targets) {
    if (target.isExclusion) continue;
    if (target.targetType === 'spa_model' && target.targetEntityId === context.spaModelId) score += 80;
    if (target.targetType === 'model_line' && target.targetEntityId === context.modelLineId) score += 60;
    if (target.targetType === 'brand' && target.targetEntityId === context.brandId) score += 30;
    if (target.targetType === 'sanitation_system' && target.targetValue === context.sanitizationSystem) score += 50;
  }
  return score;
}

function dedupeBySlug(items: ContentItem[]): ContentItem[] {
  const map = new Map<string, ContentItem>();
  for (const item of items) {
    const existing = map.get(item.slug);
    if (!existing) {
      map.set(item.slug, item);
      continue;
    }
    const existingScopeScore = existing.scope === 'retailer' ? 1 : 0;
    const itemScopeScore = item.scope === 'retailer' ? 1 : 0;
    if (itemScopeScore > existingScopeScore) {
      map.set(item.slug, item);
      continue;
    }
    if (itemScopeScore === existingScopeScore) {
      if (item.priority > existing.priority) {
        map.set(item.slug, item);
        continue;
      }
      if ((item.publishedAt?.getTime() ?? 0) > (existing.publishedAt?.getTime() ?? 0)) {
        map.set(item.slug, item);
      }
    }
  }
  return [...map.values()];
}

async function syncCategories(trx: any, contentId: string, categoryKeys: string[]) {
  const categories = await trx('content_categories').select('id', 'key').whereIn('key', categoryKeys);
  if (categories.length !== categoryKeys.length) {
    const found = new Set(categories.map((row: { key: string }) => row.key));
    const missing = categoryKeys.filter((key) => !found.has(key));
    throw new Error(`Unknown category keys: ${missing.join(', ')}`);
  }

  await trx('content_item_categories').where({ content_item_id: contentId }).del();
  if (categories.length > 0) {
    await trx('content_item_categories').insert(
      categories.map((category: { id: string }) => ({
        content_item_id: contentId,
        category_id: category.id,
      }))
    );
  }
}

async function syncTargets(trx: any, contentId: string, targets: ContentTarget[]) {
  await trx('content_targets').where({ content_item_id: contentId }).del();
  const cleanTargets = targets.filter((target) => {
    if (!target.targetType) return false;
    return !!target.targetEntityId || !!target.targetValue;
  });
  if (cleanTargets.length === 0) return;
  await trx('content_targets').insert(
    cleanTargets.map((target) => ({
      content_item_id: contentId,
      target_type: target.targetType,
      target_entity_id: target.targetEntityId ?? null,
      target_value: target.targetValue ?? null,
      is_exclusion: !!target.isExclusion,
    }))
  );
}

function validateInput(input: ContentWriteInput) {
  if (!input.title?.trim()) throw new Error('Title is required');
  if (!input.slug?.trim()) throw new Error('Slug is required');
  if (!input.contentType || !['article', 'video'].includes(input.contentType)) {
    throw new Error('contentType must be article or video');
  }
  if (!Array.isArray(input.categoryKeys) || input.categoryKeys.length === 0) {
    throw new Error('At least one category is required');
  }
  if (input.contentType === 'article' && !normalizeNullableString(input.bodyMarkdown)) {
    throw new Error('Article body is required');
  }
  if (input.contentType === 'video' && !normalizeNullableString(input.videoUrl)) {
    throw new Error('Video URL is required');
  }
}

function buildWriteRow(
  tenantId: string | null,
  scope: ContentScope,
  input: ContentWriteInput
) {
  const publishedAt =
    input.publishedAt != null
      ? new Date(input.publishedAt)
      : input.isPublished || input.status === 'published'
        ? new Date()
        : null;

  return {
    tenant_id: tenantId,
    scope,
    title: input.title.trim(),
    slug: input.slug.trim(),
    content_type: input.contentType,
    summary: normalizeNullableString(input.summary),
    body_markdown: input.contentType === 'article' ? normalizeNullableString(input.bodyMarkdown) : null,
    video_provider: input.contentType === 'video' ? normalizeNullableString(input.videoProvider) ?? 'youtube' : null,
    video_url: input.contentType === 'video' ? normalizeNullableString(input.videoUrl) : null,
    thumbnail_url: normalizeNullableString(input.thumbnailUrl),
    author: normalizeNullableString(input.author),
    video_format: input.contentType === 'video' ? (input.videoFormat ?? null) : null,
    parent_content_id: input.parentContentId ?? null,
    hidden_search_tags: normalizeStringList(input.hiddenSearchTags),
    hidden_search_aliases: normalizeStringList(input.hiddenSearchAliases),
    transcript: normalizeNullableString(input.transcript),
    status: input.status ?? (input.isPublished ? 'published' : 'draft'),
    priority: Number.isFinite(input.priority) ? Number(input.priority) : 0,
    is_published: !!input.isPublished || input.status === 'published',
    published_at: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
    read_time_minutes:
      input.readTimeMinutes == null || input.readTimeMinutes === 0 ? null : Number(input.readTimeMinutes),
    updated_at: db.fn.now(),
  };
}

export async function listCategories(): Promise<ContentCategory[]> {
  return (await listCategoriesRaw()).map(mapCategory);
}

export async function createCategory(input: CreateContentCategoryInput): Promise<ContentCategory> {
  const key = input.key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const label = input.label.trim();
  if (!key) throw new Error('Category key is required');
  if (!label) throw new Error('Category label is required');

  const existing = await db('content_categories').where({ key }).first();
  if (existing) throw new Error('Category key already exists');

  const [{ max }] = (await db('content_categories').max('sort_order as max')) as Array<{ max: number | string | null }>;
  const [created] = await db('content_categories')
    .insert({
      key,
      label,
      sort_order: Number(max ?? 0) + 1,
      is_active: true,
    })
    .returning('*');

  return mapCategory(created as ContentCategoryRow);
}

export async function updateCategory(id: string, input: UpdateContentCategoryInput): Promise<ContentCategory | null> {
  const existing = (await db('content_categories').where({ id }).first()) as ContentCategoryRow | undefined;
  if (!existing) return null;

  const key =
    input.key == null
      ? existing.key
      : input.key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const label = input.label == null ? existing.label : input.label.trim();

  if (!key) throw new Error('Category key is required');
  if (!label) throw new Error('Category label is required');

  const duplicate = await db('content_categories').where({ key }).whereNot({ id }).first();
  if (duplicate) throw new Error('Category key already exists');

  const [updated] = await db('content_categories')
    .where({ id })
    .update({
      key,
      label,
    })
    .returning('*');

  return mapCategory(updated as ContentCategoryRow);
}

export async function deleteCategory(id: string): Promise<boolean> {
  const linked = await db('content_item_categories').where({ category_id: id }).first();
  if (linked) {
    throw new Error('Cannot delete a category that is still assigned to content');
  }

  const deleted = await db('content_categories').where({ id }).del();
  return deleted > 0;
}

export async function listCustomerContent(params: {
  tenantId: string;
  userId: string;
  spaProfileId?: string | null;
  category?: string | null;
  contentType?: ContentType | null;
  search?: string | null;
}): Promise<ContentItem[]> {
  const items = await listContentInternal({
    tenantId: params.tenantId,
    includeUniversal: true,
    category: params.category,
    contentType: params.contentType,
    status: 'published',
    includeSuppressedForTenantId: params.tenantId,
    search: params.search,
  });

  const spaContext = params.spaProfileId
    ? await getSpaContentContext(params.spaProfileId, params.tenantId, params.userId)
    : null;

  const filtered = items
    .filter((item) => !item.isSuppressed)
    .filter((item) => !spaContext || targetTypeMatches(item, spaContext));

  return dedupeBySlug(filtered).sort((a, b) => {
    const searchDelta = computeSearchScore(b, params.search) - computeSearchScore(a, params.search);
    if (searchDelta !== 0) return searchDelta;
    const contextDelta = computeContextScore(b, spaContext) - computeContextScore(a, spaContext);
    if (contextDelta !== 0) return contextDelta;
    const scopeDelta = (b.scope === 'retailer' ? 1 : 0) - (a.scope === 'retailer' ? 1 : 0);
    if (scopeDelta !== 0) return scopeDelta;
    const priorityDelta = b.priority - a.priority;
    if (priorityDelta !== 0) return priorityDelta;
    return (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0);
  });
}

export async function getCustomerContentById(params: {
  id: string;
  tenantId: string;
  userId: string;
  spaProfileId?: string | null;
}): Promise<ContentItem | null> {
  const items = await listCustomerContent({
    tenantId: params.tenantId,
    userId: params.userId,
    spaProfileId: params.spaProfileId,
  });
  const item = items.find((entry) => entry.id === params.id) ?? null;
  if (item) {
    await db('content_items').where({ id: params.id }).increment('view_count', 1);
    item.viewCount += 1;
  }
  return item;
}

export async function listSuperAdminContent(filters: {
  search?: string | null;
  category?: string | null;
  contentType?: ContentType | null;
  videoFormat?: VideoFormat | null;
  status?: ContentStatus | null;
  scope?: ContentScope | 'all' | null;
}) {
  return listContentInternal({
    category: filters.category,
    contentType: filters.contentType,
    videoFormat: filters.videoFormat,
    status: filters.status,
    scope: filters.scope,
    search: filters.search,
  });
}

export async function createSuperAdminContent(input: ContentWriteInput): Promise<ContentItem> {
  validateInput(input);
  try {
    await assertSlugAvailable(null, input.slug);
    const [row] = await db.transaction(async (trx) => {
      const [inserted] = await trx('content_items')
        .insert({
          ...buildWriteRow(null, 'universal', input),
          created_at: trx.fn.now(),
        })
        .returning('*');
      await syncCategories(trx, inserted.id, input.categoryKeys);
      await syncTargets(trx, inserted.id, input.targets ?? []);
      return [inserted];
    });
    const items = await listSuperAdminContent({});
    return items.find((item) => item.id === row.id)!;
  } catch (err) {
    if (isPgUniqueViolation(err, 'slug')) {
      throw new Error('Slug already exists');
    }
    throw err;
  }
}

export async function updateSuperAdminContent(id: string, input: ContentWriteInput): Promise<ContentItem | null> {
  validateInput(input);
  const existing = await db('content_items').where({ id }).first();
  if (!existing) return null;
  try {
    await assertSlugAvailable(null, input.slug, id);
    await db.transaction(async (trx) => {
      await trx('content_items').where({ id }).update(buildWriteRow(null, 'universal', input));
      await syncCategories(trx, id, input.categoryKeys);
      await syncTargets(trx, id, input.targets ?? []);
    });
  } catch (err) {
    if (isPgUniqueViolation(err, 'slug')) {
      throw new Error('Slug already exists');
    }
    throw err;
  }
  const items = await listSuperAdminContent({});
  return items.find((item) => item.id === id) ?? null;
}

export async function deleteSuperAdminContent(id: string): Promise<boolean> {
  const deleted = await db('content_items').where({ id, scope: 'universal' }).del();
  return deleted > 0;
}

export async function listRetailerContent(params: {
  tenantId: string;
  includeUniversal?: boolean;
  search?: string | null;
  category?: string | null;
  contentType?: ContentType | null;
  videoFormat?: VideoFormat | null;
  status?: ContentStatus | null;
}) {
  return listContentInternal({
    tenantId: params.tenantId,
    includeUniversal: !!params.includeUniversal,
    includeSuppressedForTenantId: params.tenantId,
    search: params.search,
    category: params.category,
    contentType: params.contentType,
    videoFormat: params.videoFormat,
    status: params.status,
  });
}

export async function createRetailerContent(tenantId: string, input: ContentWriteInput): Promise<ContentItem> {
  validateInput(input);
  try {
    await assertSlugAvailable(tenantId, input.slug);
    const [row] = await db.transaction(async (trx) => {
      const [inserted] = await trx('content_items')
        .insert({
          ...buildWriteRow(tenantId, 'retailer', input),
          created_at: trx.fn.now(),
        })
        .returning('*');
      await syncCategories(trx, inserted.id, input.categoryKeys);
      await syncTargets(trx, inserted.id, input.targets ?? []);
      return [inserted];
    });
    const items = await listRetailerContent({ tenantId, includeUniversal: false });
    return items.find((item) => item.id === row.id)!;
  } catch (err) {
    if (isPgUniqueViolation(err, 'slug')) {
      throw new Error('Slug already exists');
    }
    throw err;
  }
}

export async function updateRetailerContent(
  tenantId: string,
  id: string,
  input: ContentWriteInput
): Promise<ContentItem | null> {
  validateInput(input);
  const existing = await db('content_items').where({ id, tenant_id: tenantId, scope: 'retailer' }).first();
  if (!existing) return null;
  try {
    await assertSlugAvailable(tenantId, input.slug, id);
    await db.transaction(async (trx) => {
      await trx('content_items').where({ id }).update(buildWriteRow(tenantId, 'retailer', input));
      await syncCategories(trx, id, input.categoryKeys);
      await syncTargets(trx, id, input.targets ?? []);
    });
  } catch (err) {
    if (isPgUniqueViolation(err, 'slug')) {
      throw new Error('Slug already exists');
    }
    throw err;
  }
  const items = await listRetailerContent({ tenantId, includeUniversal: false });
  return items.find((item) => item.id === id) ?? null;
}

export async function deleteRetailerContent(tenantId: string, id: string): Promise<boolean> {
  const deleted = await db('content_items').where({ id, tenant_id: tenantId, scope: 'retailer' }).del();
  return deleted > 0;
}

export async function setTenantSuppression(
  tenantId: string,
  contentItemId: string,
  suppressed: boolean
): Promise<boolean> {
  const item = await db('content_items').where({ id: contentItemId, scope: 'universal' }).first();
  if (!item) return false;
  if (suppressed) {
    await db('tenant_content_suppressions')
      .insert({ tenant_id: tenantId, content_item_id: contentItemId })
      .onConflict(['tenant_id', 'content_item_id'])
      .ignore();
  } else {
    await db('tenant_content_suppressions')
      .where({ tenant_id: tenantId, content_item_id: contentItemId })
      .del();
  }
  return true;
}
