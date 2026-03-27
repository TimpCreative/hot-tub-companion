#!/usr/bin/env node
/**
 * Regenerates mobile/eas.json build + submit profiles from each tenants/<slug>/tenant.json.
 * Run after adding a tenant folder: npm run eas:generate
 *
 * Produces, per tenant slug:
 *   - preview-<slug>   (internal, Expo "preview" env)
 *   - production-<slug> (store, Expo "production" env)
 *
 * Keeps a single development profile (dev client); TENANT is fixed below.
 */
const fs = require('fs');
const path = require('path');

const MOBILE_ROOT = path.resolve(__dirname, '..');
const TENANTS_DIR = path.join(MOBILE_ROOT, 'tenants');
const EAS_JSON_PATH = path.join(MOBILE_ROOT, 'eas.json');

/** Tenant used for the shared development-client profile (change if you prefer). */
const DEVELOPMENT_TENANT = 'htctest';

/** Slugs skipped for preview-* / production-* (template tenant, not a retailer store app). */
const EXCLUDED_FROM_EAS_PROFILES = new Set(['default']);

function getTenantSlugs() {
  const slugs = [];
  for (const entry of fs.readdirSync(TENANTS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const tenantJson = path.join(TENANTS_DIR, entry.name, 'tenant.json');
    if (!fs.existsSync(tenantJson)) continue;
    if (EXCLUDED_FROM_EAS_PROFILES.has(entry.name)) continue;
    slugs.push(entry.name);
  }
  return slugs.sort();
}

function main() {
  const slugs = getTenantSlugs();
  if (slugs.length === 0) {
    console.error('No tenants found (expected */tenant.json under tenants/).');
    process.exit(1);
  }

  const build = {
    development: {
      developmentClient: true,
      distribution: 'internal',
      environment: 'development',
      env: {
        APP_VARIANT: 'development',
        TENANT: DEVELOPMENT_TENANT,
      },
    },
  };

  for (const slug of slugs) {
    build[`preview-${slug}`] = {
      distribution: 'internal',
      environment: 'preview',
      env: {
        APP_VARIANT: 'preview',
        TENANT: slug,
      },
    };
    build[`production-${slug}`] = {
      distribution: 'store',
      environment: 'production',
      env: {
        APP_VARIANT: 'production',
        TENANT: slug,
      },
    };
  }

  const submit = {};
  for (const slug of slugs) {
    submit[`production-${slug}`] = {
      android: {
        serviceAccountKeyPath: './google-play-service-account.json',
      },
    };
  }

  const out = {
    cli: {
      version: '>= 7.0.0',
    },
    build,
    submit,
  };

  fs.writeFileSync(EAS_JSON_PATH, `${JSON.stringify(out, null, 2)}\n`);
  const previewCount = slugs.length;
  console.log(
    `Wrote eas.json — ${slugs.length} tenant(s), ${previewCount} preview-* + ${previewCount} production-* (+ development).`
  );
}

main();
