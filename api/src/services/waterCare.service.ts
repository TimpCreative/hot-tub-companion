import { db } from '../config/database';
import { normalizeWaterCareConfig } from './waterCareConfig.service';

export type WaterCareScopeType = 'global' | 'brand' | 'model_line' | 'spa_model';

export interface WaterCareMeasurementInput {
  metricKey: string;
  label: string;
  unit: string;
  minValue: number;
  maxValue: number;
  sortOrder?: number;
  isEnabled?: boolean;
}

export interface WaterCareProfileInput {
  name: string;
  description?: string | null;
  notes?: string | null;
  isActive?: boolean;
  measurements: WaterCareMeasurementInput[];
}

export interface WaterCareProfileMappingInput {
  scopeType: WaterCareScopeType;
  scopeId?: string | null;
  sanitationSystemValue?: string | null;
  profileId: string;
  priority?: number;
}

interface WaterCareProfileRow {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface WaterCareMeasurementRow {
  id: string;
  profile_id: string;
  metric_key: string;
  label: string;
  unit: string;
  min_value: string | number;
  max_value: string | number;
  sort_order: number;
  is_enabled: boolean;
}

interface WaterCareMappingRow {
  id: string;
  scope_type: WaterCareScopeType;
  scope_id: string | null;
  sanitation_system_value: string | null;
  profile_id: string;
  priority: number;
  created_at: Date;
  updated_at: Date;
}

export interface WaterCareProfile {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  isActive: boolean;
  measurements: Array<{
    id: string;
    metricKey: string;
    label: string;
    unit: string;
    minValue: number;
    maxValue: number;
    sortOrder: number;
    isEnabled: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface WaterCareProfileMapping {
  id: string;
  scopeType: WaterCareScopeType;
  scopeId: string | null;
  sanitationSystemValue: string | null;
  profileId: string;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

function mapMeasurement(row: WaterCareMeasurementRow) {
  return {
    id: row.id,
    metricKey: row.metric_key,
    label: row.label,
    unit: row.unit,
    minValue: Number(row.min_value),
    maxValue: Number(row.max_value),
    sortOrder: row.sort_order,
    isEnabled: row.is_enabled,
  };
}

function mapProfile(row: WaterCareProfileRow, measurements: WaterCareMeasurementRow[]): WaterCareProfile {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    notes: row.notes,
    isActive: row.is_active,
    measurements: measurements
      .filter((measurement) => measurement.profile_id === row.id)
      .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label))
      .map(mapMeasurement),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMapping(row: WaterCareMappingRow): WaterCareProfileMapping {
  return {
    id: row.id,
    scopeType: row.scope_type,
    scopeId: row.scope_id,
    sanitationSystemValue: row.sanitation_system_value,
    profileId: row.profile_id,
    priority: row.priority,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function replaceMeasurements(
  trx: typeof db,
  profileId: string,
  measurements: WaterCareMeasurementInput[]
): Promise<void> {
  await trx('water_care_profile_measurements').where({ profile_id: profileId }).del();

  if (measurements.length === 0) return;

  await trx('water_care_profile_measurements').insert(
    measurements.map((measurement, index) => ({
      profile_id: profileId,
      metric_key: measurement.metricKey.trim(),
      label: measurement.label.trim(),
      unit: measurement.unit.trim(),
      min_value: measurement.minValue,
      max_value: measurement.maxValue,
      sort_order: measurement.sortOrder ?? index,
      is_enabled: measurement.isEnabled !== false,
    }))
  );
}

function sanitizeMeasurements(measurements: WaterCareMeasurementInput[]): WaterCareMeasurementInput[] {
  return measurements
    .map((measurement, index) => ({
      metricKey: measurement.metricKey?.trim() ?? '',
      label: measurement.label?.trim() ?? '',
      unit: measurement.unit?.trim() ?? '',
      minValue: Number(measurement.minValue),
      maxValue: Number(measurement.maxValue),
      sortOrder: measurement.sortOrder ?? index,
      isEnabled: measurement.isEnabled !== false,
    }))
    .filter(
      (measurement) =>
        measurement.metricKey &&
        measurement.label &&
        measurement.unit &&
        Number.isFinite(measurement.minValue) &&
        Number.isFinite(measurement.maxValue)
    );
}

export async function listProfiles(): Promise<WaterCareProfile[]> {
  const [profiles, measurements] = await Promise.all([
    db('water_care_profiles').orderBy('name'),
    db('water_care_profile_measurements').orderBy('sort_order').orderBy('label'),
  ]);

  return (profiles as WaterCareProfileRow[]).map((profile) =>
    mapProfile(profile, measurements as WaterCareMeasurementRow[])
  );
}

export async function getProfileById(id: string): Promise<WaterCareProfile | null> {
  const [profile, measurements] = await Promise.all([
    db('water_care_profiles').where({ id }).first(),
    db('water_care_profile_measurements').where({ profile_id: id }).orderBy('sort_order').orderBy('label'),
  ]);
  if (!profile) return null;
  return mapProfile(profile as WaterCareProfileRow, measurements as WaterCareMeasurementRow[]);
}

export async function createProfile(input: WaterCareProfileInput): Promise<WaterCareProfile> {
  const measurements = sanitizeMeasurements(input.measurements);
  const [created] = await db('water_care_profiles')
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      notes: input.notes?.trim() || null,
      is_active: input.isActive !== false,
    })
    .returning('*');

  await replaceMeasurements(db, created.id, measurements);
  return (await getProfileById(created.id)) as WaterCareProfile;
}

export async function updateProfile(id: string, input: Partial<WaterCareProfileInput>): Promise<WaterCareProfile | null> {
  const existing = await db('water_care_profiles').where({ id }).first();
  if (!existing) return null;

  const update: Record<string, unknown> = { updated_at: db.fn.now() };
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.description !== undefined) update.description = input.description?.trim() || null;
  if (input.notes !== undefined) update.notes = input.notes?.trim() || null;
  if (input.isActive !== undefined) update.is_active = input.isActive;

  if (Object.keys(update).length > 1) {
    await db('water_care_profiles').where({ id }).update(update);
  }

  if (input.measurements !== undefined) {
    await replaceMeasurements(db, id, sanitizeMeasurements(input.measurements));
  }

  return getProfileById(id);
}

export async function deleteProfile(id: string): Promise<boolean> {
  const deleted = await db('water_care_profiles').where({ id }).del();
  return deleted > 0;
}

export async function listMappings(): Promise<WaterCareProfileMapping[]> {
  const rows = await db('water_care_profile_mappings')
    .orderBy('scope_type')
    .orderBy('priority')
    .orderBy('created_at');
  return (rows as WaterCareMappingRow[]).map(mapMapping);
}

export async function createMapping(input: WaterCareProfileMappingInput): Promise<WaterCareProfileMapping> {
  const [created] = await db('water_care_profile_mappings')
    .insert({
      scope_type: input.scopeType,
      scope_id: input.scopeId ?? null,
      sanitation_system_value: input.sanitationSystemValue ?? null,
      profile_id: input.profileId,
      priority: input.priority ?? 0,
    })
    .returning('*');
  return mapMapping(created as WaterCareMappingRow);
}

export async function updateMapping(
  id: string,
  input: Partial<WaterCareProfileMappingInput>
): Promise<WaterCareProfileMapping | null> {
  const existing = await db('water_care_profile_mappings').where({ id }).first();
  if (!existing) return null;

  const update: Record<string, unknown> = { updated_at: db.fn.now() };
  if (input.scopeType !== undefined) update.scope_type = input.scopeType;
  if (input.scopeId !== undefined) update.scope_id = input.scopeId ?? null;
  if (input.sanitationSystemValue !== undefined) {
    update.sanitation_system_value = input.sanitationSystemValue ?? null;
  }
  if (input.profileId !== undefined) update.profile_id = input.profileId;
  if (input.priority !== undefined) update.priority = input.priority;

  const [row] = await db('water_care_profile_mappings').where({ id }).update(update).returning('*');
  return row ? mapMapping(row as WaterCareMappingRow) : null;
}

export async function deleteMapping(id: string): Promise<boolean> {
  const deleted = await db('water_care_profile_mappings').where({ id }).del();
  return deleted > 0;
}

function scopeRank(scopeType: WaterCareScopeType): number {
  if (scopeType === 'global') return 0;
  if (scopeType === 'brand') return 1;
  if (scopeType === 'model_line') return 2;
  return 3;
}

export async function resolveWaterCareForSpaProfile(spaProfileId: string, tenantId: string, userId: string) {
  const spa = await db('spa_profiles as sp')
    .leftJoin('scdb_spa_models as spa_model', 'sp.uhtd_spa_model_id', 'spa_model.id')
    .leftJoin('scdb_model_lines as ml', 'spa_model.model_line_id', 'ml.id')
    .select(
      'sp.id',
      'sp.tenant_id',
      'sp.sanitization_system',
      'sp.uhtd_spa_model_id',
      'spa_model.brand_id',
      'spa_model.model_line_id',
      'ml.id as resolved_model_line_id'
    )
    .where('sp.id', spaProfileId)
    .andWhere('sp.tenant_id', tenantId)
    .andWhere('sp.user_id', userId)
    .first();

  if (!spa) return null;

  const allMappings = (await db('water_care_profile_mappings').select('*')) as WaterCareMappingRow[];
  const ranked = allMappings
    .filter((mapping) => {
      if (mapping.scope_type === 'global') return !mapping.scope_id;
      if (mapping.scope_type === 'brand') return mapping.scope_id === spa.brand_id;
      if (mapping.scope_type === 'model_line') return mapping.scope_id === (spa.model_line_id ?? spa.resolved_model_line_id);
      if (mapping.scope_type === 'spa_model') return mapping.scope_id === spa.uhtd_spa_model_id;
      return false;
    })
    .filter((mapping) => {
      if (!mapping.sanitation_system_value) return true;
      return mapping.sanitation_system_value === spa.sanitization_system;
    })
    .sort((a, b) => {
      const scopeDelta = scopeRank(a.scope_type) - scopeRank(b.scope_type);
      if (scopeDelta !== 0) return scopeDelta;
      const sanitationDelta = (a.sanitation_system_value ? 1 : 0) - (b.sanitation_system_value ? 1 : 0);
      if (sanitationDelta !== 0) return sanitationDelta;
      return a.priority - b.priority;
    });

  const winner = ranked[ranked.length - 1] ?? null;
  const profile = winner ? await getProfileById(winner.profile_id) : null;
  const tenant = await db('tenants').where({ id: tenantId }).first();
  const waterCareConfig = normalizeWaterCareConfig((tenant as { water_care_config?: unknown } | undefined)?.water_care_config);

  return {
    spaProfileId,
    sanitationSystem: spa.sanitization_system as string | null,
    source: winner
      ? {
          scopeType: winner.scope_type,
          scopeId: winner.scope_id,
          sanitationSystemValue: winner.sanitation_system_value,
          profileId: winner.profile_id,
          priority: winner.priority,
        }
      : null,
    profile,
    testingTips: waterCareConfig,
  };
}
