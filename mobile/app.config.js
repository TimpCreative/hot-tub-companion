require('dotenv').config();
require('dotenv').config({ path: `./tenants/${process.env.TENANT || 'default'}/config.env` });
const TENANT = process.env.TENANT || 'default';

const tenantConfig = {
  takeabreak: {
    name: 'Take A Break Spas',
    slug: 'takeabreak',
    bundleId: 'com.hottubcompanion.takeabreak',
    icon: './tenants/takeabreak/icon.png',
    splash: './tenants/takeabreak/splash.png',
    adaptiveIcon: './tenants/takeabreak/adaptive-icon.png',
  },
  default: {
    name: 'Hot Tub Companion',
    slug: 'hottubcompanion',
    bundleId: 'com.hottubcompanion.default',
    icon: './assets/icon.png',
    splash: './assets/splash-icon.png',
    adaptiveIcon: './assets/adaptive-icon.png',
  },
};

const config = tenantConfig[TENANT] || tenantConfig.default;

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
  scheme: 'hottubcompanion',
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
    tenantSlug: config.slug,
    apiUrl: process.env.API_URL || 'https://api.hottubcompanion.com',
    tenantApiKey: process.env.TENANT_API_KEY,
    firebaseApiKey: process.env.FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
  },
});
