/** Short customer-facing copy for Stripe subscription `status` values. */
export function subscriptionStatusExplanation(status: string): string | null {
  const s = status.toLowerCase();
  if (s === 'incomplete' || s === 'incomplete_expired') {
    return 'Stripe is still finalizing the first payment or setup. If checkout succeeded, wait a minute and pull to refresh—status usually becomes active once the first invoice is paid.';
  }
  if (s === 'trialing') return 'You are in a trial period before the first charge.';
  if (s === 'past_due') return 'A recent payment failed. Update your card in Payment & billing.';
  if (s === 'canceled' || s === 'unpaid') return 'This subscription is no longer collecting payments.';
  if (s === 'active') return 'Subscription is active and billing on schedule.';
  return null;
}
