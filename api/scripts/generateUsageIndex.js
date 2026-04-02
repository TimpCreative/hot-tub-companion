/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(ROOT, 'api', 'src', 'docs', 'generated');

function listFiles(dir, out = []) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.name === 'node_modules' || item.name === '.next' || item.name === 'dist' || item.name === 'ios' || item.name === 'android') continue;
    const abs = path.join(dir, item.name);
    if (item.isDirectory()) listFiles(abs, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(item.name)) out.push(abs);
  }
  return out;
}

function rel(abs) {
  return abs.replace(`${ROOT}/`, '');
}

function normalize(pathStr) {
  return pathStr.startsWith('/api/v1') ? pathStr : `/api/v1${pathStr.startsWith('/') ? pathStr : `/${pathStr}`}`;
}

function collectDashboard(files) {
  const results = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const m of content.matchAll(/\/api\/dashboard\/super-admin\/([^'"`\s)]+)/g)) {
      results.push({ method: '*', path: normalize(`/super-admin/${m[1]}`), file: rel(file), app: 'dashboard' });
    }
    for (const m of content.matchAll(/\/api\/dashboard\/proxy\/([^'"`\s)]+)/g)) {
      results.push({ method: '*', path: normalize(`/${m[1]}`), file: rel(file), app: 'dashboard' });
    }
    for (const m of content.matchAll(/create(SuperAdmin|Tenant)ApiClient\(\)\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g)) {
      const mode = m[1];
      const method = m[2].toUpperCase();
      const raw = m[3];
      const p = mode === 'SuperAdmin' ? normalize(`/super-admin${raw}`) : normalize(raw);
      results.push({ method, path: p, file: rel(file), app: 'dashboard' });
    }
  }
  return results;
}

function collectMobile(files) {
  const results = [];
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    for (const m of content.matchAll(/\bapi\.(get|post|put|patch|delete)\(\s*['"`]([^'"`]+)['"`]/g)) {
      results.push({ method: m[1].toUpperCase(), path: normalize(m[2]), file: rel(file), app: 'mobile' });
    }
  }
  return results;
}

function dedupeFiles(items) {
  return Array.from(new Set(items)).sort();
}

function main() {
  const dashboardFiles = listFiles(path.join(ROOT, 'dashboard', 'src'));
  const mobileFiles = listFiles(path.join(ROOT, 'mobile'));
  const usages = [...collectDashboard(dashboardFiles), ...collectMobile(mobileFiles)];

  const grouped = new Map();
  for (const row of usages) {
    const key = `${row.method} ${row.path}`;
    if (!grouped.has(key)) grouped.set(key, { method: row.method, path: row.path, dashboard: [], mobile: [] });
    grouped.get(key)[row.app].push(row.file);
  }

  const endpoints = Array.from(grouped.values()).map((row) => ({
    method: row.method,
    path: row.path,
    dashboard: dedupeFiles(row.dashboard),
    mobile: dedupeFiles(row.mobile),
  })).sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`));

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'usageIndex.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    endpointCount: endpoints.length,
    endpoints,
  }, null, 2));
  console.log(`Wrote usageIndex.json with ${endpoints.length} endpoint usage entries`);
}

main();
