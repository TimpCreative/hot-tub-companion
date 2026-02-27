import SuperAdminLayoutClient from './SuperAdminLayoutClient';

const SUPER_ADMIN_NAV = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Tenants', href: '/tenants' },
  { label: 'UHTD', href: '/uhtd' },
  { label: 'Messages', href: '/messages', comingPhase: 3 },
  { label: 'Banners', href: '/banners', comingPhase: 3 },
  { label: 'Analytics', href: '/analytics', comingPhase: 5 },
];

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SuperAdminLayoutClient navItems={SUPER_ADMIN_NAV} basePath="/super-admin">
      {children}
    </SuperAdminLayoutClient>
  );
}
