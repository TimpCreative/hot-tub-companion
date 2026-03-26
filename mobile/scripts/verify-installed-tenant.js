#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const [, , deviceId, tenant] = process.argv;
if (!deviceId || !tenant) {
  console.error('Usage: node scripts/verify-installed-tenant.js <device-id> <tenant>');
  process.exit(1);
}

const manifestPath = path.resolve(__dirname, '../tenants/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const cfg = manifest.tenants?.[tenant];
if (!cfg) {
  console.error(`Unknown tenant '${tenant}'.`);
  process.exit(1);
}

const res = spawnSync('xcrun', ['devicectl', 'device', 'info', 'apps', '--device', deviceId], {
  stdio: 'pipe',
  encoding: 'utf8',
});
if (res.status !== 0) {
  console.error(res.stderr || res.stdout || 'Failed to query device apps.');
  process.exit(res.status || 1);
}

const output = res.stdout || '';
const hasBundle = output.includes(cfg.bundleId);
const hasName = output.includes(cfg.name);

if (!hasBundle || !hasName) {
  console.error(`Installed app does not match tenant '${tenant}'.`);
  console.error(`Expected name='${cfg.name}', bundleId='${cfg.bundleId}'.`);
  process.exit(1);
}

console.log(`Tenant app verified on device: ${cfg.name} (${cfg.bundleId})`);
