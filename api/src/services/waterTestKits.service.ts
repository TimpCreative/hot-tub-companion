import { db } from '../config/database';

export type KitMetricInput = {
  metricKey: string;
  sortOrder?: number;
  inputMode?: 'numeric' | 'color_assist';
  colorScaleJson?: unknown;
  helpCopy?: string | null;
};

export type WaterTestKitInput = {
  slug: string;
  title: string;
  imageUrl?: string | null;
  manufacturer?: string | null;
  status?: 'draft' | 'published';
  effectiveFrom?: string | null;
  reviewStatus?: string | null;
  sourceNotes?: string | null;
  manufacturerDocUrl?: string | null;
  metrics: KitMetricInput[];
};

function mapKit(row: Record<string, unknown>, metrics: Record<string, unknown>[]) {
  return {
    id: row.id as string,
    slug: row.slug as string,
    title: row.title as string,
    imageUrl: (row.image_url as string | null) ?? null,
    manufacturer: (row.manufacturer as string | null) ?? null,
    status: row.status as string,
    effectiveFrom: row.effective_from ? String(row.effective_from) : null,
    reviewStatus: (row.review_status as string | null) ?? null,
    sourceNotes: (row.source_notes as string | null) ?? null,
    manufacturerDocUrl: (row.manufacturer_doc_url as string | null) ?? null,
    createdAt: row.created_at as Date,
    updatedAt: row.updated_at as Date,
    metrics: metrics.map((m) => ({
      id: m.id as string,
      metricKey: m.metric_key as string,
      sortOrder: m.sort_order as number,
      inputMode: m.input_mode as string,
      colorScaleJson: m.color_scale_json ?? null,
      helpCopy: (m.help_copy as string | null) ?? null,
    })),
  };
}

export async function listAllKits(): Promise<ReturnType<typeof mapKit>[]> {
  const kits = await db('water_test_kits').orderBy('title');
  if (kits.length === 0) return [];
  const metrics = await db('water_test_kit_metrics').orderBy('sort_order').orderBy('metric_key');
  return (kits as Record<string, unknown>[]).map((k) =>
    mapKit(
      k,
      (metrics as Record<string, unknown>[]).filter((m) => m.kit_id === k.id)
    )
  );
}

export async function listPublishedKits(): Promise<ReturnType<typeof mapKit>[]> {
  const kits = await db('water_test_kits').where({ status: 'published' }).orderBy('title');
  if (kits.length === 0) return [];
  const ids = (kits as { id: string }[]).map((k) => k.id);
  const metrics = await db('water_test_kit_metrics').whereIn('kit_id', ids).orderBy('sort_order');
  return (kits as Record<string, unknown>[]).map((k) =>
    mapKit(
      k,
      (metrics as Record<string, unknown>[]).filter((m) => m.kit_id === k.id)
    )
  );
}

export async function getKitById(id: string): Promise<ReturnType<typeof mapKit> | null> {
  const row = await db('water_test_kits').where({ id }).first();
  if (!row) return null;
  const metrics = await db('water_test_kit_metrics').where({ kit_id: id }).orderBy('sort_order');
  return mapKit(row as Record<string, unknown>, metrics as Record<string, unknown>[]);
}

export async function getPublishedKitById(id: string): Promise<ReturnType<typeof mapKit> | null> {
  const row = await db('water_test_kits').where({ id, status: 'published' }).first();
  if (!row) return null;
  const metrics = await db('water_test_kit_metrics').where({ kit_id: id }).orderBy('sort_order');
  return mapKit(row as Record<string, unknown>, metrics as Record<string, unknown>[]);
}

async function replaceKitMetrics(trx: typeof db, kitId: string, metrics: KitMetricInput[]): Promise<void> {
  await trx('water_test_kit_metrics').where({ kit_id: kitId }).del();
  if (metrics.length === 0) return;
  await trx('water_test_kit_metrics').insert(
    metrics.map((m, i) => ({
      kit_id: kitId,
      metric_key: m.metricKey.trim().toLowerCase(),
      sort_order: m.sortOrder ?? i,
      input_mode: m.inputMode === 'color_assist' ? 'color_assist' : 'numeric',
      color_scale_json: m.colorScaleJson != null ? m.colorScaleJson : null,
      help_copy: m.helpCopy?.trim() || null,
      created_at: trx.fn.now(),
    }))
  );
}

export async function createKit(input: WaterTestKitInput): Promise<ReturnType<typeof mapKit>> {
  const [created] = await db('water_test_kits')
    .insert({
      slug: input.slug.trim().slice(0, 120),
      title: input.title.trim().slice(0, 200),
      image_url: input.imageUrl?.trim() || null,
      manufacturer: input.manufacturer?.trim().slice(0, 200) || null,
      status: input.status === 'published' ? 'published' : 'draft',
      effective_from: input.effectiveFrom || null,
      review_status: input.reviewStatus?.trim().slice(0, 40) || 'pending',
      source_notes: input.sourceNotes?.trim() || null,
      manufacturer_doc_url: input.manufacturerDocUrl?.trim() || null,
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');

  await replaceKitMetrics(db, (created as { id: string }).id, input.metrics ?? []);
  return (await getKitById((created as { id: string }).id)) as ReturnType<typeof mapKit>;
}

export async function updateKit(
  id: string,
  input: Partial<WaterTestKitInput>
): Promise<ReturnType<typeof mapKit> | null> {
  const existing = await db('water_test_kits').where({ id }).first();
  if (!existing) return null;

  const update: Record<string, unknown> = { updated_at: db.fn.now() };
  if (input.slug !== undefined) update.slug = input.slug.trim().slice(0, 120);
  if (input.title !== undefined) update.title = input.title.trim().slice(0, 200);
  if (input.imageUrl !== undefined) update.image_url = input.imageUrl?.trim() || null;
  if (input.manufacturer !== undefined) update.manufacturer = input.manufacturer?.trim().slice(0, 200) || null;
  if (input.status !== undefined) update.status = input.status === 'published' ? 'published' : 'draft';
  if (input.effectiveFrom !== undefined) update.effective_from = input.effectiveFrom || null;
  if (input.reviewStatus !== undefined) update.review_status = input.reviewStatus?.trim().slice(0, 40) || null;
  if (input.sourceNotes !== undefined) update.source_notes = input.sourceNotes?.trim() || null;
  if (input.manufacturerDocUrl !== undefined) update.manufacturer_doc_url = input.manufacturerDocUrl?.trim() || null;

  if (Object.keys(update).length > 1) {
    await db('water_test_kits').where({ id }).update(update);
  }
  if (input.metrics !== undefined) {
    await replaceKitMetrics(db, id, input.metrics);
  }
  return getKitById(id);
}

export async function deleteKit(id: string): Promise<boolean> {
  const n = await db('water_test_kits').where({ id }).del();
  return n > 0;
}
