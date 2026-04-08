import { db } from '../config/database';
import { normalizeOnboardingConfig } from './onboardingConfig.service';
import { mapDealerContact, normalizeHomeDashboardConfig } from './homeDashboardConfig.service';
import { toProxyUrl } from '../utils/mediaUrl';
import { getSanitationSystemOptions } from './sanitationSystem.service';
import { normalizeWaterCareConfig } from './waterCareConfig.service';
import { normalizeCareScheduleConfig } from './careScheduleConfig.service';
import { buildCareScheduleReferencePayload } from './maintenanceCatalog';
import { normalizeDealerPageConfig } from './dealerPageConfig.service';

export async function getByApiKey(apiKey: string) {
  return db('tenants').where({ api_key: apiKey }).first();
}

export async function getConfig(tenantId: string) {
  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (!tenant) return null;
  const sanitationSystemOptions = await getSanitationSystemOptions();

  return {
    tenantId: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    saasPlan: (tenant as { saas_plan?: string }).saas_plan ?? 'base',
    branding: {
      primaryColor: tenant.primary_color,
      secondaryColor: tenant.secondary_color,
      accentColor: tenant.accent_color,
      fontFamily: tenant.font_family,
      logoUrl: toProxyUrl(tenant.logo_url) ?? tenant.logo_url,
      iconUrl: toProxyUrl(tenant.icon_url) ?? tenant.icon_url,
    },
    features: {
      subscriptions: tenant.feature_subscriptions,
      loyalty: tenant.feature_loyalty,
      referrals: tenant.feature_referrals,
      waterCare: tenant.feature_water_care,
      serviceScheduling: tenant.feature_service_scheduling,
      seasonalTimeline: tenant.feature_seasonal_timeline,
      /** When false, mobile app hides the Inbox tab */
      tabInbox: tenant.feature_tab_inbox !== false,
      /** When false, mobile app hides the Dealer tab */
      tabDealer: tenant.feature_tab_dealer !== false,
    },
    serviceTypes: [],
    sanitizationSystems: sanitationSystemOptions.map((option) => option.value),
    sanitationSystemOptions,
    fulfillmentMode: tenant.fulfillment_mode,
    shopifyStoreUrl: tenant.shopify_store_url,
    onboarding: normalizeOnboardingConfig(tenant.onboarding_config),
    homeDashboard: normalizeHomeDashboardConfig(tenant.home_dashboard_config),
    waterCare: normalizeWaterCareConfig((tenant as { water_care_config?: unknown }).water_care_config),
    careSchedule: normalizeCareScheduleConfig((tenant as { care_schedule_config?: unknown }).care_schedule_config),
    careScheduleReference: buildCareScheduleReferencePayload(),
    dealerContact: mapDealerContact(tenant),
    dealerPage: normalizeDealerPageConfig((tenant as { dealer_page_config?: unknown }).dealer_page_config),
    termsUrl: (tenant as any).terms_url?.trim() || null,
    privacyUrl: (tenant as any).privacy_url?.trim() || null,
    timezone: (tenant as any).timezone || 'America/Denver',
    shop: normalizeShopDisplayFromTenant(tenant),
  };
}

function normalizeShopDisplayFromTenant(tenant: Record<string, unknown>) {
  const t = tenant.shop_low_stock_threshold;
  const threshold =
    typeof t === 'number' && Number.isFinite(t) ? Math.min(999, Math.max(0, Math.trunc(t))) : 5;
  return {
    lowStockThreshold: threshold,
    showInStockWhenAboveThreshold: (tenant as { shop_show_in_stock_label?: boolean }).shop_show_in_stock_label !== false,
  };
}

export async function listTenants() {
  const rows = await db('tenants').select('*').orderBy('name');
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    apiKey: t.api_key,
    primaryColor: t.primary_color,
    secondaryColor: t.secondary_color,
    createdAt: t.created_at,
  }));
}
