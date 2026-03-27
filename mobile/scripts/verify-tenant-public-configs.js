#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');
const { loadTenantConfigs } = require('../tenants/load-tenants');

const slugs = Object.keys(loadTenantConfigs());

if (slugs.length === 0) {
  console.error('No tenants found in manifest.');
  process.exit(1);
}

for (const slug of slugs) {
  console.log(`[tenant:config:all] Resolving Expo config for '${slug}'...`);
  const result = spawnSync('npx', ['expo', 'config', '--type', 'public'], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, TENANT: slug },
  });
  if (result.status !== 0) {
    console.error(`[tenant:config:all] Failed for '${slug}'.`);
    process.exit(result.status || 1);
  }
}

console.log(`[tenant:config:all] Success (${slugs.length} tenants).`);
