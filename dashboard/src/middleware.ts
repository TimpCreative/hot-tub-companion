import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const url = request.nextUrl;

  // Local dev: derive tenant from query param or subdomain
  if (hostname.includes('localhost')) {
    const tenantFromQuery = url.searchParams.get('tenant');
    const subdomain = hostname.split('.')[0];
    const tenant = tenantFromQuery || (subdomain !== 'localhost' ? subdomain : null);

    // Super admin: ?tenant=admin or admin.localhost
    if (tenantFromQuery === 'admin' || subdomain === 'admin') {
      const response = NextResponse.rewrite(
        new URL(`/super-admin${url.pathname === '/' ? '/dashboard' : url.pathname}${url.search}`, request.url)
      );
      response.cookies.delete('tenant_slug');
      return response;
    }

    // Retailer admin: ?tenant=takeabreak or takeabreak.localhost
    if (tenant && tenant !== 'admin') {
      const response = NextResponse.rewrite(
        new URL(`/admin${url.pathname === '/' ? '/dashboard' : url.pathname}${url.search}`, request.url)
      );
      response.headers.set('x-tenant-slug', tenant);
      response.cookies.set('tenant_slug', tenant);
      return response;
    }

    return NextResponse.next();
  }

  const subdomain = hostname.split('.')[0];

  // Super admin: admin.hottubcompanion.com
  if (subdomain === 'admin') {
    const response = NextResponse.rewrite(
      new URL(`/super-admin${url.pathname === '/' ? '/dashboard' : url.pathname}${url.search}`, request.url)
    );
    response.cookies.delete('tenant_slug');
    return response;
  }

  // Retailer admin: takeabreak.hottubcompanion.com (any subdomain except www, hottubcompanion)
  if (
    subdomain !== 'www' &&
    subdomain !== 'hottubcompanion' &&
    hostname.includes('hottubcompanion.com')
  ) {
    const response = NextResponse.rewrite(
      new URL(`/admin${url.pathname === '/' ? '/dashboard' : url.pathname}${url.search}`, request.url)
    );
    response.headers.set('x-tenant-slug', subdomain);
    response.cookies.set('tenant_slug', subdomain);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
