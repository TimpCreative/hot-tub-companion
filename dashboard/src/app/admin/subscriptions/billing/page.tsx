import { redirect } from 'next/navigation';

export default function LegacySubscriptionsBillingPage() {
  redirect('/admin/settings/subscriptions');
}
