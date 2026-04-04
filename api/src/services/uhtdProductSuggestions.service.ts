import { db } from '../config/database';
import type { Knex } from 'knex';

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export type UhtdSuggestionInputProduct = {
  id: string;
  title: string | null;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  vendor: string | null;
  product_type?: string | null;
  tags: string[] | null | undefined;
};

export type UhtdSuggestionItem = {
  partId: string;
  name: string;
  partNumber: string | null;
  manufacturer: string | null;
  score: number;
  reason: string;
};

/**
 * Same scoring pipeline as retailer UHTD suggestions; used by GET suggestions and list enrichment.
 */
export async function getUhtdSuggestionsForProduct(
  product: UhtdSuggestionInputProduct,
  tenantId: string
): Promise<UhtdSuggestionItem[]> {
  const collRows = await db('pos_product_shopify_collections')
    .where('pos_product_id', product.id)
    .select('shopify_collection_id');
  const collIds = collRows.map((r: { shopify_collection_id: string }) => r.shopify_collection_id);
  const mappedCategoryIds = new Set<string>();
  if (collIds.length) {
    const maps = await db('tenant_collection_category_map')
      .where({ tenant_id: tenantId })
      .whereIn('shopify_collection_id', collIds)
      .select('pcdb_category_id');
    for (const m of maps) mappedCategoryIds.add(m.pcdb_category_id);
  }

  const descPlain = product.description ? stripHtml(String(product.description)) : '';
  const descSnippet = descPlain.length > 2000 ? descPlain.slice(0, 2000) : descPlain;

  const suggestions: UhtdSuggestionItem[] = [];

  function pushSuggestion(
    row: {
      id: string;
      name: string;
      part_number: string | null;
      manufacturer: string | null;
      category_id?: string;
    },
    baseScore: number,
    baseReason: string
  ) {
    let score = baseScore;
    const reasons: string[] = [baseReason];
    if (
      product.vendor &&
      row.manufacturer &&
      String(product.vendor).trim().toLowerCase() === String(row.manufacturer).trim().toLowerCase()
    ) {
      score += 0.08;
      reasons.push('vendor_match');
    }
    if (row.category_id && mappedCategoryIds.size > 0 && mappedCategoryIds.has(row.category_id)) {
      score += 0.12;
      reasons.push('collection_category');
    }
    if (Array.isArray(product.tags) && product.tags.length && row.name) {
      const nameLower = row.name.toLowerCase();
      for (const t of product.tags) {
        if (t && nameLower.includes(String(t).toLowerCase())) {
          score += 0.04;
          reasons.push('tag_overlap');
          break;
        }
      }
    }
    suggestions.push({
      partId: row.id,
      name: row.name,
      partNumber: row.part_number,
      manufacturer: row.manufacturer,
      score: Math.min(score, 0.99),
      reason: reasons.join('+'),
    });
  }

  if (product.barcode) {
    const barcodeMatches = await db('pcdb_parts')
      .whereNull('deleted_at')
      .andWhere((qb: Knex.QueryBuilder) =>
        qb.where('upc', product.barcode).orWhere('ean', product.barcode)
      )
      .limit(10)
      .select('id', 'name', 'part_number', 'manufacturer', 'category_id');

    for (const m of barcodeMatches) {
      pushSuggestion(m, 0.95, 'barcode');
    }
  }

  if (product.sku) {
    const skuMatches = await db('pcdb_parts')
      .whereNull('deleted_at')
      .andWhere((qb: Knex.QueryBuilder) =>
        qb.whereRaw('LOWER(part_number) = LOWER(?)', [product.sku]).orWhereRaw('? = ANY(sku_aliases)', [
          product.sku,
        ])
      )
      .limit(10)
      .select('id', 'name', 'part_number', 'manufacturer', 'category_id');

    for (const m of skuMatches) {
      pushSuggestion(m, 0.75, 'sku');
    }
  }

  if (product.title) {
    const nameMatches = await db('pcdb_parts')
      .whereNull('deleted_at')
      .select(
        'id',
        'name',
        'part_number',
        'manufacturer',
        'category_id',
        db.raw('similarity(name, ?) as score', [product.title])
      )
      .whereRaw('similarity(name, ?) >= 0.15', [product.title])
      .orderBy('score', 'desc')
      .limit(10);

    for (const m of nameMatches as Array<Record<string, unknown>>) {
      pushSuggestion(
        {
          id: m.id as string,
          name: m.name as string,
          part_number: m.part_number as string | null,
          manufacturer: m.manufacturer as string | null,
          category_id: m.category_id as string | undefined,
        },
        Number(m.score) || 0,
        'name_similarity'
      );
    }
  }

  if (descSnippet.length > 12) {
    const descMatches = await db('pcdb_parts')
      .whereNull('deleted_at')
      .select(
        'id',
        'name',
        'part_number',
        'manufacturer',
        'category_id',
        db.raw('similarity(name, ?) as score', [descSnippet])
      )
      .whereRaw('similarity(name, ?) >= 0.12', [descSnippet])
      .orderBy('score', 'desc')
      .limit(8);

    for (const m of descMatches as Array<Record<string, unknown>>) {
      pushSuggestion(
        {
          id: m.id as string,
          name: m.name as string,
          part_number: m.part_number as string | null,
          manufacturer: m.manufacturer as string | null,
          category_id: m.category_id as string | undefined,
        },
        Math.min(0.35, Number(m.score) || 0),
        'description_similarity'
      );
    }
  }

  const best = new Map<string, UhtdSuggestionItem>();
  for (const s of suggestions) {
    const cur = best.get(s.partId);
    if (!cur || s.score > cur.score) best.set(s.partId, s);
  }

  return Array.from(best.values()).sort((a, b) => b.score - a.score).slice(0, 10);
}

/** Max suggestion score 0–0.99, or null if no suggestions (matches modal behavior). */
export async function getTopSuggestionScore(
  product: UhtdSuggestionInputProduct,
  tenantId: string
): Promise<number | null> {
  const list = await getUhtdSuggestionsForProduct(product, tenantId);
  if (!list.length) return null;
  return Math.max(...list.map((s) => s.score));
}
