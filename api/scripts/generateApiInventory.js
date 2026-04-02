/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ROUTES_DIR = path.join(ROOT, 'src', 'routes');
const OUT_DIR = path.join(ROOT, 'src', 'docs', 'generated');

const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function normalizePath(p) {
  if (!p) return '/';
  return p.startsWith('/') ? p.replace(/\/+/g, '/') : `/${p}`.replace(/\/+/g, '/');
}

function classify(pathname) {
  if (pathname === '/health') return { authType: 'public', domain: 'Public', group: 'health' };
  if (pathname.startsWith('/api/v1/auth')) return { authType: 'public', domain: 'Public', group: 'auth' };
  if (pathname.startsWith('/api/v1/webhooks')) return { authType: 'webhook', domain: 'Webhooks', group: 'webhooks' };
  if (pathname.startsWith('/api/v1/internal')) return { authType: 'internal_secret', domain: 'Internal', group: 'internal' };
  if (pathname.startsWith('/api/v1/super-admin')) return { authType: 'super_admin', domain: 'Super Admin', group: pathname.split('/')[4] || 'core' };
  if (pathname.startsWith('/api/v1/admin')) return { authType: 'retailer_admin', domain: 'Retailer Admin', group: pathname.split('/')[4] || 'admin' };
  if (pathname.startsWith('/api/v1/media')) return { authType: 'public', domain: 'Public', group: 'media' };
  if (pathname.startsWith('/api/v1/users') || pathname.startsWith('/api/v1/spa-profiles') || pathname.startsWith('/api/v1/water-care')) {
    return { authType: 'tenant_firebase', domain: 'Customer', group: pathname.split('/')[3] || 'customer' };
  }
  if (pathname.startsWith('/api/v1')) return { authType: 'tenant_key', domain: 'Customer', group: pathname.split('/')[3] || 'customer' };
  return { authType: 'public', domain: 'Public', group: 'misc' };
}

function familyFor(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length <= 4) return pathname;
  return `/${parts.slice(0, 4).join('/')}`;
}

function parseImports(content) {
  const imports = {};
  const directImport = /import\s+([a-zA-Z0-9_]+)\s+from\s+'\.\/([^']+)'/g;
  for (const m of content.matchAll(directImport)) imports[m[1]] = `${m[2]}.ts`;
  const namedImport = /import\s+\{\s*([^}]+)\s*\}\s+from\s+'\.\/([^']+)'/g;
  for (const m of content.matchAll(namedImport)) {
    m[1].split(',').map((s) => s.trim()).forEach((name) => {
      const [imported, alias] = name.split(/\s+as\s+/);
      imports[(alias || imported).trim()] = `${m[2]}.ts`;
    });
  }
  return imports;
}

function parseRouteMethods(content) {
  const routerNames = new Set(['router']);
  for (const m of content.matchAll(/const\s+([a-zA-Z0-9_]+)\s*=\s*Router\(/g)) routerNames.add(m[1]);
  const rows = [];
  for (const routerName of routerNames) {
    for (const method of METHODS) {
      const r = new RegExp(`${routerName}\\.${method}\\(\\s*['"\`]([^'"\`]+)['"\`]`, 'g');
      for (const m of content.matchAll(r)) rows.push({ method: method.toUpperCase(), path: m[1] });
    }
  }
  return rows;
}

function parseUses(content) {
  const rows = [];
  const withPath = /router\.use\(\s*['"`]([^'"`]+)['"`]\s*,\s*([^)]+)\)/g;
  for (const m of content.matchAll(withPath)) {
    const args = m[2]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const target = args[args.length - 1];
    if (target) rows.push({ mountPath: m[1], target });
  }
  const noPath = /router\.use\(\s*([a-zA-Z0-9_]+)\s*\)/g;
  for (const m of content.matchAll(noPath)) rows.push({ mountPath: '/', target: m[1] });
  return rows;
}

function resolveFromFile(fileName, basePath, includeUnresolved, seen) {
  const filePath = path.join(ROUTES_DIR, fileName);
  if (!fs.existsSync(filePath)) return [];
  const key = `${fileName}:${basePath}`;
  if (seen.has(key)) return [];
  seen.add(key);

  const content = read(filePath);
  const imports = parseImports(content);
  const endpoints = [];

  for (const row of parseRouteMethods(content)) {
    const fullPath = normalizePath(`${basePath}/${row.path}`);
    const meta = classify(fullPath);
    endpoints.push({
      method: row.method,
      path: fullPath,
      routeFile: `api/src/routes/${fileName}`,
      domain: meta.domain,
      group: meta.group,
      family: familyFor(fullPath),
      authType: meta.authType,
    });
  }

  for (const use of parseUses(content)) {
    const importedFile = imports[use.target];
    if (!importedFile) continue;
    const nestedBase = normalizePath(`${basePath}/${use.mountPath}`);
    endpoints.push(...resolveFromFile(importedFile, nestedBase, includeUnresolved, seen));
  }

  return endpoints;
}

function dedupe(endpoints) {
  const map = new Map();
  for (const e of endpoints) map.set(`${e.method} ${e.path} ${e.routeFile}`, e);
  return Array.from(map.values()).sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`));
}

function findUnresolvedRouteFiles() {
  const all = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts'));
  const index = read(path.join(ROUTES_DIR, 'index.ts'));
  const app = read(path.join(ROOT, 'src', 'app.ts'));
  const referenced = new Set();
  for (const m of index.matchAll(/from '\.\/([^']+)'/g)) referenced.add(`${m[1]}.ts`);
  for (const m of app.matchAll(/from '\.\/routes\/([^']+)'/g)) referenced.add(`${m[1]}.ts`);
  return all.filter((f) => f !== 'index.ts' && !referenced.has(f));
}

function main() {
  const seen = new Set();
  const endpoints = resolveFromFile('index.ts', '/', true, seen);
  const webhooks = resolveFromFile('webhooks.routes.ts', '/api/v1/webhooks', true, seen);
  const deduped = dedupe([...endpoints, ...webhooks]);
  const unresolved = findUnresolvedRouteFiles();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const output = {
    generatedAt: new Date().toISOString(),
    endpointCount: deduped.length,
    unresolvedRouteFiles: unresolved.map((f) => `api/src/routes/${f}`),
    endpoints: deduped,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'apiInventory.json'), JSON.stringify(output, null, 2));
  console.log(`Wrote apiInventory.json with ${deduped.length} endpoints`);
}

main();
