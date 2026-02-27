import { db } from '../config/database';
import { logAudit } from './audit.service';
import type {
  QdbQualifier,
  QdbSpaQualifier,
  QdbPartQualifier,
  CreateQualifierInput,
  AuditAction,
} from '../types/uhtd.types';

// Database row interfaces
interface QualifierRow {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  data_type: string;
  allowed_values: string | null;
  applies_to: string;
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

function mapQualifierFromDb(row: QualifierRow): QdbQualifier {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    dataType: row.data_type as QdbQualifier['dataType'],
    allowedValues: row.allowed_values ? JSON.parse(row.allowed_values) : null,
    appliesTo: row.applies_to as QdbQualifier['appliesTo'],
    description: row.description,
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
  return rows.map(mapQualifierFromDb);
}

export async function getQualifierById(id: string): Promise<QdbQualifier | null> {
  const row = await db('qdb_qualifiers').where({ id }).first();
  return row ? mapQualifierFromDb(row) : null;
}

export async function createQualifier(
  data: CreateQualifierInput,
  userId?: string
): Promise<QdbQualifier> {
  const [row] = await db('qdb_qualifiers')
    .insert({
      name: data.name,
      display_name: data.displayName,
      description: data.description,
      data_type: data.dataType,
      allowed_values: data.allowedValues ? JSON.stringify(data.allowedValues) : null,
      applies_to: data.appliesTo,
    })
    .returning('*');

  await logAudit(
    'qdb_qualifiers',
    row.id,
    'INSERT' as AuditAction,
    null,
    row,
    userId
  );

  return mapQualifierFromDb(row);
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

  const [row] = await db('qdb_qualifiers')
    .where({ id })
    .update(updateData)
    .returning('*');

  await logAudit(
    'qdb_qualifiers',
    id,
    'UPDATE' as AuditAction,
    existing,
    row,
    userId
  );

  return mapQualifierFromDb(row);
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

// Spa Qualifier operations
export async function getSpaQualifiers(spaModelId: string): Promise<QdbSpaQualifier[]> {
  const rows = await db('qdb_spa_qualifiers').where({ spa_model_id: spaModelId });
  return rows.map(mapSpaQualifierFromDb);
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
  const rows = await db('qdb_part_qualifiers').where({ part_id: partId });
  return rows.map(mapPartQualifierFromDb);
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
export async function findPartsMatchingSpaQualifiers(spaModelId: string): Promise<string[]> {
  const spaQualifiers = await getSpaQualifiers(spaModelId);
  if (spaQualifiers.length === 0) return [];

  // Get parts that have required qualifiers matching the spa's values
  const partIds = await db('qdb_part_qualifiers')
    .select('part_id')
    .where('is_required', true)
    .whereIn('qualifier_id', spaQualifiers.map((q: QdbSpaQualifier) => q.qualifierId))
    .whereIn('value', spaQualifiers.map((q: QdbSpaQualifier) => q.value as string))
    .groupBy('part_id');

  return partIds.map((row: { part_id: string }) => row.part_id);
}
