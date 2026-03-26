#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const manifestPath = path.resolve(__dirname, '../tenants/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const tenants = manifest.tenants || {};
const errors = [];

for (const [slug, cfg] of Object.entries(tenants)) {
  if (!cfg.name || !cfg.bundleId || !cfg.slug) {
    errors.push(`${slug}: missing required keys (name, slug, bundleId).`);
  }
  if (typeof cfg.slug !== 'string' || cfg.slug.trim().length === 0) {
    errors.push(`${slug}: slug must be a non-empty string.`);
  }
  for (const key of ['icon', 'splash', 'adaptiveIcon']) {
    if (!cfg[key]) continue;
    const p = path.resolve(__dirname, '..', cfg[key]);
    if (!fs.existsSync(p)) {
      errors.push(`${slug}: missing asset '${cfg[key]}'`);
    }
  }
}

if (errors.length) {
  console.error('Tenant manifest validation failed:');
  for (const e of errors) console.error(`- ${e}`);
  process.exit(1);
}

console.log(`Tenant manifest valid (${Object.keys(tenants).length} tenants).`);
