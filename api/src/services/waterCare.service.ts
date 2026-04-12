import { db } from '../config/database';
import { getWaterCareLegalConfig, normalizeWaterCareConfig } from './waterCareConfig.service';
import * as waterCareConsent from './waterCareConsent.service';
import { buildRecommendations } from './waterCareRecommendation.service';
import * as maintenanceSchedule from './maintenanceSchedule.service';
import * as waterTestKitsService from './waterTestKits.service';

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

interface ProfileMetricJoinRow {
  join_id: string;
  profile_id: string;
  metric_key: string;
  label: string;
  unit: string;
  min_value: string | number;
  max_value: string | number;
  range_min: string | number;
  range_max: string | number;
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
    rangeMin: number;
    rangeMax: number;
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

interface OwnedSpaProfileRow {
  id: string;
  user_id: string;
  tenant_id: string;
  sanitization_system: string | null;
  uhtd_spa_model_id: string | null;
  brand_id: string | null;
  model_line_id: string | null;
  resolved_model_line_id: string | null;
  last_water_test_at: Date | null;
  water_capacity_gallons: number | null;
  preferred_water_test_kit_id: string | null;
}

interface WaterTestRow {
  id: string;
  user_id: string;
  tenant_id: string;
  spa_profile_id: string;
  tested_at: Date;
  shared_with_retailer: boolean;
  notes: string | null;
  water_test_kit_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface WaterTestMeasurementRow {
  id: string;
  water_test_id: string;
  metric_key: string;
  value: string | number;
  unit: string;
  created_at: Date;
}

export interface WaterTestMeasurementInput {
  metricKey: string;
  value: number;
}

export interface CreateWaterTestInput {
  spaProfileId: string;
  testedAt?: string | null;
  notes?: string | null;
  sharedWithRetailer?: boolean;
  waterTestKitId?: string | null;
  /** When tenant legal.policyVersion is set, send matching version to record acceptance in the same request. */
  policyAcceptanceVersion?: string | null;
  measurements: WaterTestMeasurementInput[];
}

export interface WaterTestMeasurement {
  id: string;
  metricKey: string;
  value: number;
  unit: string;
}

export type WaterRecommendationAction = import('./waterCareRecommendation.service').RecommendationAction;

export interface WaterTestRecord {
  id: string;
  spaProfileId: string;
  testedAt: Date;
  sharedWithRetailer: boolean;
  notes: string | null;
  waterTestKitId: string | null;
  measurements: WaterTestMeasurement[];
  recommendations?: WaterRecommendationAction[];
  createdAt: Date;
}

export interface WaterCareComparisonRow {
  metricKey: string;
  label: string;
  unit: string;
  idealMin: number;
  idealMax: number;
  recentValue: number | null;
  status: 'low' | 'in_range' | 'high' | 'missing';
}

function mapMeasurement(row: ProfileMetricJoinRow) {
  return {
    id: row.join_id,
    metricKey: row.metric_key,
    label: row.label,
    unit: row.unit,
    minValue: Number(row.min_value),
    maxValue: Number(row.max_value),
    rangeMin: Number(row.range_min),
    rangeMax: Number(row.range_max),
    sortOrder: row.sort_order,
    isEnabled: row.is_enabled,
  };
}

/** Enforces rangeMin <= defaultMin <= defaultMax <= rangeMax. */
export function validateWaterMetricDefinition(input: {
  rangeMin: number;
  defaultMinValue: number;
  defaultMaxValue: number;
  rangeMax: number;
}): void {
  const { rangeMin, defaultMinValue, defaultMaxValue, rangeMax } = input;
  if (![rangeMin, defaultMinValue, defaultMaxValue, rangeMax].every((n) => Number.isFinite(n))) {
    throw new Error('METRIC_VALUES_INVALID');
  }
  if (rangeMin > rangeMax) {
    throw new Error('METRIC_RANGE_ORDER');
  }
  if (defaultMinValue < rangeMin || defaultMinValue > defaultMaxValue) {
    throw new Error('METRIC_DEFAULT_MIN_INVALID');
  }
  if (defaultMaxValue > rangeMax || defaultMaxValue < defaultMinValue) {
    throw new Error('METRIC_DEFAULT_MAX_INVALID');
  }
}

function mapProfile(row: WaterCareProfileRow, measurements: ProfileMetricJoinRow[]): WaterCareProfile {
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

function mapWaterTestMeasurement(row: WaterTestMeasurementRow): WaterTestMeasurement {
  return {
    id: row.id,
    metricKey: row.metric_key,
    value: Number(row.value),
    unit: row.unit,
  };
}

function mapWaterTest(
  row: WaterTestRow,
  measurements: WaterTestMeasurementRow[],
  recommendations?: WaterRecommendationAction[]
): WaterTestRecord {
  return {
    id: row.id,
    spaProfileId: row.spa_profile_id,
    testedAt: row.tested_at,
    sharedWithRetailer: row.shared_with_retailer,
    notes: row.notes,
    waterTestKitId: row.water_test_kit_id ?? null,
    measurements: measurements
      .filter((measurement) => measurement.water_test_id === row.id)
      .sort((a, b) => a.metric_key.localeCompare(b.metric_key))
      .map(mapWaterTestMeasurement),
    recommendations,
    createdAt: row.created_at,
  };
}

async function getOwnedSpaProfile(
  spaProfileId: string,
  tenantId: string,
  userId: string
): Promise<OwnedSpaProfileRow | null> {
  const spa = await db('spa_profiles as sp')
    .leftJoin('scdb_spa_models as spa_model', 'sp.uhtd_spa_model_id', 'spa_model.id')
    .leftJoin('scdb_model_lines as ml', 'spa_model.model_line_id', 'ml.id')
    .select(
      'sp.id',
      'sp.user_id',
      'sp.tenant_id',
      'sp.sanitization_system',
      'sp.uhtd_spa_model_id',
      'sp.last_water_test_at',
      'sp.preferred_water_test_kit_id',
      'spa_model.brand_id',
      'spa_model.model_line_id',
      'spa_model.water_capacity_gallons',
      'ml.id as resolved_model_line_id'
    )
    .where('sp.id', spaProfileId)
    .andWhere('sp.tenant_id', tenantId)
    .andWhere('sp.user_id', userId)
    .first();

  return (spa as OwnedSpaProfileRow | undefined) ?? null;
}

function normalizeMetricKey(raw: string): string {
  return raw.trim().toLowerCase();
}

async function ensureMetricId(trx: typeof db, measurement: WaterCareMeasurementInput): Promise<string> {
  const key = normalizeMetricKey(measurement.metricKey);
  const existing = await trx('water_metrics').where({ metric_key: key }).first();
  if (existing) {
    await trx('water_metrics')
      .where({ id: (existing as { id: string }).id })
      .update({
        label: measurement.label.trim(),
        unit: measurement.unit.trim(),
        updated_at: trx.fn.now(),
      });
    return (existing as { id: string }).id;
  }
  const [inserted] = await trx('water_metrics')
    .insert({
      metric_key: key,
      label: measurement.label.trim(),
      unit: measurement.unit.trim(),
      default_min_value: measurement.minValue,
      default_max_value: measurement.maxValue,
      range_min: measurement.minValue,
      range_max: measurement.maxValue,
      sort_hint: measurement.sortOrder ?? 0,
      value_type: 'numeric',
      created_at: trx.fn.now(),
      updated_at: trx.fn.now(),
    })
    .returning('id');
  const row = inserted as { id: string } | string;
  return typeof row === 'object' && row && 'id' in row ? row.id : (row as string);
}

async function assertProfileMeasurementsWithinLibrary(
  trx: typeof db,
  measurements: WaterCareMeasurementInput[]
): Promise<void> {
  for (const m of measurements) {
    const key = normalizeMetricKey(m.metricKey);
    const wm = (await trx('water_metrics').where({ metric_key: key }).first()) as Record<string, unknown> | undefined;
    if (!wm) {
      throw new Error('UNKNOWN_METRIC_KEY');
    }
    const rangeMin = Number(wm.range_min);
    const rangeMax = Number(wm.range_max);
    const minV = Number(m.minValue);
    const maxV = Number(m.maxValue);
    if (!Number.isFinite(minV) || !Number.isFinite(maxV)) {
      throw new Error('PROFILE_MEASUREMENT_BOUNDS');
    }
    if (minV < rangeMin || maxV > rangeMax || minV > maxV) {
      throw new Error('PROFILE_MEASUREMENT_BOUNDS');
    }
  }
}

async function replaceMeasurements(
  trx: typeof db,
  profileId: string,
  measurements: WaterCareMeasurementInput[]
): Promise<void> {
  await assertProfileMeasurementsWithinLibrary(trx, measurements);

  await trx('water_care_profile_metrics').where({ profile_id: profileId }).del();

  if (measurements.length === 0) return;

  for (let index = 0; index < measurements.length; index++) {
    const measurement = measurements[index];
    const metricId = await ensureMetricId(trx, measurement);
    await trx('water_care_profile_metrics').insert({
      profile_id: profileId,
      metric_id: metricId,
      min_value: measurement.minValue,
      max_value: measurement.maxValue,
      sort_order: measurement.sortOrder ?? index,
      is_enabled: measurement.isEnabled !== false,
      created_at: trx.fn.now(),
    });
  }
}

function sanitizeMeasurements(measurements: WaterCareMeasurementInput[]): WaterCareMeasurementInput[] {
  return measurements
    .map((measurement, index) => ({
      metricKey: normalizeMetricKey(measurement.metricKey ?? ''),
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

async function loadProfileMetricJoins(profileIds: string[]): Promise<ProfileMetricJoinRow[]> {
  if (profileIds.length === 0) return [];
  const rows = await db('water_care_profile_metrics as wcpm')
    .join('water_metrics as wm', 'wcpm.metric_id', 'wm.id')
    .whereIn('wcpm.profile_id', profileIds)
    .select(
      'wcpm.id as join_id',
      'wcpm.profile_id',
      'wm.metric_key',
      'wm.label',
      'wm.unit',
      db.raw('COALESCE(wcpm.min_value, wm.default_min_value) as min_value'),
      db.raw('COALESCE(wcpm.max_value, wm.default_max_value) as max_value'),
      'wm.range_min',
      'wm.range_max',
      'wcpm.sort_order',
      'wcpm.is_enabled'
    )
    .orderBy('wcpm.sort_order')
    .orderBy('wm.label');
  return rows as ProfileMetricJoinRow[];
}

export async function listProfiles(): Promise<WaterCareProfile[]> {
  const profiles = (await db('water_care_profiles').orderBy('name')) as WaterCareProfileRow[];
  const joins = await loadProfileMetricJoins(profiles.map((p) => p.id));
  return profiles.map((profile) => mapProfile(profile, joins));
}

export async function getProfileById(id: string): Promise<WaterCareProfile | null> {
  const profile = await db('water_care_profiles').where({ id }).first();
  if (!profile) return null;
  const joins = await loadProfileMetricJoins([id]);
  return mapProfile(profile as WaterCareProfileRow, joins);
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

async function resolveWinningProfileMapping(spa: OwnedSpaProfileRow): Promise<WaterCareMappingRow | null> {
  const allMappings = (await db('water_care_profile_mappings').select('*')) as WaterCareMappingRow[];
  const ranked = allMappings
    .filter((mapping) => {
      if (mapping.scope_type === 'global') return !mapping.scope_id;
      if (mapping.scope_type === 'brand') return mapping.scope_id === spa.brand_id;
      if (mapping.scope_type === 'model_line') {
        return mapping.scope_id === (spa.model_line_id ?? spa.resolved_model_line_id);
      }
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

  return ranked[ranked.length - 1] ?? null;
}

function getComparisonStatus(
  recentValue: number | null,
  idealMin: number,
  idealMax: number
): WaterCareComparisonRow['status'] {
  if (recentValue == null) return 'missing';
  if (recentValue < idealMin) return 'low';
  if (recentValue > idealMax) return 'high';
  return 'in_range';
}

export async function listWaterTestsForSpaProfile(
  spaProfileId: string,
  tenantId: string,
  userId: string
): Promise<WaterTestRecord[] | null> {
  const spa = await getOwnedSpaProfile(spaProfileId, tenantId, userId);
  if (!spa) return null;

  const tests = (await db('water_tests')
    .where({ spa_profile_id: spaProfileId, tenant_id: tenantId, user_id: userId })
    .orderBy('tested_at', 'desc')
    .orderBy('created_at', 'desc')) as WaterTestRow[];

  if (tests.length === 0) return [];

  const measurements = (await db('water_test_measurements')
    .whereIn(
      'water_test_id',
      tests.map((test) => test.id)
    )
    .orderBy('created_at', 'asc')) as WaterTestMeasurementRow[];

  return tests.map((test) => mapWaterTest(test, measurements, undefined));
}

export async function createWaterTest(
  tenantId: string,
  userId: string,
  input: CreateWaterTestInput
): Promise<WaterTestRecord | null> {
  const spa = await getOwnedSpaProfile(input.spaProfileId, tenantId, userId);
  if (!spa) return null;

  const tenant = await db('tenants').where({ id: tenantId }).first();
  const legal = getWaterCareLegalConfig((tenant as { water_care_config?: unknown } | undefined)?.water_care_config);
  if (legal.policyVersion.trim()) {
    const already = await waterCareConsent.hasAcceptedCurrentPolicy(userId, tenantId, legal.policyVersion);
    const inline = (input.policyAcceptanceVersion ?? '').trim() === legal.policyVersion;
    if (!already && !inline) {
      throw new Error('WATER_CARE_CONSENT_REQUIRED');
    }
  }

  let kitId: string | null = null;
  if (input.waterTestKitId) {
    const kit = await waterTestKitsService.getPublishedKitById(input.waterTestKitId);
    if (!kit) throw new Error('INVALID_WATER_TEST_KIT');
    kitId = kit.id;
  }

  const winner = await resolveWinningProfileMapping(spa);
  const profile = winner ? await getProfileById(winner.profile_id) : null;
  const allowedMetrics = new Map(
    (profile?.measurements ?? []).map((measurement) => [
      normalizeMetricKey(measurement.metricKey),
      measurement,
    ])
  );

  const measurements = input.measurements
    .map((measurement) => ({
      metricKey: normalizeMetricKey(measurement.metricKey ?? ''),
      value: Number(measurement.value),
    }))
    .filter((measurement) => measurement.metricKey && Number.isFinite(measurement.value))
    .filter((measurement) => allowedMetrics.has(measurement.metricKey));

  if (measurements.length === 0) {
    throw new Error('At least one valid measurement is required');
  }

  const testedAt = input.testedAt ? new Date(input.testedAt) : new Date();
  if (Number.isNaN(testedAt.getTime())) {
    throw new Error('Invalid testedAt');
  }

  const trx = await db.transaction();
  try {
    if (legal.policyVersion.trim() && (input.policyAcceptanceVersion ?? '').trim() === legal.policyVersion) {
      const dup = await trx('user_water_care_consents')
        .where({ user_id: userId, tenant_id: tenantId, policy_version: legal.policyVersion })
        .first();
      if (!dup) {
        await trx('user_water_care_consents').insert({
          user_id: userId,
          tenant_id: tenantId,
          policy_version: legal.policyVersion,
          spa_profile_id: input.spaProfileId,
          accepted_at: trx.fn.now(),
        });
      }
    }

    const [created] = await trx('water_tests')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        spa_profile_id: input.spaProfileId,
        tested_at: testedAt,
        shared_with_retailer: input.sharedWithRetailer === true,
        notes: input.notes?.trim() || null,
        water_test_kit_id: kitId,
      })
      .returning('*');

    await trx('water_test_measurements').insert(
      measurements.map((measurement) => ({
        water_test_id: created.id,
        metric_key: measurement.metricKey,
        value: measurement.value,
        unit: allowedMetrics.get(measurement.metricKey)?.unit ?? '',
      }))
    );

    const latestForSpa = await trx('water_tests')
      .where({
        spa_profile_id: input.spaProfileId,
        tenant_id: tenantId,
        user_id: userId,
      })
      .max('tested_at as latest')
      .first();

    await trx('spa_profiles')
      .where({ id: input.spaProfileId, tenant_id: tenantId, user_id: userId })
      .update({
        last_water_test_at: (latestForSpa as { latest?: Date | null } | undefined)?.latest ?? testedAt,
        updated_at: trx.fn.now(),
      });

    if (kitId) {
      await trx('spa_profiles')
        .where({ id: input.spaProfileId, tenant_id: tenantId, user_id: userId })
        .update({
          preferred_water_test_kit_id: kitId,
          updated_at: trx.fn.now(),
        });
    }

    await trx.commit();

    const idealByMetric = new Map(
      (profile?.measurements ?? []).map((m) => [
        normalizeMetricKey(m.metricKey),
        { min: m.minValue, max: m.maxValue },
      ])
    );
    const recommendations = await buildRecommendations({
      measurements,
      idealByMetric,
      volumeGallons: spa.water_capacity_gallons ?? 0,
      sanitizer: spa.sanitization_system,
    });

    const allInRange = (profile?.measurements ?? []).every((m) => {
      const mv = measurements.find((x) => x.metricKey === normalizeMetricKey(m.metricKey));
      if (!mv) return false;
      return mv.value >= m.minValue && mv.value <= m.maxValue;
    });
    if (allInRange) {
      void maintenanceSchedule.regenerateAutoEventsForSpaProfile(input.spaProfileId).catch(() => undefined);
    }

    const row = (await db('water_tests').where({ id: created.id }).first()) as WaterTestRow;
    const mrows = (await db('water_test_measurements').where({ water_test_id: created.id })) as WaterTestMeasurementRow[];
    return mapWaterTest(row, mrows, recommendations);
  } catch (error) {
    await trx.rollback();
    throw error;
  }
}

export async function resolveWaterCareForSpaProfile(
  spaProfileId: string,
  tenantId: string,
  userId: string
) {
  const spa = await getOwnedSpaProfile(spaProfileId, tenantId, userId);
  if (!spa) return null;

  const winner = await resolveWinningProfileMapping(spa);
  const profile = winner ? await getProfileById(winner.profile_id) : null;
  const latestTest = (await listWaterTestsForSpaProfile(spaProfileId, tenantId, userId))?.[0] ?? null;
  const latestMeasurementMap = new Map(
    (latestTest?.measurements ?? []).map((measurement) => [
      normalizeMetricKey(measurement.metricKey),
      measurement,
    ])
  );
  const comparison: WaterCareComparisonRow[] = (profile?.measurements ?? []).map((measurement) => {
    const latest = latestMeasurementMap.get(normalizeMetricKey(measurement.metricKey));
    const recentValue = latest?.value ?? null;
    return {
      metricKey: measurement.metricKey,
      label: measurement.label,
      unit: measurement.unit,
      idealMin: measurement.minValue,
      idealMax: measurement.maxValue,
      recentValue,
      status: getComparisonStatus(recentValue, measurement.minValue, measurement.maxValue),
    };
  });
  const tenant = await db('tenants').where({ id: tenantId }).first();
  const waterCareConfig = normalizeWaterCareConfig(
    (tenant as { water_care_config?: unknown } | undefined)?.water_care_config
  );
  const consent = await waterCareConsent.getConsentStatusForUser(userId, tenantId);
  const publishedKits = await waterTestKitsService.listPublishedKits();

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
    latestTestId: latestTest?.id ?? null,
    latestTestDate: latestTest?.testedAt ?? null,
    latestMeasurements: latestTest?.measurements ?? [],
    comparison,
    testingTips: waterCareConfig,
    consent: {
      needsAcceptance: consent.needsAcceptance,
      policyVersion: consent.policyVersion,
    },
    waterTestKits: publishedKits,
    preferredWaterTestKitId: spa.preferred_water_test_kit_id ?? null,
  };
}

export async function listWaterMetrics(): Promise<
  Array<{
    id: string;
    metricKey: string;
    label: string;
    unit: string;
    rangeMin: number;
    defaultMinValue: number;
    defaultMaxValue: number;
    rangeMax: number;
    sortHint: number;
    valueType: string;
  }>
> {
  const rows = await db('water_metrics').orderBy('metric_key');
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    metricKey: r.metric_key as string,
    label: r.label as string,
    unit: r.unit as string,
    rangeMin: Number(r.range_min),
    defaultMinValue: Number(r.default_min_value),
    defaultMaxValue: Number(r.default_max_value),
    rangeMax: Number(r.range_max),
    sortHint: r.sort_hint as number,
    valueType: (r.value_type as string) || 'numeric',
  }));
}

export async function createWaterMetric(input: {
  metricKey: string;
  label: string;
  unit: string;
  rangeMin: number;
  defaultMinValue: number;
  defaultMaxValue: number;
  rangeMax: number;
  sortHint?: number;
}): Promise<{
  id: string;
  metricKey: string;
  label: string;
  unit: string;
  rangeMin: number;
  defaultMinValue: number;
  defaultMaxValue: number;
  rangeMax: number;
  sortHint: number;
  valueType: string;
}> {
  const metricKey = normalizeMetricKey(input.metricKey).slice(0, 80);
  if (!metricKey) {
    throw new Error('METRIC_KEY_REQUIRED');
  }
  const dup = await db('water_metrics').where({ metric_key: metricKey }).first();
  if (dup) {
    throw new Error('METRIC_KEY_EXISTS');
  }
  const label = input.label.trim().slice(0, 120);
  const unit = input.unit.trim().slice(0, 40);
  if (!label || !unit) {
    throw new Error('METRIC_LABEL_UNIT_REQUIRED');
  }
  validateWaterMetricDefinition({
    rangeMin: Number(input.rangeMin),
    defaultMinValue: Number(input.defaultMinValue),
    defaultMaxValue: Number(input.defaultMaxValue),
    rangeMax: Number(input.rangeMax),
  });
  const [inserted] = await db('water_metrics')
    .insert({
      metric_key: metricKey,
      label,
      unit,
      range_min: input.rangeMin,
      default_min_value: input.defaultMinValue,
      default_max_value: input.defaultMaxValue,
      range_max: input.rangeMax,
      sort_hint: input.sortHint ?? 0,
      value_type: 'numeric',
      created_at: db.fn.now(),
      updated_at: db.fn.now(),
    })
    .returning('*');
  const row = inserted as Record<string, unknown>;
  return {
    id: row.id as string,
    metricKey: row.metric_key as string,
    label: row.label as string,
    unit: row.unit as string,
    rangeMin: Number(row.range_min),
    defaultMinValue: Number(row.default_min_value),
    defaultMaxValue: Number(row.default_max_value),
    rangeMax: Number(row.range_max),
    sortHint: row.sort_hint as number,
    valueType: (row.value_type as string) || 'numeric',
  };
}

export async function updateWaterMetric(
  id: string,
  patch: {
    label?: string;
    unit?: string;
    rangeMin?: number;
    defaultMinValue?: number;
    defaultMaxValue?: number;
    rangeMax?: number;
    sortHint?: number;
  }
): Promise<boolean> {
  const existing = (await db('water_metrics').where({ id }).first()) as Record<string, unknown> | undefined;
  if (!existing) return false;
  const update: Record<string, unknown> = { updated_at: db.fn.now() };
  if (patch.label !== undefined) update.label = patch.label.trim().slice(0, 120);
  if (patch.unit !== undefined) update.unit = patch.unit.trim().slice(0, 40);
  if (patch.rangeMin !== undefined) update.range_min = patch.rangeMin;
  if (patch.defaultMinValue !== undefined) update.default_min_value = patch.defaultMinValue;
  if (patch.defaultMaxValue !== undefined) update.default_max_value = patch.defaultMaxValue;
  if (patch.rangeMax !== undefined) update.range_max = patch.rangeMax;
  if (patch.sortHint !== undefined) update.sort_hint = patch.sortHint;

  const nextRangeMin = update.range_min !== undefined ? Number(update.range_min) : Number(existing.range_min);
  const nextDefMin =
    update.default_min_value !== undefined ? Number(update.default_min_value) : Number(existing.default_min_value);
  const nextDefMax =
    update.default_max_value !== undefined ? Number(update.default_max_value) : Number(existing.default_max_value);
  const nextRangeMax = update.range_max !== undefined ? Number(update.range_max) : Number(existing.range_max);

  if (
    patch.rangeMin !== undefined ||
    patch.rangeMax !== undefined ||
    patch.defaultMinValue !== undefined ||
    patch.defaultMaxValue !== undefined
  ) {
    validateWaterMetricDefinition({
      rangeMin: nextRangeMin,
      defaultMinValue: nextDefMin,
      defaultMaxValue: nextDefMax,
      rangeMax: nextRangeMax,
    });
  }

  if (Object.keys(update).length > 1) {
    await db('water_metrics').where({ id }).update(update);
  }
  return true;
}
