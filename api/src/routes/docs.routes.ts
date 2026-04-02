import { Router, type Request, type Response, type NextFunction } from 'express';
import { readFileSync } from 'fs';
import path from 'path';
import { superAdminAuth } from '../middleware/superAdminAuth';

const router = Router();

type AppRequest = Request & { superAdminEmail?: string };

function safeReadJson(relativePath: string): Record<string, unknown> {
  const full = path.join(__dirname, '..', 'docs', 'generated', relativePath);
  try {
    return JSON.parse(readFileSync(full, 'utf8')) as Record<string, unknown>;
  } catch {
    return { generatedAt: null, data: [] };
  }
}

function docsPageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>HTC API Docs</title>
  <style>
    :root { --bg:#0b1020; --panel:#111831; --panel2:#162142; --text:#e8eeff; --muted:#9aacd3; --ok:#5ad197; --warn:#ffd166; --accent:#64b5ff; --border:#253258; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; background:var(--bg); color:var(--text); }
    .wrap { max-width: 1400px; margin: 0 auto; padding: 20px; display:grid; grid-template-columns: 320px 1fr; gap:16px; }
    .panel { background:var(--panel); border:1px solid var(--border); border-radius:12px; padding:14px; }
    .hidden { display:none !important; }
    input, select { width:100%; background:var(--panel2); border:1px solid var(--border); color:var(--text); border-radius:8px; padding:8px; margin-top:6px; }
    button { border:0; border-radius:8px; padding:8px 12px; cursor:pointer; background:var(--accent); color:#081225; font-weight:700; }
    .pill { display:inline-block; font-size:12px; padding:2px 8px; border:1px solid var(--border); border-radius:999px; color:var(--muted); margin-right:6px; margin-top:6px; }
    .method { font-weight:700; font-size:12px; letter-spacing:0.4px; padding:2px 7px; border-radius:6px; margin-right:8px; background:#1a2b54; color:#b8d6ff; }
    .resource { border:1px solid var(--border); border-radius:10px; margin-bottom:10px; overflow:hidden; }
    .resource > summary { list-style:none; cursor:pointer; padding:11px 12px; background:var(--panel2); }
    .resource > summary::-webkit-details-marker, .endpoint > summary::-webkit-details-marker { display:none; }
    .endpoint { border-top:1px solid var(--border); }
    .endpoint > summary { list-style:none; cursor:pointer; padding:10px 12px; }
    .endpoint > div { padding:0 12px 12px 12px; color:var(--muted); font-size:14px; }
    .small { color:var(--muted); font-size:12px; }
    .usage a { color:var(--accent); text-decoration:none; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .muted { color:var(--muted); }
  </style>
</head>
<body>
  <div class="wrap">
    <aside class="panel">
      <h2 style="margin:0 0 6px 0;">Super Admin API Docs</h2>
      <div class="small">Authenticated at API domain via Firebase Bearer token.</div>
      <div class="small" style="margin-top:8px;">
        Onboarding: (1) authenticate as Super Admin, (2) search/filter endpoints, (3) use nested domain -> group -> resource -> method accordions, (4) verify call-sites from Usage.
      </div>
      <div id="authBox" style="margin-top:14px;">
        <label class="small">Bearer Token</label>
        <input id="tokenInput" type="password" placeholder="Paste Firebase ID token" />
        <button id="saveToken" style="margin-top:8px; width:100%;">Save & Load Docs</button>
        <button id="clearToken" style="margin-top:8px; width:100%; background:#304067; color:#e8eeff;">Clear Token</button>
      </div>
      <hr style="border-color:var(--border); margin:14px 0;" />
      <label class="small">Search endpoint/path</label>
      <input id="search" placeholder="ex: /api/v1/super-admin/tenants" />
      <label class="small" style="margin-top:10px; display:block;">Auth type</label>
      <select id="authFilter">
        <option value="">All auth types</option>
        <option value="public">public</option>
        <option value="tenant_key">tenant_key</option>
        <option value="tenant_firebase">tenant_firebase</option>
        <option value="retailer_admin">retailer_admin</option>
        <option value="super_admin">super_admin</option>
        <option value="internal_secret">internal_secret</option>
        <option value="webhook">webhook</option>
      </select>
      <label class="small" style="margin-top:10px; display:block;">Usage</label>
      <select id="usageFilter">
        <option value="">Used anywhere</option>
        <option value="dashboard">Dashboard only</option>
        <option value="mobile">Mobile only</option>
        <option value="both">Dashboard + Mobile</option>
        <option value="none">No usage mapped</option>
      </select>
      <div id="summary" class="small" style="margin-top:12px;"></div>
      <div id="changelog" class="small" style="margin-top:6px;"></div>
    </aside>
    <main id="content" class="panel">
      <div class="muted">Provide a valid token to load docs data.</div>
    </main>
  </div>
  <script>
    const tokenInput = document.getElementById('tokenInput');
    const saveToken = document.getElementById('saveToken');
    const clearToken = document.getElementById('clearToken');
    const search = document.getElementById('search');
    const authFilter = document.getElementById('authFilter');
    const usageFilter = document.getElementById('usageFilter');
    const content = document.getElementById('content');
    const summary = document.getElementById('summary');
    const changelog = document.getElementById('changelog');
    const KEY = 'htc.superAdminDocs.token';
    tokenInput.value = localStorage.getItem(KEY) || '';

    function usageBucket(item) {
      const d = (item.usage && item.usage.dashboard) ? item.usage.dashboard.length : 0;
      const m = (item.usage && item.usage.mobile) ? item.usage.mobile.length : 0;
      if (d && m) return 'both';
      if (d) return 'dashboard';
      if (m) return 'mobile';
      return 'none';
    }

    function esc(s) {
      return String(s || '').replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    }

    async function loadData() {
      const token = (localStorage.getItem(KEY) || '').trim();
      if (!token) {
        content.innerHTML = '<div class="muted">Provide a valid token to load docs data.</div>';
        summary.textContent = 'Not authenticated';
        return;
      }
      const res = await fetch('./data', { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) {
        content.innerHTML = '<div class="muted">Auth failed. Check token and try again.</div>';
        summary.textContent = 'Auth failed';
        return;
      }
      const payload = await res.json();
      const endpoints = Array.isArray(payload.endpoints) ? payload.endpoints : [];
      render(endpoints, payload.generatedAt || null);
    }

    function render(endpoints, generatedAt) {
      const q = search.value.trim().toLowerCase();
      const auth = authFilter.value;
      const usage = usageFilter.value;
      const filtered = endpoints.filter((e) => {
        const text = (e.path + ' ' + e.method + ' ' + (e.routeFile || '')).toLowerCase();
        if (q && !text.includes(q)) return false;
        if (auth && e.authType !== auth) return false;
        if (usage && usageBucket(e) !== usage) return false;
        return true;
      });
      summary.textContent = filtered.length + ' endpoints shown' + (generatedAt ? ' | generated ' + new Date(generatedAt).toLocaleString() : '');
      changelog.textContent = generatedAt ? ('Latest docs refresh: ' + new Date(generatedAt).toLocaleString()) : 'Docs have not been generated yet.';

      const domainMap = {};
      for (const e of filtered) {
        const domain = e.domain || 'Uncategorized';
        const group = e.group || 'misc';
        const family = e.family || e.path;
        domainMap[domain] = domainMap[domain] || {};
        domainMap[domain][group] = domainMap[domain][group] || {};
        domainMap[domain][group][family] = domainMap[domain][group][family] || [];
        domainMap[domain][group][family].push(e);
      }

      let html = '';
      Object.keys(domainMap).sort().forEach((domain) => {
        html += '<details class="resource" open><summary><strong>' + esc(domain) + '</strong></summary><div style="padding:8px;">';
        const groups = domainMap[domain];
        Object.keys(groups).sort().forEach((group) => {
          html += '<details class="resource" open><summary>' + esc(group) + '</summary><div style="padding:8px;">';
          const families = groups[group];
          Object.keys(families).sort().forEach((family) => {
            html += '<details class="resource"><summary>' + esc(family) + '</summary>';
            families[family].forEach((e) => {
              const d = (e.usage && e.usage.dashboard) ? e.usage.dashboard : [];
              const m = (e.usage && e.usage.mobile) ? e.usage.mobile : [];
              html += '<details class="endpoint"><summary><span class="method">' + esc(e.method) + '</span>' + esc(e.path) + '<span class="pill">' + esc(e.authType) + '</span></summary><div>';
              html += '<div class="small">Source: ' + esc(e.routeFile || 'n/a') + '</div>';
              html += '<div style="margin-top:8px;"><strong>Usage</strong></div><div class="usage small">';
              if (!d.length && !m.length) html += '<div class="muted">No mapped usage yet.</div>';
              d.forEach((file) => html += '<a href="#">dashboard: ' + esc(file) + '</a>');
              m.forEach((file) => html += '<a href="#">mobile: ' + esc(file) + '</a>');
              html += '</div></div></details>';
            });
            html += '</details>';
          });
          html += '</div></details>';
        });
        html += '</div></details>';
      });
      content.innerHTML = html || '<div class="muted">No endpoints match current filters.</div>';
    }

    saveToken.addEventListener('click', () => { localStorage.setItem(KEY, tokenInput.value.trim()); loadData(); });
    clearToken.addEventListener('click', () => { localStorage.removeItem(KEY); tokenInput.value=''; loadData(); });
    search.addEventListener('input', loadData);
    authFilter.addEventListener('change', loadData);
    usageFilter.addEventListener('change', loadData);
    loadData();
  </script>
</body>
</html>`;
}

router.get('/', superAdminAuth, (_req: Request, res: Response) => {
  res.type('html').send(docsPageHtml());
});

router.get('/data', superAdminAuth, (req: Request, res: Response) => {
  const inventory = safeReadJson('apiInventory.json');
  const usage = safeReadJson('usageIndex.json');
  const usageMap = new Map<string, { dashboard: string[]; mobile: string[] }>();
  const usageByPath = new Map<string, { dashboard: string[]; mobile: string[] }>();
  const usageItems = Array.isArray(usage.endpoints) ? usage.endpoints : [];
  const mergeUnique = (a: string[], b: string[]) => Array.from(new Set([...(a || []), ...(b || [])]));
  for (const item of usageItems) {
    if (!item || typeof item !== 'object') continue;
    const method = String((item as Record<string, unknown>).method || '');
    const path = String((item as Record<string, unknown>).path || '');
    const key = `${method} ${path}`;
    const row = {
      dashboard: Array.isArray((item as Record<string, unknown>).dashboard) ? (item as Record<string, unknown>).dashboard as string[] : [],
      mobile: Array.isArray((item as Record<string, unknown>).mobile) ? (item as Record<string, unknown>).mobile as string[] : [],
    };
    usageMap.set(key, {
      dashboard: row.dashboard,
      mobile: row.mobile,
    });
    const bucket = usageByPath.get(path) || { dashboard: [], mobile: [] };
    usageByPath.set(path, {
      dashboard: mergeUnique(bucket.dashboard, row.dashboard),
      mobile: mergeUnique(bucket.mobile, row.mobile),
    });
  }
  const endpoints = Array.isArray(inventory.endpoints) ? inventory.endpoints : [];
  const merged = endpoints.map((entry) => {
    const row = entry as Record<string, unknown>;
    const method = String(row.method || '');
    const path = String(row.path || '');
    const key = `${method} ${path}`;
    const wildcardKey = `* ${path}`;
    const fallbackByPath = usageByPath.get(path);
    const usageRow = usageMap.get(key) || usageMap.get(wildcardKey) || fallbackByPath;
    return {
      ...row,
      usage: usageRow || { dashboard: [], mobile: [] },
    };
  });
  res.json({
    generatedAt: inventory.generatedAt || null,
    email: (req as AppRequest).superAdminEmail || null,
    endpoints: merged,
  });
});

router.get('/openapi.json', superAdminAuth, (_req: Request, res: Response) => {
  res.json(safeReadJson('openapi.json'));
});

export default router;
