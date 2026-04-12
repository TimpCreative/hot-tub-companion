import { redirect } from 'next/navigation';

export default function AdminSubscriptionsIndexPage() {
  redirect('/admin/subscriptions/billing');
}
