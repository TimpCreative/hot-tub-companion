/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(ROOT, '..');
const API_GENERATED = path.join(REPO_ROOT, 'api', 'src', 'docs', 'generated');
const CONTENT_ROOT = path.join(ROOT, 'content', 'reference');
const OPS_DIR = path.join(CONTENT_ROOT, 'operations');
const METADATA_FILE = path.join(CONTENT_ROOT, 'operation-metadata.json');
const INDEX_FILE = path.join(CONTENT_ROOT, 'index.json');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function slugify(method, endpointPath) {
  return `${method.toLowerCase()}_${endpointPath.replace(/^\/+/, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase()}`;
}

function operationId(method, endpointPath) {
  return `${method.toLowerCase()}_${endpointPath.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function ensureMetadata(key, endpoint, existing) {
  if (existing[key]) return existing[key];
  existing[key] = {
    title: `${endpoint.method} ${endpoint.path}`,
    summary: `Reference documentation for ${endpoint.method} ${endpoint.path}.`,
    rationale: 'Describe why this endpoint exists and what workflow it supports.',
    gotchas: [
      'Call out required headers, role constraints, and common validation pitfalls.',
      'Document any side effects and idempotency expectations.',
    ],
    exampleRequest: `curl -X ${endpoint.method} "https://api.hottubcompanion.com${endpoint.path}"`,
    exampleResponse: '{ "success": true }',
    lifecycle: 'stable',
  };
  return existing[key];
}

function markdownFor(endpoint, meta, usage) {
  const dashboard = usage.dashboard.length ? usage.dashboard.map((x) => `- \`${x}\``).join('\n') : '- None mapped';
  const mobile = usage.mobile.length ? usage.mobile.map((x) => `- \`${x}\``).join('\n') : '- None mapped';
  return `## Summary

${meta.summary}

## Purpose

${meta.rationale}

## Operation

- **Method:** \`${endpoint.method}\`
- **Path:** \`${endpoint.path}\`
- **Domain:** \`${endpoint.domain}\`
- **Group:** \`${endpoint.group}\`
- **Auth Type:** \`${endpoint.authType}\`
- **Source:** \`${endpoint.routeFile}\`
- **Lifecycle:** \`${meta.lifecycle}\`

## Request Example

\`\`\`bash
${meta.exampleRequest}
\`\`\`

## Response Example

\`\`\`json
${meta.exampleResponse}
\`\`\`

## Common Gotchas

${meta.gotchas.map((g) => `- ${g}`).join('\n')}

## Used By Dashboard

${dashboard}

## Used By Mobile

${mobile}
`;
}

function main() {
  const inventory = readJson(path.join(API_GENERATED, 'apiInventory.json'), { endpoints: [] });
  const usage = readJson(path.join(API_GENERATED, 'usageIndex.json'), { endpoints: [] });
  const existingMetadata = readJson(METADATA_FILE, {});

  const usageMap = new Map();
  for (const item of usage.endpoints || []) {
    usageMap.set(`${item.method} ${item.path}`, { dashboard: item.dashboard || [], mobile: item.mobile || [] });
    const wildcard = `* ${item.path}`;
    if (!usageMap.has(wildcard)) usageMap.set(wildcard, { dashboard: item.dashboard || [], mobile: item.mobile || [] });
  }

  const index = [];
  fs.mkdirSync(OPS_DIR, { recursive: true });
  for (const endpoint of inventory.endpoints || []) {
    const opId = operationId(endpoint.method, endpoint.path);
    const slug = slugify(endpoint.method, endpoint.path);
    const meta = ensureMetadata(opId, endpoint, existingMetadata);
    const usageRow = usageMap.get(`${endpoint.method} ${endpoint.path}`) || usageMap.get(`* ${endpoint.path}`) || { dashboard: [], mobile: [] };

    const mdx = markdownFor(endpoint, meta, usageRow);
    fs.writeFileSync(path.join(OPS_DIR, `${slug}.mdx`), mdx);

    index.push({
      operationId: opId,
      slug,
      method: endpoint.method,
      path: endpoint.path,
      domain: endpoint.domain,
      group: endpoint.group,
      authType: endpoint.authType,
      source: endpoint.routeFile,
      summary: meta.title,
      rationale: meta.rationale,
      gotchas: meta.gotchas,
      dashboardUsage: usageRow.dashboard,
      mobileUsage: usageRow.mobile,
    });
  }

  writeJson(METADATA_FILE, existingMetadata);
  writeJson(INDEX_FILE, index.sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`)));
  console.log(`Generated ${index.length} reference operation files`);
}

main();
