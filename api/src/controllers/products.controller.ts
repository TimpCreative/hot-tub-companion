import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';

function getTenantId(req: Request): string | null {
  return ((req as any).tenant?.id as string | undefined) ?? null;
}

export async function listProducts(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const { page = '1', pageSize = '25', search, categoryId } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));

  let query = db('pos_products as pp')
    .leftJoin('pcdb_parts as part', 'pp.uhtd_part_id', 'part.id')
    .leftJoin('pcdb_categories as cat', 'part.category_id', 'cat.id')
    .where('pp.tenant_id', tenantId)
    .andWhere('pp.is_hidden', false)
    .andWhere('pp.mapping_status', 'confirmed')
    .whereNull('part.deleted_at')
    .select(
      'pp.id',
      'pp.title',
      'pp.description',
      'pp.price',
      'pp.compare_at_price',
      'pp.sku',
      'pp.barcode',
      'pp.images',
      'pp.inventory_quantity',
      'part.id as uhtd_part_id',
      'part.name as uhtd_part_name',
      'part.part_number as uhtd_part_number',
      'part.is_universal as uhtd_part_is_universal',
      'cat.id as category_id',
      'cat.display_name as category_name',
      'cat.sort_order as category_sort',
      'part.display_importance as part_display_importance'
    );

  if (categoryId) {
    query = query.andWhere('cat.id', categoryId);
  }

  if (search) {
    const s = `%${search}%`;
    query = query.andWhere((qb: any) => {
      qb.where('pp.title', 'ilike', s).orWhere('pp.description', 'ilike', s);
    });
  }

  const countRow = await query.clone().clearSelect().clearOrder().count('* as count').first();
  const total = parseInt((countRow as any)?.count ?? '0', 10);

  const rows = await query
    .orderBy('cat.sort_order', 'asc')
    .orderBy('part.display_importance', 'asc')
    .orderBy('pp.title', 'asc')
    .limit(ps)
    .offset((p - 1) * ps);

  success(res, rows, undefined, { page: p, pageSize: ps, total, totalPages: Math.ceil(total / ps) });
}

export async function getProductById(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const { id } = req.params;
  const row = await db('pos_products as pp')
    .leftJoin('pcdb_parts as part', 'pp.uhtd_part_id', 'part.id')
    .leftJoin('pcdb_categories as cat', 'part.category_id', 'cat.id')
    .where('pp.tenant_id', tenantId)
    .andWhere('pp.id', id)
    .select(
      'pp.*',
      'part.name as uhtd_part_name',
      'part.part_number as uhtd_part_number',
      'part.is_universal as uhtd_part_is_universal',
      'cat.id as category_id',
      'cat.display_name as category_name',
      'cat.sort_order as category_sort'
    )
    .first();

  if (!row) {
    error(res, 'NOT_FOUND', 'Product not found', 404);
    return;
  }

  success(res, row);
}

export async function listProductCategories(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  // Categories represented by visible, confirmed mapped products for this tenant
  const rows = await db('pcdb_categories as cat')
    .distinct('cat.id', 'cat.name', 'cat.display_name', 'cat.sort_order')
    .join('pcdb_parts as part', 'cat.id', 'part.category_id')
    .join('pos_products as pp', 'part.id', 'pp.uhtd_part_id')
    .where('pp.tenant_id', tenantId)
    .andWhere('pp.is_hidden', false)
    .andWhere('pp.mapping_status', 'confirmed')
    .whereNull('cat.deleted_at')
    .whereNull('part.deleted_at')
    .orderBy('cat.sort_order', 'asc');

  success(res, rows);
}

export async function listCompatibleProducts(req: Request, res: Response): Promise<void> {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const userId = (req as any).user?.id as string | undefined;
  if (!userId) {
    error(res, 'UNAUTHORIZED', 'Authentication required', 401);
    return;
  }

  const { spaProfileId } = req.params;
  const spa = await db('spa_profiles')
    .where({ id: spaProfileId, tenant_id: tenantId, user_id: userId })
    .select('id', 'uhtd_spa_model_id', 'sanitization_system')
    .first();

  if (!spa) {
    error(res, 'NOT_FOUND', 'Spa profile not found', 404);
    return;
  }
  if (!spa.uhtd_spa_model_id) {
    success(res, [], 'Spa profile is not linked to a UHTD model yet');
    return;
  }

  const spaModelId = spa.uhtd_spa_model_id as string;

  // Resolve sanitization_system qualifier id
  const sanitizationQualifier = await db('qdb_qualifiers')
    .whereIn('name', ['sanitation_system', 'sanitization_system'])
    .orderByRaw(`CASE WHEN name = 'sanitation_system' THEN 0 ELSE 1 END`)
    .select('id')
    .first();

  const sanitizationQualifierId = sanitizationQualifier?.id as string | undefined;

  // Fetch compatible products per Phase 1 rules:
  // - tenant_id match
  // - not hidden
  // - mapping_status confirmed
  // - part compatibility confirmed OR part is universal
  // - qualifiers: for required part qualifiers, spa must match
  const base = db('pos_products as pp')
    .join('pcdb_parts as part', 'pp.uhtd_part_id', 'part.id')
    .join('pcdb_categories as cat', 'part.category_id', 'cat.id')
    .leftJoin('part_spa_compatibility as psc', function () {
      this.on('part.id', '=', 'psc.part_id')
        .andOn('psc.spa_model_id', '=', db.raw('?', [spaModelId]))
        .andOn('psc.status', '=', db.raw('?', ['confirmed']));
    })
    .where('pp.tenant_id', tenantId)
    .andWhere('pp.is_hidden', false)
    .andWhere('pp.mapping_status', 'confirmed')
    .whereNull('part.deleted_at');

  // Qualifier filtering (minimal Phase 1 implementation):
  // If a part requires sanitization_system, enforce match to spa_profiles.sanitization_system.
  // (Other qualifiers can be added similarly later.)
  let query = base;
  if (sanitizationQualifierId) {
    query = query.leftJoin('qdb_part_qualifiers as pq_sani', function () {
      this.on('part.id', '=', 'pq_sani.part_id')
        .andOn('pq_sani.qualifier_id', '=', db.raw('?', [sanitizationQualifierId]))
        .andOn('pq_sani.is_required', '=', db.raw('?', [true]));
    });
  }

  query = query.andWhere((qb: any) => {
    qb.where('part.is_universal', true).orWhereNotNull('psc.part_id');
  });

  if (sanitizationQualifierId) {
    query = query.andWhere((qb: any) => {
      qb.whereNull('pq_sani.qualifier_id').orWhereRaw('LOWER(pq_sani.value::text) LIKE ?', [`%${String(spa.sanitization_system).toLowerCase()}%`]);
    });
  }

  const { page = '1', pageSize = '25' } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));

  const countRow = await query
    .clone()
    .clearSelect()
    .clearOrder()
    .countDistinct('pp.id as count')
    .first();
  const total = parseInt((countRow as any)?.count ?? '0', 10);

  const rows = await query
    .select(
      'pp.id',
      'pp.title',
      'pp.description',
      'pp.price',
      'pp.compare_at_price',
      'pp.sku',
      'pp.barcode',
      'pp.images',
      'pp.inventory_quantity',
      'part.part_number',
      'part.name as uhtd_part_name',
      'part.is_oem',
      'part.is_universal',
      'part.display_importance',
      'psc.quantity_required',
      'psc.position',
      'psc.fit_notes',
      'cat.display_name as category_name',
      'cat.sort_order as category_sort'
    )
    .orderBy('cat.sort_order', 'asc')
    .orderBy('part.display_importance', 'asc')
    .orderBy('pp.title', 'asc')
    .limit(ps)
    .offset((p - 1) * ps);

  success(res, rows, undefined, { page: p, pageSize: ps, total, totalPages: Math.ceil(total / ps) });
}

