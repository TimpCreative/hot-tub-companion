import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTenantApiKeyBySlug } from '@/lib/db';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.hottubcompanion.com';

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
