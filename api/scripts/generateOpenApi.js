/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GENERATED_DIR = path.join(ROOT, 'src', 'docs', 'generated');
const inventoryPath = path.join(GENERATED_DIR, 'apiInventory.json');

function ensureInventory() {
  if (!fs.existsSync(inventoryPath)) {
    throw new Error('Missing apiInventory.json. Run generateApiInventory.js first.');
  }
  return JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
}

function main() {
  const inventory = ensureInventory();
  const paths = {};

  for (const endpoint of inventory.endpoints || []) {
    const method = String(endpoint.method || 'GET').toLowerCase();
    const routePath = String(endpoint.path || '/');
    const tag = endpoint.group || 'misc';
    const authType = endpoint.authType || 'public';
    if (!paths[routePath]) paths[routePath] = {};
    paths[routePath][method] = {
      tags: [tag],
      operationId: `${method}_${routePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
      summary: `${endpoint.method} ${routePath}`,
      description: `Auto-generated operation inventory entry from ${endpoint.routeFile}.`,
      security: authType === 'public' ? [] : [{ bearerAuth: [] }],
      responses: {
        200: { description: 'Successful response' },
        400: { description: 'Bad request' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
        500: { description: 'Server error' },
      },
      'x-htc-auth-type': authType,
      'x-htc-source': endpoint.routeFile,
      'x-htc-openapi-phase': ['super-admin', 'admin', 'auth', 'users', 'spa-profiles', 'water-care'].includes(tag)
        ? 'phase1-priority'
        : 'inventory-seeded',
    };
  }

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Hot Tub Companion API',
      version: '1.0.0',
      description: 'Super Admin protected API docs. Generated from route inventory with incremental OpenAPI enrichment.',
    },
    servers: [{ url: 'https://api.hottubcompanion.com' }],
    tags: [
      { name: 'auth' },
      { name: 'super-admin' },
      { name: 'admin' },
      { name: 'users' },
      { name: 'spa-profiles' },
      { name: 'water-care' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
    paths,
  };

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.writeFileSync(path.join(GENERATED_DIR, 'openapi.json'), JSON.stringify(spec, null, 2));
  console.log(`Wrote openapi.json with ${Object.keys(paths).length} paths`);
}

main();
