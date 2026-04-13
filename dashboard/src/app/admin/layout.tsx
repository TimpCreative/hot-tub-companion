import { cookies } from 'next/headers';
import { TenantProvider } from '@/contexts/TenantContext';
import { AdminPermissionsProvider } from '@/contexts/AdminPermissionsContext';
import AdminLayoutClient from './AdminLayoutClient';

const ADMIN_NAV = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Customers', href: '/customers', comingPhase: 2 },
  { label: 'Orders', href: '/orders', comingPhase: 2 },
  {
    label: 'Products',
    children: [
      { label: 'All products', href: '/products' },
      { label: 'Categories', href: '/products/categories' },
      { label: 'Bundles', href: '/products/bundles' },
    ],
  },
  { label: 'Services', href: '/services', comingPhase: 4 },
  { label: 'Content', href: '/content' },
  { label: 'Notifications', href: '/notifications' },
  { label: 'Active subscriptions', href: '/active-subscriptions' },
  { label: 'Analytics', href: '/analytics', comingPhase: 5 },
  { label: 'Team', href: '/team', requiresCanManageUsers: true },
  {
    label: 'Settings',
    children: [
      { label: 'General', href: '/settings' },
      { label: 'Billing & Connect', href: '/settings/billing' },
    ],
  },
  { label: 'App setup', href: '/app-setup' },
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
