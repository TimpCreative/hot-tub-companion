/**
 * Default feature bundles when applying a SaaS preset (Super Admin).
 * See /SAAS-PLANS-AND-FEATURES.md — runtime still reads tenants.feature_* columns.
 */

export type SaasPlanPreset = 'base' | 'core' | 'advanced';

export type TenantFeatureRow = {
  feature_subscriptions: boolean;
  feature_loyalty: boolean;
  feature_referrals: boolean;
  feature_water_care: boolean;
  feature_service_scheduling: boolean;
  feature_seasonal_timeline: boolean;
  feature_tab_inbox: boolean;
  feature_tab_dealer: boolean;
};

const BASE_DEFAULTS: TenantFeatureRow = {
  feature_subscriptions: true,
  feature_loyalty: false,
  feature_referrals: true,
  feature_water_care: true,
  feature_service_scheduling: false,
  feature_seasonal_timeline: true,
  feature_tab_inbox: true,
  feature_tab_dealer: true,
};

const CORE_DEFAULTS: TenantFeatureRow = {
  feature_subscriptions: true,
  feature_loyalty: true,
  feature_referrals: true,
  feature_water_care: true,
  feature_service_scheduling: true,
  feature_seasonal_timeline: true,
  feature_tab_inbox: true,
  feature_tab_dealer: true,
};

/** Advanced = Core for feature flags today; expand when Advanced-only columns exist. */
const ADVANCED_DEFAULTS: TenantFeatureRow = { ...CORE_DEFAULTS };

export const SAAS_PLAN_PRESETS: Record<SaasPlanPreset, TenantFeatureRow> = {
  base: BASE_DEFAULTS,
  core: CORE_DEFAULTS,
  advanced: ADVANCED_DEFAULTS,
};

export function getPreset(plan: SaasPlanPreset): TenantFeatureRow {
  return { ...SAAS_PLAN_PRESETS[plan] };
}

export function isSaasPlanPreset(s: string): s is SaasPlanPreset {
  return s === 'base' || s === 'core' || s === 'advanced';
}
