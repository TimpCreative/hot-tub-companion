import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTenantApiKeyBySlug } from '@/lib/db';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.hottubcompanion.com';

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

  const apiKey = await getTenantApiKeyBySlug(slug);
  if (!apiKey) {
    return NextResponse.json({ error: 'Tenant not found or inactive' }, { status: 404 });
  }

  const { path } = await params;
  const pathStr = path.join('/');
  const url = new URL(`/api/v1/${pathStr}${request.nextUrl.search}`, API_BASE);

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('x-tenant-key', apiKey);

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: ['GET', 'HEAD'].includes(method) ? undefined : request.body,
  });

  const data = await res.text();
  return new NextResponse(data, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') || 'application/json' },
  });
}
