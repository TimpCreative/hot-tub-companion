import { NextRequest, NextResponse } from 'next/server';

function getApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || 'https://api.hottubcompanion.com').trim().replace(/\/+$/, '');
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

const API_BASE = getApiBase();

/**
 * Proxies super-admin requests to the API from the server.
 * Avoids CORS (same-origin from browser) and forwards the Firebase Bearer token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, params, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, params, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, params, 'PUT');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, params, 'PATCH');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, params, 'DELETE');
}

async function proxy(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string
): Promise<NextResponse> {
  try {
    return await doProxy(request, params, method);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Proxy error';
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message: msg } },
      { status: 500 }
    );
  }
}

const PUBLIC_PATHS = [
  'auth/check-email',
  'auth/register',
];

const DEBUG_LOG = (data: Record<string, unknown>) => {
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/a47da7ba-8944-40d5-a7b1-3ca8dd181a2c', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '97b103' },
    body: JSON.stringify({ sessionId: '97b103', ...data, timestamp: Date.now() }),
  }).catch(() => {});
  // #endregion
};

async function doProxy(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string
): Promise<NextResponse> {
  const { path } = await params;
  const pathStr = path.join('/');

  const isPublicPath = PUBLIC_PATHS.some((p) => pathStr === p || pathStr.startsWith(p + '/'));

  const authHeader = request.headers.get('authorization');
  const hasAuth = !!authHeader?.startsWith('Bearer ');
  DEBUG_LOG({
    hypothesisId: 'H1',
    location: 'proxy:entry',
    message: 'Proxy received request',
    data: { pathStr, hasAuth, authHeaderLen: authHeader?.length ?? 0 },
  });
  if (!isPublicPath && !hasAuth) {
    DEBUG_LOG({ hypothesisId: 'H1', location: 'proxy:401', message: 'Proxy returning 401 - no auth header', data: {} });
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } },
      { status: 401 }
    );
  }
  if (path.some((p) => p === '..' || p === '.')) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid path' } },
      { status: 400 }
    );
  }
  
  let url: URL;
  try {
    url = new URL(`/api/v1/super-admin/${pathStr}${request.nextUrl.search}`, API_BASE);
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'CONFIG_ERROR', message: 'Invalid API URL. Set NEXT_PUBLIC_API_URL to a valid URL (e.g. https://api.hottubcompanion.com)' } },
      { status: 500 }
    );
  }

  const headers = new Headers(request.headers);
  headers.delete('host');
  if (authHeader) {
    headers.set('Authorization', authHeader);
    headers.set('X-Authorization', authHeader);
  }

  try {
    const body = ['GET', 'HEAD'].includes(method) ? undefined : request.body ?? undefined;
    const fetchOpts: RequestInit = {
      method,
      headers,
      ...(body && { body, duplex: 'half' }),
    };
    const res = await fetch(url.toString(), fetchOpts);

    const data = await res.text();

    // For 4xx/5xx, ensure we return JSON with a helpful message for debugging
    if (res.status >= 400) {
      DEBUG_LOG({
        hypothesisId: 'H2',
        location: 'proxy:api4xx',
        message: 'API returned error',
        data: { status: res.status, bodyPreview: data.slice(0, 200) },
      });
      let parsed: { error?: { message?: string }; message?: string } = {};
      try {
        parsed = JSON.parse(data) as { error?: { message?: string }; message?: string };
      } catch {
        parsed = { error: { message: data.slice(0, 300) || `API returned ${res.status}` } };
      }
      let msg = parsed.error?.message ?? parsed.message ?? data.slice(0, 300) ?? `API returned ${res.status}`;
      if (/application not found/i.test(msg) || res.status === 404) {
        msg += '. Check NEXT_PUBLIC_API_URL in Vercel — it must point to your Railway API (e.g. https://your-app.railway.app).';
      }
      return NextResponse.json(
        {
          success: false,
          error: {
            code: res.status >= 500 ? 'API_ERROR' : 'API_ERROR',
            message: msg,
            status: res.status,
          },
        },
        { status: res.status }
      );
    }

    return new NextResponse(data, {
      status: res.status,
      headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'API request failed';
    return NextResponse.json(
      { success: false, error: { code: 'NETWORK_ERROR', message: msg } },
      { status: 502 }
    );
  }
}
