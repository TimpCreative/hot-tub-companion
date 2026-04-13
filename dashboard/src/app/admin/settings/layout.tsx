import { SettingsTabsNav } from './SettingsTabsNav';

export default function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Settings</h1>
      <p className="text-sm text-gray-600 mb-4">
        General store details, Shopify / POS, and subscription billing (Stripe Connect).
      </p>
      <SettingsTabsNav />
      {children}
    </div>
  );
}
