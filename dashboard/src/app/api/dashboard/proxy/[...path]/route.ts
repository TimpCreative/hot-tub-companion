import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTenantApiKeyBySlugSafe } from '@/lib/db';

function getApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || 'https://api.hottubcompanion.com').trim().replace(/\/+$/, '');
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

const API_BASE = getApiBase();

function safeDetail(msg: string | undefined): string | undefined {
  if (!msg?.trim()) return undefined;
  return msg.trim().slice(0, 400);
}

/** Allow Railway cold starts + slow queries; Vercel Hobby default is 10s which often surfaces as opaque 502s. */
export const maxDuration = 60;

const UPSTREAM_FETCH_TIMEOUT_MS = 55_000;

/**
 * Proxies requests to the hot-tub-companion API with the tenant API key
 * resolved from the database by slug. The key never leaves the server.
 * Use this for retailer admin API calls (customers, orders, etc.).
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
) {
  const cookieStore = await cookies();
  const slug = cookieStore.get('tenant_slug')?.value;
  if (!slug) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
  }

  const { apiKey, dbError } = await getTenantApiKeyBySlugSafe(slug);
  if (dbError) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'TENANT_DB_ERROR',
          message:
            'Could not resolve tenant API key (database error). Set DATABASE_URL on Vercel and allow DB access from Vercel.',
          details: safeDetail(dbError),
        },
      },
      { status: 503 }
    );
  }
  if (!apiKey) {
    return NextResponse.json({ error: 'Tenant not found or inactive' }, { status: 404 });
  }

  const { path } = await params;
  if (path.some((p) => p === '..' || p === '.')) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }
  const pathStr = path.join('/');
  let url: URL;
  try {
    url = new URL(`/api/v1/${pathStr}${request.nextUrl.search}`, API_BASE);
  } catch {
    return NextResponse.json(
      { error: 'Invalid API URL. Set NEXT_PUBLIC_API_URL to a valid URL (e.g. https://api.hottubcompanion.com)' },
      { status: 500 }
    );
  }

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('x-tenant-key', apiKey);

  try {
    const body = ['GET', 'HEAD'].includes(method) ? undefined : request.body ?? undefined;
    const fetchOpts: RequestInit = {
      method,
      headers,
      signal: AbortSignal.timeout(UPSTREAM_FETCH_TIMEOUT_MS),
      ...(body && { body, duplex: 'half' }),
    };
    const res = await fetch(url.toString(), fetchOpts);

    const data = await res.text();
    // Ensure 5xx responses have parseable JSON so client doesn't get "Unexpected end of JSON input"
    if (res.status >= 500 && (!data || !data.trim())) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Upstream API returned empty error response. Check API logs.',
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
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout =
      message.includes('TimeoutError') ||
      message.includes('timed out') ||
      (err instanceof Error && err.name === 'TimeoutError');
    console.error('[proxy] Fetch to API failed:', message);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
          message: isTimeout
            ? `API did not respond within ${UPSTREAM_FETCH_TIMEOUT_MS / 1000}s. Check Railway deployment (cold start / sleep) and NEXT_PUBLIC_API_URL.`
            : `Proxy could not reach API: ${message}`,
        },
      },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
