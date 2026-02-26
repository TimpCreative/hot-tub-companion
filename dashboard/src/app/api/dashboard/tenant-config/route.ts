import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTenantApiKeyBySlug } from '@/lib/db';

function getApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || 'https://api.hottubcompanion.com').trim().replace(/\/+$/, '');
  return raw.startsWith('http') ? raw : `https://${raw}`;
}

const API_BASE = getApiBase();

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const slug = cookieStore.get('tenant_slug')?.value ?? request.nextUrl.searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'Missing tenant slug' }, { status: 400 });
  }

  const apiKey = await getTenantApiKeyBySlug(slug);
  if (!apiKey) {
    return NextResponse.json({ error: 'Tenant not found or inactive' }, { status: 404 });
  }

  const res = await fetch(`${API_BASE}/api/v1/tenant/config`, {
    headers: { 'x-tenant-key': apiKey },
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: text || 'Failed to fetch tenant config' }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
