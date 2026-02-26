import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.hottubcompanion.com';

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
) {
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
  const url = new URL(`/api/v1/super-admin/${pathStr}${request.nextUrl.search}`, API_BASE);

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  headers.set('Authorization', authHeader);

  try {
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'API request failed';
    return NextResponse.json(
      { success: false, error: { code: 'NETWORK_ERROR', message: msg } },
      { status: 502 }
    );
  }
}
