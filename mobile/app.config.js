require('dotenv').config();
const { loadTenantConfigs, getDefaultTenantKey } = require('./tenants/load-tenants');

const TENANT = process.env.TENANT || getDefaultTenantKey();
const tenantConfig = loadTenantConfigs();
const config = tenantConfig[TENANT];
const isCI = process.env.CI === 'true' || process.env.CI === '1';
const isEasBuild = !!process.env.EAS_BUILD;

if (!config) {
  const known = Object.keys(tenantConfig).join(', ');
  throw new Error(`Unknown TENANT='${TENANT}'. Known tenants: ${known}`);
}

require('dotenv').config({ path: config.envFile || `./tenants/${TENANT}/config.env` });
const tenantApiKey = process.env.TENANT_API_KEY;
if ((isCI || isEasBuild) && !tenantApiKey) {
  throw new Error(`TENANT_API_KEY is required for tenant '${TENANT}' in CI/EAS builds.`);
}

export default ({ config: expoConfig }) => ({
  ...expoConfig,
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
      projectId: '4a7dbfae-165b-4ba0-b354-5e2b88442f52',
    },
    tenantSlug: config.slug,
    apiUrl: process.env.API_URL || 'https://api.hottubcompanion.com',
    tenantApiKey: tenantApiKey,
    firebaseApiKey: process.env.FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  },
});
