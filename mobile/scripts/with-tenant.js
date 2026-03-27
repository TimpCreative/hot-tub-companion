#!/usr/bin/env node
const { spawnSync } = require('child_process');
const { getTenantConfig } = require('../tenants/load-tenants');

const [, , tenant, ...cmd] = process.argv;
if (!tenant || cmd.length === 0) {
  console.error('Usage: node scripts/with-tenant.js <tenant> <command...>');
  process.exit(1);
}

const cfg = getTenantConfig(tenant);
if (!cfg) {
  console.error(`Unknown tenant '${tenant}'.`);
  process.exit(1);
}

const env = { ...process.env, TENANT: tenant };
const result = spawnSync(cmd[0], cmd.slice(1), {
  stdio: 'inherit',
  env,
  shell: true,
});

process.exit(result.status || 0);
