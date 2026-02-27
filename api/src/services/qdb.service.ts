import db from '../db';
import { logAudit } from './audit.service';
import type {
  QdbQualifier,
  QdbSpaQualifier,
  QdbPartQualifier,
  CreateQualifierDto,
  UpdateQualifierDto,
} from '../types/uhtd.types';

// Database row interfaces
interface QualifierRow {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  value_type: 'boolean' | 'single_select' | 'multi_select';
  possible_values: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface SpaQualifierRow {
  id: string;
  spa_model_id: string;
  qualifier_id: string;
  value: string;
  created_at: string;
  updated_at: string;
}

interface PartQualifierRow {
  id: string;
  part_id: string;
  qualifier_id: string;
  value: string;
  is_required: boolean;
  created_at: string;
  updated_at: string;
}

function mapQualifierFromDb(row: QualifierRow): QdbQualifier {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    valueType: row.value_type,
    possibleValues: row.possible_values ? JSON.parse(row.possible_values) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}

function mapSpaQualifierFromDb(row: SpaQualifierRow): QdbSpaQualifier {
  return {
    id: row.id,
    spaModelId: row.spa_model_id,
    qualifierId: row.qualifier_id,
    value: row.value,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPartQualifierFromDb(row: PartQualifierRow): QdbPartQualifier {
  return {
    id: row.id,
    partId: row.part_id,
    qualifierId: row.qualifier_id,
    value: row.value,
    isRequired: row.is_required,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Qualifier CRUD
export async function getAllQualifiers(): Promise<QdbQualifier[]> {
  const rows = await db('qdb_qualifiers')
    .whereNull('deleted_at')
    .orderBy('display_name');
  return rows.map(mapQualifierFromDb);
}

export async function getQualifierById(id: string): Promise<QdbQualifier | null> {
  const row = await db('qdb_qualifiers')
    .where({ id })
    .whereNull('deleted_at')
    .first();
  return row ? mapQualifierFromDb(row) : null;
}

export async function createQualifier(
  data: CreateQualifierDto,
  userId?: string
): Promise<QdbQualifier> {
  const [row] = await db('qdb_qualifiers')
    .insert({
      name: data.name,
      display_name: data.displayName,
      description: data.description,
      value_type: data.valueType,
      possible_values: data.possibleValues ? JSON.stringify(data.possibleValues) : null,
    })
    .returning('*');

  await logAudit({
    tableName: 'qdb_qualifiers',
    recordId: row.id,
    action: 'INSERT',
    newValues: row,
    changedBy: userId,
  });

  return mapQualifierFromDb(row);
}

export async function updateQualifier(
  id: string,
  data: UpdateQualifierDto,
  userId?: string
): Promise<QdbQualifier | null> {
  const existing = await db('qdb_qualifiers').where({ id }).first();
  if (!existing) return null;

  const updateData: Record<string, unknown> = { updated_at: db.fn.now() };
  if (data.displayName !== undefined) updateData.display_name = data.displayName;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.valueType !== undefined) updateData.value_type = data.valueType;
  if (data.possibleValues !== undefined) {
    updateData.possible_values = data.possibleValues ? JSON.stringify(data.possibleValues) : null;
  }

  const [row] = await db('qdb_qualifiers')
    .where({ id })
    .update(updateData)
    .returning('*');

  await logAudit({
    tableName: 'qdb_qualifiers',
    recordId: id,
    action: 'UPDATE',
    oldValues: existing,
    newValues: row,
    changedBy: userId,
  });

  return mapQualifierFromDb(row);
}

export async function deleteQualifier(id: string, userId?: string): Promise<boolean> {
  const existing = await db('qdb_qualifiers').where({ id }).first();
  if (!existing) return false;

  const [row] = await db('qdb_qualifiers')
    .where({ id })
    .update({ deleted_at: db.fn.now(), updated_at: db.fn.now() })
    .returning('*');

  await logAudit({
    tableName: 'qdb_qualifiers',
    recordId: id,
    action: 'DELETE',
    oldValues: existing,
    newValues: row,
    changedBy: userId,
  });

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
  value: string,
  userId?: string
): Promise<QdbSpaQualifier> {
  const existing = await db('qdb_spa_qualifiers')
    .where({ spa_model_id: spaModelId, qualifier_id: qualifierId })
    .first();

  if (existing) {
    const [row] = await db('qdb_spa_qualifiers')
      .where({ id: existing.id })
      .update({ value, updated_at: db.fn.now() })
      .returning('*');

    await logAudit({
      tableName: 'qdb_spa_qualifiers',
      recordId: row.id,
      action: 'UPDATE',
      oldValues: existing,
      newValues: row,
      changedBy: userId,
    });

    return mapSpaQualifierFromDb(row);
  } else {
    const [row] = await db('qdb_spa_qualifiers')
      .insert({ spa_model_id: spaModelId, qualifier_id: qualifierId, value })
      .returning('*');

    await logAudit({
      tableName: 'qdb_spa_qualifiers',
      recordId: row.id,
      action: 'INSERT',
      newValues: row,
      changedBy: userId,
    });

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

  await db('qdb_spa_qualifiers').where({ id: existing.id }).del();

  await logAudit({
    tableName: 'qdb_spa_qualifiers',
    recordId: existing.id,
    action: 'DELETE',
    oldValues: existing,
    changedBy: userId,
  });

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
  value: string,
  isRequired: boolean,
  userId?: string
): Promise<QdbPartQualifier> {
  const existing = await db('qdb_part_qualifiers')
    .where({ part_id: partId, qualifier_id: qualifierId })
    .first();

  if (existing) {
    const [row] = await db('qdb_part_qualifiers')
      .where({ id: existing.id })
      .update({ value, is_required: isRequired, updated_at: db.fn.now() })
      .returning('*');

    await logAudit({
      tableName: 'qdb_part_qualifiers',
      recordId: row.id,
      action: 'UPDATE',
      oldValues: existing,
      newValues: row,
      changedBy: userId,
    });

    return mapPartQualifierFromDb(row);
  } else {
    const [row] = await db('qdb_part_qualifiers')
      .insert({ part_id: partId, qualifier_id: qualifierId, value, is_required: isRequired })
      .returning('*');

    await logAudit({
      tableName: 'qdb_part_qualifiers',
      recordId: row.id,
      action: 'INSERT',
      newValues: row,
      changedBy: userId,
    });

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

  await db('qdb_part_qualifiers').where({ id: existing.id }).del();

  await logAudit({
    tableName: 'qdb_part_qualifiers',
    recordId: existing.id,
    action: 'DELETE',
    oldValues: existing,
    changedBy: userId,
  });

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
    .whereIn('qualifier_id', spaQualifiers.map((q) => q.qualifierId))
    .whereIn('value', spaQualifiers.map((q) => q.value))
    .groupBy('part_id');

  return partIds.map((row) => row.part_id);
}
