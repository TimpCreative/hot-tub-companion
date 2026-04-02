/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..');
const API_GENERATED = path.join(REPO_ROOT, 'api', 'src', 'docs', 'generated');
const REFERENCE_INDEX = path.join(ROOT, 'content', 'reference', 'index.json');
const METADATA_FILE = path.join(ROOT, 'content', 'reference', 'operation-metadata.json');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function opId(method, endpointPath) {
  return `${method.toLowerCase()}_${endpointPath.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function main() {
  const inventory = readJson(path.join(API_GENERATED, 'apiInventory.json'), { endpoints: [] });
  const openapi = readJson(path.join(API_GENERATED, 'openapi.json'), { paths: {} });
  const referenceIndex = readJson(REFERENCE_INDEX, []);
  const metadata = readJson(METADATA_FILE, {});

  const invSet = new Set(inventory.endpoints.map((e) => `${e.method} ${e.path}`));
  const refSet = new Set(referenceIndex.map((e) => `${e.method} ${e.path}`));
  const openSet = new Set();
  for (const [p, methods] of Object.entries(openapi.paths || {})) {
    for (const method of Object.keys(methods || {})) openSet.add(`${method.toUpperCase()} ${p}`);
  }

  const missingInReference = [...invSet].filter((sig) => !refSet.has(sig));
  const missingInOpen = [...invSet].filter((sig) => !openSet.has(sig));
  const missingMeta = [];
  for (const endpoint of inventory.endpoints) {
    const key = opId(endpoint.method, endpoint.path);
    const row = metadata[key];
    if (!row || !row.title || !row.summary || !row.rationale || !row.exampleRequest || !row.exampleResponse) {
      missingMeta.push(`${endpoint.method} ${endpoint.path}`);
    }
  }

  if (missingInReference.length || missingInOpen.length || missingMeta.length) {
    console.error('Reference coverage failed.');
    if (missingInReference.length) console.error(`- Missing reference rows: ${missingInReference.length}`);
    if (missingInOpen.length) console.error(`- Missing OpenAPI operations: ${missingInOpen.length}`);
    if (missingMeta.length) console.error(`- Missing required metadata: ${missingMeta.length}`);
    process.exit(1);
  }

  console.log(`Reference coverage OK. inventory=${invSet.size} reference=${refSet.size} openapi=${openSet.size}`);
}

main();
