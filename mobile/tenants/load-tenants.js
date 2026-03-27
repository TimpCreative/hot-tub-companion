const fs = require('fs');
const path = require('path');

const TENANTS_DIR = __dirname;
const MOBILE_ROOT = path.resolve(TENANTS_DIR, '..');

function readJson(jsonPath) {
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function normalizeTenantPath(dirName, rawPath, fallback) {
  const value = typeof rawPath === 'string' && rawPath.trim() ? rawPath.trim() : fallback;
  if (value.startsWith('/')) return value;
  if (value.startsWith('./tenants/') || value.startsWith('./assets/')) return value;
  // Resolve any tenant-local path shorthand (e.g. icon.png, ./icon.png, ../assets/icon.png)
  // relative to the tenant folder, then convert back to project-root relative form.
  const absolute = path.resolve(TENANTS_DIR, dirName, value);
  const relative = path.relative(MOBILE_ROOT, absolute).replace(/\\/g, '/');
  return relative.startsWith('.') ? relative : `./${relative}`;
}

function normalizeTenantConfig(dirName, cfg) {
  return {
    ...cfg,
    icon: normalizeTenantPath(dirName, cfg.icon, `./tenants/${dirName}/icon.png`),
    splash: normalizeTenantPath(dirName, cfg.splash, `./tenants/${dirName}/splash.png`),
    adaptiveIcon: normalizeTenantPath(dirName, cfg.adaptiveIcon, `./tenants/${dirName}/adaptive-icon.png`),
    envFile: normalizeTenantPath(dirName, cfg.envFile, `./tenants/${dirName}/config.env`),
  };
}

function loadTenantConfigs() {
  const tenants = {};
  const dirs = fs
    .readdirSync(TENANTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  for (const dirName of dirs) {
    const cfgPath = path.join(TENANTS_DIR, dirName, 'tenant.json');
    if (!fs.existsSync(cfgPath)) continue;
    tenants[dirName] = normalizeTenantConfig(dirName, readJson(cfgPath));
  }

  return tenants;
}

function getTenantConfig(tenantKey) {
  const tenants = loadTenantConfigs();
  return tenants[tenantKey] || null;
}

function getDefaultTenantKey() {
  return process.env.DEFAULT_TENANT || 'default';
}

module.exports = {
  TENANTS_DIR,
  MOBILE_ROOT,
  loadTenantConfigs,
  getTenantConfig,
  getDefaultTenantKey,
};
