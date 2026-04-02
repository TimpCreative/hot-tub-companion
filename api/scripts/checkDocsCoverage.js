/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GENERATED_DIR = path.join(ROOT, 'src', 'docs', 'generated');

const requiredOpenApiGroups = new Set(['super-admin', 'admin', 'auth', 'users', 'spa-profiles', 'water-care']);

function readJson(name) {
  const full = path.join(GENERATED_DIR, name);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing generated file: ${name}`);
  }
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

function toSet(inventory) {
  const set = new Set();
  for (const ep of inventory.endpoints || []) set.add(`${ep.method} ${ep.path}`);
  return set;
}

function openApiSet(spec) {
  const set = new Set();
  for (const [p, ops] of Object.entries(spec.paths || {})) {
    for (const m of Object.keys(ops || {})) {
      set.add(`${String(m).toUpperCase()} ${p}`);
    }
  }
  return set;
}

function endpointGroup(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (pathname.startsWith('/api/v1/super-admin/')) return 'super-admin';
  if (pathname.startsWith('/api/v1/admin/')) return 'admin';
  if (pathname.startsWith('/api/v1/auth/')) return 'auth';
  return parts[2] || 'misc';
}

function main() {
  const inventory = readJson('apiInventory.json');
  const usage = readJson('usageIndex.json');
  const openapi = readJson('openapi.json');

  const invSet = toSet(inventory);
  const specSet = openApiSet(openapi);
  const usageSet = new Set((usage.endpoints || []).map((e) => `${e.method} ${e.path}`));

  const missingInSpec = [];
  const missingInUsage = [];
  const missingRequiredGroups = [];

  for (const inv of inventory.endpoints || []) {
    const sig = `${inv.method} ${inv.path}`;
    if (!specSet.has(sig)) missingInSpec.push(sig);
    if (!usageSet.has(sig)) missingInUsage.push(sig);
    const group = endpointGroup(inv.path);
    if (requiredOpenApiGroups.has(group) && !specSet.has(sig)) {
      missingRequiredGroups.push(sig);
    }
  }

  if (missingInSpec.length || missingRequiredGroups.length) {
    console.error('Docs coverage check failed.');
    if (missingInSpec.length) console.error(`- Missing OpenAPI ops: ${missingInSpec.slice(0, 20).join(', ')}${missingInSpec.length > 20 ? ' ...' : ''}`);
    if (missingRequiredGroups.length) console.error(`- Missing required-group OpenAPI ops: ${missingRequiredGroups.slice(0, 20).join(', ')}${missingRequiredGroups.length > 20 ? ' ...' : ''}`);
    process.exit(1);
  }

  console.log(`Docs coverage OK. inventory=${invSet.size} openapi=${specSet.size} usageMapped=${usageSet.size}`);
  if (missingInUsage.length) {
    console.log(`Usage map note: ${missingInUsage.length} endpoints have no direct usage mapping yet.`);
  }
}

main();
