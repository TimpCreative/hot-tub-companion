import { cookies } from 'next/headers';
import { TenantProvider } from '@/contexts/TenantContext';
import { AdminPermissionsProvider } from '@/contexts/AdminPermissionsContext';
import AdminLayoutClient from './AdminLayoutClient';

const ADMIN_NAV = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Customers', href: '/customers', comingPhase: 2 },
  { label: 'Orders', href: '/orders', comingPhase: 2 },
  { label: 'Products', href: '/products', comingPhase: 2 },
  { label: 'Services', href: '/services', comingPhase: 4 },
  { label: 'Content', href: '/content', comingPhase: 3 },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Analytics', href: '/analytics', comingPhase: 5 },
  { label: 'Team', href: '/team', requiresCanManageUsers: true },
  { label: 'Settings', href: '/settings', comingPhase: 2 },
  { label: 'App setup', href: '/app-setup', comingPhase: 2 },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const tenantSlug = cookieStore.get('tenant_slug')?.value ?? null;

  return (
    <TenantProvider tenantSlug={tenantSlug}>
      <AdminPermissionsProvider>
        <AdminLayoutClient navItems={ADMIN_NAV} basePath="/admin">
          {children}
        </AdminLayoutClient>
      </AdminPermissionsProvider>
    </TenantProvider>
  );
}
