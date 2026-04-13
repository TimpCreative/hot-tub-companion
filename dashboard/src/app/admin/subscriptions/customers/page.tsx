import { redirect } from 'next/navigation';

export default function LegacySubscriptionsCustomersPage() {
  redirect('/admin/active-subscriptions');
}
