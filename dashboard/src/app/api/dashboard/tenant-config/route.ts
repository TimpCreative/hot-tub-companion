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

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const slug = cookieStore.get('tenant_slug')?.value ?? request.nextUrl.searchParams.get('slug');

    if (!slug) {
      return NextResponse.json({ error: 'Missing tenant slug' }, { status: 400 });
    }

    const { apiKey, dbError } = await getTenantApiKeyBySlugSafe(slug);
    if (dbError) {
      return NextResponse.json(
        {
          error:
            'Could not look up tenant (database error). On Vercel, set DATABASE_URL to the same Postgres as the API and ensure the DB allows connections from Vercel.',
          details: safeDetail(dbError),
        },
        { status: 503 }
      );
    }
    if (!apiKey) {
      return NextResponse.json({ error: 'Tenant not found or inactive' }, { status: 404 });
    }

    let res: Response;
    try {
      res = await fetch(`${API_BASE}/api/v1/tenant/config`, {
        headers: { 'x-tenant-key': apiKey },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        {
          error: `Could not reach API at ${API_BASE}. Check NEXT_PUBLIC_API_URL on this Vercel project.`,
          details: safeDetail(msg),
        },
        { status: 502 }
      );
    }

    const text = await res.text();
    if (!res.ok) {
      let errMsg = text || 'Failed to fetch tenant config';
      if (/application not found/i.test(errMsg) || res.status === 404) {
        errMsg += ' — Check NEXT_PUBLIC_API_URL in Vercel points to your Railway API.';
      }
      return NextResponse.json({ error: errMsg }, { status: res.status });
    }

    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json(
        {
          error: 'Upstream tenant config was not valid JSON. Check API /api/v1/tenant/config response.',
          details: text.slice(0, 200),
        },
        { status: 502 }
      );
    }
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[tenant-config] GET failed:', msg);
    return NextResponse.json({ error: 'Internal error loading tenant config', details: msg }, { status: 500 });
  }
}
