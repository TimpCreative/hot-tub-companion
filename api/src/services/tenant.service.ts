import { db } from '../config/database';

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
      logoUrl: tenant.logo_url,
      iconUrl: tenant.icon_url,
    },
    features: {
      subscriptions: tenant.feature_subscriptions,
      loyalty: tenant.feature_loyalty,
      referrals: tenant.feature_referrals,
      waterCare: tenant.feature_water_care,
      serviceScheduling: tenant.feature_service_scheduling,
      seasonalTimeline: tenant.feature_seasonal_timeline,
    },
    serviceTypes: [],
    sanitizationSystems: SANITIZATION_SYSTEMS,
    fulfillmentMode: tenant.fulfillment_mode,
    shopifyStoreUrl: tenant.shopify_store_url,
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
