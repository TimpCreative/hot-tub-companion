'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

function tenantSlugFromHost(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  if (host.includes('localhost')) {
    const q = new URLSearchParams(window.location.search);
    return q.get('tenant')?.trim() || null;
  }
  const sub = host.split('.')[0];
  if (!sub || sub === 'www' || sub === 'hottubcompanion') return null;
  return sub;
}

function CompleteInner() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status') || '';
  const sessionId = searchParams.get('session_id') || '';

  const scheme = useMemo(() => tenantSlugFromHost() || 'hottubcompanion', []);

  const deepLink = useMemo(() => {
    const q = new URLSearchParams();
    if (status) q.set('status', status);
    if (sessionId && sessionId !== '{CHECKOUT_SESSION_ID}') q.set('session_id', sessionId);
    const qs = q.toString();
    return `${scheme}://subscriptions/complete${qs ? `?${qs}` : ''}`;
  }, [scheme, status, sessionId]);

  const title =
    status === 'success'
      ? 'Subscription confirmed'
      : status === 'cancel'
        ? 'Checkout canceled'
        : status === 'portal_return'
          ? 'Billing portal closed'
          : 'Subscription';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <p className="text-slate-600 text-sm">
        {status === 'success'
          ? 'You can return to the Hot Tub Companion app to see your subscription.'
          : status === 'cancel'
            ? 'No charges were made. You can subscribe again anytime from the app.'
            : 'You can return to the app to continue.'}
      </p>
      <a
        href={deepLink}
        className="inline-flex justify-center items-center rounded-lg px-4 py-3 bg-slate-900 text-white text-sm font-semibold w-full"
      >
        Open app
      </a>
      <p className="text-xs text-slate-500 break-all">If the button does not open the app, copy this link: {deepLink}</p>
    </div>
  );
}

export default function SubscriptionCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-slate-600">Loading…</div>
      }
    >
      <CompleteInner />
    </Suspense>
  );
}
