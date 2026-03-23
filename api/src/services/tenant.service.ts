import { db } from '../config/database';
import { normalizeOnboardingConfig } from './onboardingConfig.service';
import { mapDealerContact, normalizeHomeDashboardConfig } from './homeDashboardConfig.service';
import { toProxyUrl } from '../utils/mediaUrl';

const SANITIZATION_SYSTEMS = ['bromine', 'chlorine', 'frog_ease', 'copper', 'silver_mineral'];

export async function getByApiKey(apiKey: string) {
  return db('tenants').where({ api_key: apiKey }).first();
}

export async function getConfig(tenantId: string) {
  const tenant = await db('tenants').where({ id: tenantId }).first();
  if (!tenant) return null;

  return {
    tenantId: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
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
    sanitizationSystems: SANITIZATION_SYSTEMS,
    fulfillmentMode: tenant.fulfillment_mode,
    shopifyStoreUrl: tenant.shopify_store_url,
    onboarding: normalizeOnboardingConfig(tenant.onboarding_config),
    homeDashboard: normalizeHomeDashboardConfig(tenant.home_dashboard_config),
    dealerContact: mapDealerContact(tenant),
    termsUrl: (tenant as any).terms_url?.trim() || null,
    privacyUrl: (tenant as any).privacy_url?.trim() || null,
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
