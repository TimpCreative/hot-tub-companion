require('dotenv').config();
const { execFileSync } = require('child_process');
const { loadTenantConfigs, getDefaultTenantKey } = require('./tenants/load-tenants');

/**
 * EAS evaluates app.config synchronously (no async/Promise). Use curl on the builder for tenant key fetch.
 */
function fetchEasTenantApiKeySync({ apiUrl, secret, slug }) {
  const base = apiUrl.replace(/\/$/, '');
  const url = `${base}/api/v1/internal/eas-tenant-config?slug=${encodeURIComponent(slug)}`;
  let out;
  try {
    out = execFileSync(
      'curl',
      ['-sS', '-f', '-H', `Authorization: Bearer ${secret}`, url],
      { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`EAS tenant config fetch failed (curl): ${msg}`);
  }
  let body;
  try {
    body = JSON.parse(out);
  } catch {
    throw new Error(`EAS tenant config response is not JSON: ${out.slice(0, 500)}`);
  }
  if (!body?.success || typeof body?.data?.tenantApiKey !== 'string' || !body.data.tenantApiKey) {
    throw new Error(`EAS tenant config response invalid: ${out.slice(0, 500)}`);
  }
  return body.data.tenantApiKey;
}

module.exports = ({ config: expoConfig }) => {
  const isEasBuild = !!process.env.EAS_BUILD;
  const explicitTenant = process.env.TENANT?.trim();
  if (isEasBuild && !explicitTenant) {
    throw new Error(
      "TENANT is required for EAS builds. Example: TENANT=htctest eas build --profile preview --platform android"
    );
  }

  const TENANT = explicitTenant || getDefaultTenantKey();
  const tenantConfig = loadTenantConfigs();
  const config = tenantConfig[TENANT];
  const isCI = process.env.CI === 'true' || process.env.CI === '1';

  if (!config) {
    const known = Object.keys(tenantConfig).join(', ');
    throw new Error(`Unknown TENANT='${TENANT}'. Known tenants: ${known}`);
  }

  require('dotenv').config({ path: config.envFile || `./tenants/${TENANT}/config.env` });

  let tenantApiKey = process.env.TENANT_API_KEY;

  if (isEasBuild && !tenantApiKey) {
    const secret = process.env.EAS_BUILD_CONFIG_SECRET;
    const apiUrl = (process.env.API_URL || '').trim();
    if (!secret || !apiUrl) {
      throw new Error(
        `EAS build requires EAS_BUILD_CONFIG_SECRET and API_URL in Expo environment variables (or TENANT_API_KEY in env for fallback). Tenant: '${TENANT}'`
      );
    }
    tenantApiKey = fetchEasTenantApiKeySync({
      apiUrl,
      secret,
      slug: config.slug,
    });
  }

  if ((isCI || isEasBuild) && !tenantApiKey) {
    throw new Error(`TENANT_API_KEY is required for tenant '${TENANT}' in CI/EAS builds.`);
  }

  return {
    ...expoConfig,
    owner: 'timpcreative',
    name: config.name,
    slug: config.slug,
    version: '1.0.0',
    orientation: 'portrait',
    icon: config.icon,
    splash: {
      image: config.splash,
      resizeMode: 'contain',
      backgroundColor: '#FFFFFF',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: config.bundleId,
      infoPlist: {
        CFBundleDisplayName: config.name,
        NSCameraUsageDescription: 'Used to identify your hot tub model',
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: config.adaptiveIcon,
        backgroundColor: '#FFFFFF',
      },
      package: config.bundleId,
    },
    scheme: config.slug,
    plugins: [
      'expo-router',
      'expo-secure-store',
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#1B4D7A',
        },
      ],
    ],
    extra: {
      eas: {
        projectId: '490cc57f-b502-4758-baf1-3d0d4077f533',
      },
      tenantSlug: config.slug,
      apiUrl: process.env.API_URL || 'https://api.hottubcompanion.com',
      tenantApiKey: tenantApiKey,
      firebaseApiKey: process.env.FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
    },
  };
};
