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

async function doProxy(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: string
): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' } },
      { status: 401 }
    );
  }

  const { path } = await params;
  if (path.some((p) => p === '..' || p === '.')) {
    return NextResponse.json(
      { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid path' } },
      { status: 400 }
    );
  }
  const pathStr = path.join('/');
  let url: URL;
  try {
    url = new URL(`/api/v1/super-admin/${pathStr}${request.nextUrl.search}`, API_BASE);
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'CONFIG_ERROR', message: 'Invalid API URL. Set NEXT_PUBLIC_API_URL to a valid URL (e.g. https://api.hottubcompanion.com)' } },
      { status: 500 }
    );
  }

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', authHeader);

  try {
    const res = await fetch(url.toString(), {
      method,
      headers,
      body: ['GET', 'HEAD'].includes(method) ? undefined : await request.text(),
    });

    const data = await res.text();

    // For 4xx/5xx, ensure we return JSON with a helpful message for debugging
    if (res.status >= 400) {
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
