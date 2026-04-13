import { redirect } from 'next/navigation';

export default function LegacySettingsBillingPage() {
  redirect('/admin/settings/subscriptions');
}
