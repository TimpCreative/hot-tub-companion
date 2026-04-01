import SuperAdminLayoutClient from './SuperAdminLayoutClient';

const SUPER_ADMIN_NAV = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Journal', href: '/journal' },
  { label: 'Roadmap', href: '/roadmap' },
  { label: 'Tenants', href: '/tenants' },
  { label: 'Platform Users', href: '/platform-users' },
  { label: 'UHTD', href: '/uhtd' },
  { label: 'Content Library', href: '/content' },
  { label: 'Messages', href: '/messages', comingPhase: 3 },
  { label: 'Banners', href: '/banners', comingPhase: 3 },
  { label: 'Announcements', href: '/announcements' },
  { label: 'Analytics', href: '/analytics', comingPhase: 5 },
];

const BOTTOM_NAV = [
  { label: 'Settings', href: '/settings' },
];

export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SuperAdminLayoutClient 
      navItems={SUPER_ADMIN_NAV} 
      bottomItems={BOTTOM_NAV}
      basePath="/super-admin"
    >
      {children}
    </SuperAdminLayoutClient>
  );
}
