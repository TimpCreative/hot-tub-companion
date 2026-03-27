#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { TENANTS_DIR, MOBILE_ROOT, loadTenantConfigs, getDefaultTenantKey } = require('../tenants/load-tenants');

const tenants = loadTenantConfigs();
const errors = [];
const seenSlugs = new Set();
const seenBundleIds = new Set();

const defaultTenant = getDefaultTenantKey();
if (!tenants[defaultTenant]) {
  errors.push(`default tenant '${defaultTenant}' is not present (set DEFAULT_TENANT or create ./tenants/${defaultTenant}/tenant.json).`);
}

const tenantKeys = Object.keys(tenants);
if (tenantKeys.length === 0) {
  errors.push('tenants must include at least one tenant.');
}

for (const [slug, cfg] of Object.entries(tenants)) {
  if (!cfg || typeof cfg !== 'object') {
    errors.push(`${slug}: config must be an object.`);
    continue;
  }
  if (!cfg.name || !cfg.bundleId || !cfg.slug) {
    errors.push(`${slug}: missing required keys (name, slug, bundleId).`);
  }
  if (typeof cfg.slug !== 'string' || cfg.slug.trim().length === 0) {
    errors.push(`${slug}: slug must be a non-empty string.`);
  }
  if (!/^[a-z0-9-]+$/.test(cfg.slug || '')) {
    errors.push(`${slug}: slug must match /^[a-z0-9-]+$/`);
  }
  if (seenSlugs.has(cfg.slug)) {
    errors.push(`${slug}: duplicate slug '${cfg.slug}'.`);
  } else {
    seenSlugs.add(cfg.slug);
  }

  if (typeof cfg.bundleId !== 'string' || !/^[a-zA-Z0-9]+(\.[a-zA-Z0-9_-]+)+$/.test(cfg.bundleId)) {
    errors.push(`${slug}: bundleId must look like a reverse-DNS identifier.`);
  }
  if (seenBundleIds.has(cfg.bundleId)) {
    errors.push(`${slug}: duplicate bundleId '${cfg.bundleId}'.`);
  } else {
    seenBundleIds.add(cfg.bundleId);
  }

  if (cfg.envFile != null) {
    if (typeof cfg.envFile !== 'string' || !cfg.envFile.startsWith('./')) {
      errors.push(`${slug}: envFile must be a project-relative path starting with ./`);
    } else if (
      !path.basename(cfg.envFile).endsWith('.env') &&
      !path.basename(cfg.envFile).endsWith('.env.example')
    ) {
      errors.push(`${slug}: envFile should reference a .env path.`);
    } else {
      const envPath = path.resolve(MOBILE_ROOT, cfg.envFile);
      if (!fs.existsSync(envPath)) {
        errors.push(`${slug}: env file '${cfg.envFile}' does not exist.`);
      }
    }
  }

  for (const key of ['icon', 'splash', 'adaptiveIcon']) {
    if (!cfg[key]) continue;
    const p = path.resolve(MOBILE_ROOT, cfg[key]);
    if (!fs.existsSync(p)) {
      errors.push(`${slug}: missing asset '${cfg[key]}'`);
    }
  }
}

// Detect stray tenant.json placement issues early.
const tenantJsonPaths = fs
  .readdirSync(TENANTS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(TENANTS_DIR, entry.name, 'tenant.json'))
  .filter((p) => fs.existsSync(p));
if (tenantJsonPaths.length !== tenantKeys.length) {
  errors.push('Every tenant folder should define tenant.json (or remove unused folder).');
}

if (errors.length) {
  console.error('Tenant config validation failed:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log(`Tenant configs valid (${Object.keys(tenants).length} tenants).`);
