'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function getApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_URL || 'https://api.hottubcompanion.com').trim();
  return raw.replace(/\/+$/, '');
}

function CheckoutInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const [failed, setFailed] = useState(false);
  const [failMessage, setFailMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/v1/public/subscriptions/start-checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
        const json = (await res.json()) as {
          success?: boolean;
          data?: { url?: string };
          error?: { message?: string; code?: string };
        };
        if (cancelled) return;
        if (!res.ok || !json.success || !json.data?.url) {
          setFailMessage(json.error?.message || 'Could not start checkout. Please try again from the app.');
          setFailed(true);
          return;
        }
        window.location.replace(json.data.url);
      } catch {
        if (!cancelled) {
          setFailMessage('Network error. Check your connection and try again.');
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const noToken = !token;
  const working = Boolean(token) && !failed;
  const errorText = noToken
    ? 'Missing checkout token. Open Subscribe again from the app.'
    : failMessage;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-center">
      {working ? (
        <>
          <p className="text-slate-700 font-medium">Redirecting to secure checkout…</p>
          <p className="text-slate-500 text-sm mt-2">If nothing happens, refresh this page.</p>
        </>
      ) : (
        <p className="text-red-700 text-sm">{errorText}</p>
      )}
    </div>
  );
}

export default function SubscriptionCheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-center text-slate-600">
          Loading…
        </div>
      }
    >
      <CheckoutInner />
    </Suspense>
  );
}
