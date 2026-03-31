import { db } from '../config/database';
import { logAudit } from './audit.service';
import type {
  QdbQualifier,
  QdbSpaQualifier,
  QdbPartQualifier,
  QdbSection,
  CreateQualifierInput,
  CreateSectionInput,
  UpdateSectionInput,
  AuditAction,
} from '../types/uhtd.types';

// Database row interfaces
interface QualifierRow {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  data_type: string;
  allowed_values: string | unknown;
  applies_to: string;
  section_id: string | null;
  is_universal: boolean;
  is_required: boolean;
  created_at: Date;
}

interface SectionRow {
  id: string;
  name: string;
  sort_order: number;
  created_at: Date;
}

interface SpaQualifierRow {
  spa_model_id: string;
  qualifier_id: string;
  value: unknown;
}

interface PartQualifierRow {
  part_id: string;
  qualifier_id: string;
  value: unknown;
  is_required: boolean;
}

function mapQualifierFromDb(row: QualifierRow, brandIds?: string[] | null): QdbQualifier {
  const allowedValues = row.allowed_values == null
    ? null
    : typeof row.allowed_values === 'string'
      ? JSON.parse(row.allowed_values)
      : row.allowed_values;
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    dataType: row.data_type as QdbQualifier['dataType'],
    allowedValues: allowedValues as QdbQualifier['allowedValues'],
    appliesTo: row.applies_to as QdbQualifier['appliesTo'],
    description: row.description,
    sectionId: row.section_id ?? null,
    isUniversal: row.is_universal ?? false,
    brandIds: row.is_universal ? null : (brandIds ?? []),
    isRequired: row.is_required ?? false,
    createdAt: row.created_at,
  };
}

async function getQualifierBrandIdsMap(qualifierIds: string[]): Promise<Map<string, string[]>> {
  if (qualifierIds.length === 0) return new Map();

  const rows = await db('brand_qualifiers')
    .whereIn('qualifier_id', qualifierIds)
    .select('qualifier_id', 'brand_id');

  const map = new Map<string, string[]>();
  for (const row of rows as Array<{ qualifier_id: string; brand_id: string }>) {
    const existing = map.get(row.qualifier_id) ?? [];
    existing.push(row.brand_id);
    map.set(row.qualifier_id, existing);
  }
  return map;
}

async function syncQualifierBrandAssignments(
  qualifierId: string,
  isUniversal: boolean,
  brandIds: string[] | null | undefined
): Promise<void> {
  await db('brand_qualifiers').where({ qualifier_id: qualifierId }).del();

  if (isUniversal || !brandIds || brandIds.length === 0) return;

  await db('brand_qualifiers').insert(
    brandIds.map((brandId) => ({ brand_id: brandId, qualifier_id: qualifierId }))
  );
}

function mapSectionFromDb(row: SectionRow): QdbSection {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
  };
}

function mapSpaQualifierFromDb(row: SpaQualifierRow): QdbSpaQualifier {
  return {
    spaModelId: row.spa_model_id,
    qualifierId: row.qualifier_id,
    value: row.value,
  };
}

function mapPartQualifierFromDb(row: PartQualifierRow): QdbPartQualifier {
  return {
    partId: row.part_id,
    qualifierId: row.qualifier_id,
    value: row.value,
    isRequired: row.is_required,
  };
}

// Qualifier CRUD
export async function getAllQualifiers(): Promise<QdbQualifier[]> {
  const rows = await db('qdb_qualifiers').orderBy('display_name');
  const brandMap = await getQualifierBrandIdsMap(rows.map((row: QualifierRow) => row.id));
  return rows.map((row: QualifierRow) => mapQualifierFromDb(row, brandMap.get(row.id) ?? []));
}

export async function getQualifierById(id: string): Promise<QdbQualifier | null> {
  const row = await db('qdb_qualifiers').where({ id }).first();
  if (!row) return null;
  const brandMap = await getQualifierBrandIdsMap([id]);
  return mapQualifierFromDb(row, brandMap.get(id) ?? []);
}

export async function createQualifier(
  data: CreateQualifierInput,
  userId?: string
): Promise<QdbQualifier> {
  const allowedValuesJson = data.allowedValues
    ? JSON.stringify(Array.isArray(data.allowedValues) ? data.allowedValues : data.allowedValues)
    : null;
  const [row] = await db('qdb_qualifiers')
    .insert({
      name: data.name,
      display_name: data.displayName,
      description: data.description,
      data_type: data.dataType,
      allowed_values: allowedValuesJson,
      applies_to: data.appliesTo,
      section_id: data.sectionId ?? null,
      is_universal: data.isUniversal ?? false,
      is_required: data.isRequired ?? false,
    })
    .returning('*');

  await syncQualifierBrandAssignments(row.id, data.isUniversal ?? false, data.brandIds);

  await logAudit(
    'qdb_qualifiers',
    row.id,
    'INSERT' as AuditAction,
    null,
    row,
    userId
  );

  return mapQualifierFromDb(row, data.isUniversal ? null : (data.brandIds ?? []));
}

export async function updateQualifier(
  id: string,
  data: Partial<CreateQualifierInput>,
  userId?: string
): Promise<QdbQualifier | null> {
  const existing = await db('qdb_qualifiers').where({ id }).first();
  if (!existing) return null;

  const updateData: Record<string, unknown> = {};
  if (data.displayName !== undefined) updateData.display_name = data.displayName;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.dataType !== undefined) updateData.data_type = data.dataType;
  if (data.allowedValues !== undefined) {
    updateData.allowed_values = data.allowedValues ? JSON.stringify(data.allowedValues) : null;
  }
  if (data.appliesTo !== undefined) updateData.applies_to = data.appliesTo;
  if (data.sectionId !== undefined) updateData.section_id = data.sectionId;
  if (data.isUniversal !== undefined) updateData.is_universal = data.isUniversal;
  if (data.isRequired !== undefined) updateData.is_required = data.isRequired;

  const [row] = await db('qdb_qualifiers')
    .where({ id })
    .update(updateData)
    .returning('*');

  await syncQualifierBrandAssignments(
    id,
    row.is_universal ?? false,
    data.brandIds !== undefined ? data.brandIds : undefined
  );

  await logAudit(
    'qdb_qualifiers',
    id,
    'UPDATE' as AuditAction,
    existing,
    row,
    userId
  );

  const brandMap = await getQualifierBrandIdsMap([id]);
  return mapQualifierFromDb(row, brandMap.get(id) ?? []);
}

export async function deleteQualifier(id: string, userId?: string): Promise<boolean> {
  const existing = await db('qdb_qualifiers').where({ id }).first();
  if (!existing) return false;

  await db('qdb_qualifiers').where({ id }).del();

  await logAudit(
    'qdb_qualifiers',
    id,
    'DELETE' as AuditAction,
    existing,
    null,
    userId
  );

  return true;
}

// Sections CRUD
export async function listSections(): Promise<QdbSection[]> {
  const rows = await db('qdb_sections').orderBy('sort_order');
  return rows.map(mapSectionFromDb);
}

export async function createSection(data: CreateSectionInput, userId?: string): Promise<QdbSection> {
  const [row] = await db('qdb_sections')
    .insert({
      name: data.name,
      sort_order: data.sortOrder ?? 0,
    })
    .returning('*');
  await logAudit('qdb_sections', row.id, 'INSERT' as AuditAction, null, row, userId);
  return mapSectionFromDb(row);
}

export async function updateSection(id: string, data: UpdateSectionInput, userId?: string): Promise<QdbSection | null> {
  const existing = await db('qdb_sections').where({ id }).first();
  if (!existing) return null;
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.sortOrder !== undefined) updateData.sort_order = data.sortOrder;
  if (Object.keys(updateData).length === 0) return mapSectionFromDb(existing);
  const [row] = await db('qdb_sections').where({ id }).update(updateData).returning('*');
  await logAudit('qdb_sections', id, 'UPDATE' as AuditAction, existing, row, userId);
  return row ? mapSectionFromDb(row) : null;
}

export async function deleteSection(id: string, userId?: string): Promise<boolean> {
  const existing = await db('qdb_sections').where({ id }).first();
  if (!existing) return false;
  await db('qdb_qualifiers').where({ section_id: id }).update({ section_id: null });
  await db('qdb_sections').where({ id }).del();
  await logAudit('qdb_sections', id, 'DELETE' as AuditAction, existing, null, userId);
  return true;
}

// Brand Qualifiers
export async function getBrandQualifiers(brandId: string): Promise<string[]> {
  const rows = await db('brand_qualifiers').where({ brand_id: brandId }).select('qualifier_id');
  return rows.map((r: { qualifier_id: string }) => r.qualifier_id);
}

export async function setBrandQualifiers(brandId: string, qualifierIds: string[], userId?: string): Promise<void> {
  await db('brand_qualifiers').where({ brand_id: brandId }).del();
  if (qualifierIds.length > 0) {
    await db('brand_qualifiers').insert(
      qualifierIds.map((qualifierId) => ({ brand_id: brandId, qualifier_id: qualifierId }))
    );
  }
  await logAudit('brand_qualifiers', brandId, 'UPDATE' as AuditAction, null, { qualifierIds }, userId);
}

function filterAllowedValuesByBrand(allowedValues: unknown, brandId: string): unknown {
  if (!Array.isArray(allowedValues)) return allowedValues;
  return allowedValues.filter((opt: { brandIds?: string[] | null }) => {
    if (!opt || typeof opt !== 'object') return true;
    const brandIds = (opt as { brandIds?: string[] | null }).brandIds;
    if (brandIds == null || brandIds.length === 0) return true;
    return brandIds.includes(brandId);
  });
}

export async function getQualifiersForBrand(brandId: string): Promise<{ sections: QdbSection[]; qualifiersBySection: Record<string, QdbQualifier[]> }> {
  const sections = await listSections();

  const allQualifiers = await db('qdb_qualifiers').orderBy('display_name').select('*');
  const brandQualifierIds = new Set(await getBrandQualifiers(brandId));
  const relevant = allQualifiers.filter(
    (q: QualifierRow) => q.is_universal || brandQualifierIds.has(q.id)
  );

  const qualifiersBySection: Record<string, QdbQualifier[]> = {};
  for (const s of sections) {
    qualifiersBySection[s.id] = relevant
      .filter((q: QualifierRow) => q.section_id === s.id)
      .map((q: QualifierRow) => {
        const qual = mapQualifierFromDb(q);
        if (qual.allowedValues && Array.isArray(qual.allowedValues)) {
          qual.allowedValues = filterAllowedValuesByBrand(qual.allowedValues, brandId) as QdbQualifier['allowedValues'];
        }
        return qual;
      });
  }
  qualifiersBySection['_none'] = relevant
    .filter((q: QualifierRow) => !q.section_id)
    .map((q: QualifierRow) => {
      const qual = mapQualifierFromDb(q);
      if (qual.allowedValues && Array.isArray(qual.allowedValues)) {
        qual.allowedValues = filterAllowedValuesByBrand(qual.allowedValues, brandId) as QdbQualifier['allowedValues'];
      }
      return qual;
    });

  return { sections, qualifiersBySection };
}

// Spa Qualifier operations
export async function getSpaQualifiers(spaModelId: string): Promise<QdbSpaQualifier[]> {
  const rows = await db('qdb_spa_qualifiers')
    .select('qdb_spa_qualifiers.*', 'qdb_qualifiers.name as qualifier_name', 'qdb_qualifiers.display_name as qualifier_display_name')
    .leftJoin('qdb_qualifiers', 'qdb_spa_qualifiers.qualifier_id', 'qdb_qualifiers.id')
    .where('qdb_spa_qualifiers.spa_model_id', spaModelId);
  return rows.map((r: any) => ({
    ...mapSpaQualifierFromDb(r),
    qualifierName: r.qualifier_name,
    qualifierDisplayName: r.qualifier_display_name,
  }));
}

export async function setSpaQualifier(
  spaModelId: string,
  qualifierId: string,
  value: unknown,
  userId?: string
): Promise<QdbSpaQualifier> {
  const existing = await db('qdb_spa_qualifiers')
    .where({ spa_model_id: spaModelId, qualifier_id: qualifierId })
    .first();

  if (existing) {
    const [row] = await db('qdb_spa_qualifiers')
      .where({ spa_model_id: spaModelId, qualifier_id: qualifierId })
      .update({ value })
      .returning('*');

    await logAudit(
      'qdb_spa_qualifiers',
      `${spaModelId}:${qualifierId}`,
      'UPDATE' as AuditAction,
      existing,
      row,
      userId
    );

    return mapSpaQualifierFromDb(row);
  } else {
    const [row] = await db('qdb_spa_qualifiers')
      .insert({ spa_model_id: spaModelId, qualifier_id: qualifierId, value })
      .returning('*');

    await logAudit(
      'qdb_spa_qualifiers',
      `${spaModelId}:${qualifierId}`,
      'INSERT' as AuditAction,
      null,
      row,
      userId
    );

    return mapSpaQualifierFromDb(row);
  }
}

export async function setSpaQualifiersBatch(
  spaModelId: string,
  qualifierValues: Record<string, unknown>,
  userId?: string
): Promise<void> {
  for (const [qualifierId, value] of Object.entries(qualifierValues)) {
    if (value !== undefined && value !== null) {
      await setSpaQualifier(spaModelId, qualifierId, value, userId);
    }
  }
}

export async function removeSpaQualifier(
  spaModelId: string,
  qualifierId: string,
  userId?: string
): Promise<boolean> {
  const existing = await db('qdb_spa_qualifiers')
    .where({ spa_model_id: spaModelId, qualifier_id: qualifierId })
    .first();

  if (!existing) return false;

  await db('qdb_spa_qualifiers')
    .where({ spa_model_id: spaModelId, qualifier_id: qualifierId })
    .del();

  await logAudit(
    'qdb_spa_qualifiers',
    `${spaModelId}:${qualifierId}`,
    'DELETE' as AuditAction,
    existing,
    null,
    userId
  );

  return true;
}

// Part Qualifier operations
export async function getPartQualifiers(partId: string): Promise<QdbPartQualifier[]> {
  const rows = await db('qdb_part_qualifiers')
    .select('qdb_part_qualifiers.*', 'qdb_qualifiers.name as qualifier_name', 'qdb_qualifiers.display_name as qualifier_display_name')
    .leftJoin('qdb_qualifiers', 'qdb_part_qualifiers.qualifier_id', 'qdb_qualifiers.id')
    .where('qdb_part_qualifiers.part_id', partId);
  return rows.map((r: any) => ({
    ...mapPartQualifierFromDb(r),
    qualifierName: r.qualifier_name,
    qualifierDisplayName: r.qualifier_display_name,
  }));
}

export async function setPartQualifier(
  partId: string,
  qualifierId: string,
  value: unknown,
  isRequired: boolean,
  userId?: string
): Promise<QdbPartQualifier> {
  const existing = await db('qdb_part_qualifiers')
    .where({ part_id: partId, qualifier_id: qualifierId })
    .first();

  if (existing) {
    const [row] = await db('qdb_part_qualifiers')
      .where({ part_id: partId, qualifier_id: qualifierId })
      .update({ value, is_required: isRequired })
      .returning('*');

    await logAudit(
      'qdb_part_qualifiers',
      `${partId}:${qualifierId}`,
      'UPDATE' as AuditAction,
      existing,
      row,
      userId
    );

    return mapPartQualifierFromDb(row);
  } else {
    const [row] = await db('qdb_part_qualifiers')
      .insert({ part_id: partId, qualifier_id: qualifierId, value, is_required: isRequired })
      .returning('*');

    await logAudit(
      'qdb_part_qualifiers',
      `${partId}:${qualifierId}`,
      'INSERT' as AuditAction,
      null,
      row,
      userId
    );

    return mapPartQualifierFromDb(row);
  }
}

export async function removePartQualifier(
  partId: string,
  qualifierId: string,
  userId?: string
): Promise<boolean> {
  const existing = await db('qdb_part_qualifiers')
    .where({ part_id: partId, qualifier_id: qualifierId })
    .first();

  if (!existing) return false;

  await db('qdb_part_qualifiers')
    .where({ part_id: partId, qualifier_id: qualifierId })
    .del();

  await logAudit(
    'qdb_part_qualifiers',
    `${partId}:${qualifierId}`,
    'DELETE' as AuditAction,
    existing,
    null,
    userId
  );

  return true;
}

// Matching: find parts that match a spa's qualifiers
// Supports scalar and array qualifier values (e.g. sanitization_systems: ['ozone','uv'])
export async function findPartsMatchingSpaQualifiers(spaModelId: string): Promise<string[]> {
  const spaQualifiers = await getSpaQualifiers(spaModelId);
  if (spaQualifiers.length === 0) return [];

  const spaQualifierIds = spaQualifiers.map((q: QdbSpaQualifier) => q.qualifierId);
  const spaValueMap = new Map<string, unknown[]>();
  for (const q of spaQualifiers) {
    const effective = Array.isArray(q.value) ? q.value : [q.value];
    spaValueMap.set(q.qualifierId, effective);
  }

  const requiredPartQualifiers = await db('qdb_part_qualifiers')
    .where('is_required', true)
    .whereIn('qualifier_id', spaQualifierIds)
    .select('part_id', 'qualifier_id', 'value');

  const byPart = new Map<string, { qualifierId: string; value: unknown }[]>();
  for (const row of requiredPartQualifiers) {
    const list = byPart.get(row.part_id) ?? [];
    list.push({ qualifierId: row.qualifier_id, value: row.value });
    byPart.set(row.part_id, list);
  }

  const matching: string[] = [];
  for (const [partId, pqList] of byPart.entries()) {
    const allMatch = pqList.every((pq) => {
      const spaValues = spaValueMap.get(pq.qualifierId) ?? [];
      const partVal = pq.value;
      if (Array.isArray(partVal)) {
        return partVal.some((p: unknown) => spaValues.includes(p));
      }
      return spaValues.includes(partVal);
    });
    if (allMatch) matching.push(partId);
  }
  return matching;
}
