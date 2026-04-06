import { db } from '../config/database';
import type { Knex } from 'knex';

export type ShopCompatibility = 'compatible' | 'other_model' | 'general' | 'needs_spa';

export type SpaContext =
  | { kind: 'none' }
  | { kind: 'no_model' }
  | { kind: 'ok'; spaModelId: string; sanitizationSystem: string | null };

export async function resolveSpaContext(
  tenantId: string,
  userId: string | undefined,
  spaProfileId: string | undefined | null
): Promise<SpaContext> {
  if (!spaProfileId || !userId) return { kind: 'none' };
  const spa = await db('spa_profiles')
    .where({ id: spaProfileId, tenant_id: tenantId, user_id: userId })
    .select('id', 'uhtd_spa_model_id', 'sanitization_system')
    .first();
  if (!spa) return { kind: 'none' };
  if (!spa.uhtd_spa_model_id) return { kind: 'no_model' };
  return {
    kind: 'ok',
    spaModelId: spa.uhtd_spa_model_id as string,
    sanitizationSystem: (spa.sanitization_system as string) ?? null,
  };
}

export async function getSanitizationQualifierId(): Promise<string | undefined> {
  const row = await db('qdb_qualifiers')
    .whereIn('name', ['sanitation_system', 'sanitization_system'])
    .orderByRaw(`CASE WHEN name = 'sanitation_system' THEN 0 ELSE 1 END`)
    .select('id')
    .first();
  return row?.id as string | undefined;
}

/** True when we can evaluate compatible vs other_model (spa linked to UHTD model). */
export function spaContextIsEvaluable(spaCtx: SpaContext): spaCtx is {
  kind: 'ok';
  spaModelId: string;
  sanitizationSystem: string | null;
} {
  return spaCtx.kind === 'ok';
}

/**
 * Left-join part_spa_compatibility for the active spa model.
 * When spa is not evaluable, join condition is never true so psc columns are NULL.
 */
export function joinPartSpaCompatibility(qb: Knex.QueryBuilder, spaCtx: SpaContext): void {
  qb.leftJoin(`part_spa_compatibility as psc`, function joinPsc(this: Knex.JoinClause) {
    this.on('part.id', '=', 'psc.part_id');
    if (spaCtx.kind === 'ok') {
      this.andOn('psc.spa_model_id', '=', db.raw('?', [spaCtx.spaModelId]));
      this.andOn('psc.status', '=', db.raw('?', ['confirmed']));
    } else {
      this.andOn(db.raw('false'));
    }
  });
}

/**
 * Required-sanitization qualifier join (same as listCompatibleProducts).
 * Only applies when qualifier exists AND spa is evaluable.
 */
export function joinRequiredSanitizationQualifier(
  qb: Knex.QueryBuilder,
  spaCtx: SpaContext,
  sanitizationQualifierId: string | undefined
): void {
  if (!sanitizationQualifierId || !spaContextIsEvaluable(spaCtx)) return;
  qb.leftJoin('qdb_part_qualifiers as pq_sani', function joinPq(this: Knex.JoinClause) {
    this.on('part.id', '=', 'pq_sani.part_id')
      .andOn('pq_sani.qualifier_id', '=', db.raw('?', [sanitizationQualifierId]))
      .andOn('pq_sani.is_required', '=', db.raw('?', [true]));
  });
}

/**
 * Shared CASE for shopCompatibility / list classification.
 */
export function shopCompatibilityRaw(
  spaCtx: SpaContext,
  sanitizationQualifierId: string | undefined,
  sanitizationSystem: string | null
): Knex.Raw {
  const spaOk = spaContextIsEvaluable(spaCtx);
  const saniLower = `%${String(sanitizationSystem ?? '').toLowerCase()}%`;

  const compatBody = spaOk
    ? `(part.is_universal = true OR psc.part_id IS NOT NULL)`
    : 'false';

  let saniClause = 'true';
  if (sanitizationQualifierId && spaOk) {
    saniClause = `(pq_sani.qualifier_id IS NULL OR LOWER(pq_sani.value::text) LIKE ?)`;
  }

  /**
   * "needs_spa" = shopper has not linked an evaluable spa yet, but this listing is spa-scoped in UHTD
   * (universal part, or at least one confirmed model compatibility row). Parts with zero compatibility
   * rows and not universal are not "waiting on spa setup" — they are not indexed for any spa → other_model.
   */
  const needsSpaWhen = spaOk
    ? 'false'
    : `(pp.mapping_status = 'confirmed' AND pp.uhtd_part_id IS NOT NULL AND part.id IS NOT NULL AND part.deleted_at IS NULL
        AND (
          part.is_universal = true
          OR EXISTS (
            SELECT 1 FROM part_spa_compatibility psc_any
            WHERE psc_any.part_id = part.id AND psc_any.status = 'confirmed'
          )
        ))`;

  const bindings: string[] = [];
  if (sanitizationQualifierId && spaOk) {
    bindings.push(saniLower);
  }

  const sql = `
    CASE
      WHEN pp.mapping_status <> 'confirmed' OR pp.uhtd_part_id IS NULL OR part.id IS NULL OR part.deleted_at IS NOT NULL THEN 'general'
      WHEN ${needsSpaWhen} THEN 'needs_spa'
      WHEN (${compatBody}) AND (${saniClause}) THEN 'compatible'
      ELSE 'other_model'
    END
  `;

  return bindings.length ? db.raw(`${sql} as shop_compatibility`, bindings) : db.raw(`${sql} as shop_compatibility`);
}

/**
 * Apply the same WHERE filters as listCompatibleProducts (psc + optional pq_sani already joined).
 */
export function applyListCompatibleWhere(
  qb: Knex.QueryBuilder,
  sanitizationSystem: string | null,
  sanitizationQualifierId: string | undefined
): void {
  qb.andWhere((b: Knex.QueryBuilder) => {
    b.where('part.is_universal', true).orWhereNotNull('psc.part_id');
  });
  if (sanitizationQualifierId) {
    qb.andWhere((b: Knex.QueryBuilder) => {
      b.whereNull('pq_sani.qualifier_id').orWhereRaw('LOWER(pq_sani.value::text) LIKE ?', [
        `%${String(sanitizationSystem ?? '').toLowerCase()}%`,
      ]);
    });
  }
}

/** Attach part/cat/psc/pq joins and tenant visibility (shop list / PDP compat). */
export function applyShopProductJoins(
  qb: Knex.QueryBuilder,
  tenantId: string,
  spaCtx: SpaContext,
  sanitizationQualifierId: string | undefined
): void {
  qb.leftJoin('pcdb_parts as part', 'pp.uhtd_part_id', 'part.id')
    .leftJoin('pcdb_categories as cat', 'part.category_id', 'cat.id')
    .where('pp.tenant_id', tenantId)
    .andWhere('pp.is_hidden', false);

  joinPartSpaCompatibility(qb, spaCtx);
  joinRequiredSanitizationQualifier(qb, spaCtx, sanitizationQualifierId);
}
