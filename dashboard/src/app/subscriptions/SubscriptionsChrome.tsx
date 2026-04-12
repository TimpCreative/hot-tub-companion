'use client';

import { useEffect, useState } from 'react';

type TenantConfigPayload = {
  success?: boolean;
  data?: {
    branding?: { primaryColor?: string; name?: string; logoUrl?: string };
    name?: string;
  };
};

export function SubscriptionsChrome({ children }: { children: React.ReactNode }) {
  const [primary, setPrimary] = useState('#1B4D7A');
  const [name, setName] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/dashboard/tenant-config');
        const json = (await res.json()) as TenantConfigPayload | { error?: string };
        if (cancelled || !res.ok) return;
        const d = 'data' in json ? json.data : undefined;
        const b = d?.branding;
        if (b?.primaryColor) setPrimary(b.primaryColor);
        if (b?.logoUrl) setLogoUrl(b.logoUrl);
        setName(d?.name ?? null);
      } catch {
        /* minimal chrome still works */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ fontFamily: 'system-ui, sans-serif', backgroundColor: '#f8fafc' }}
    >
      <header
        className="border-b border-slate-200 bg-white px-4 py-4 flex items-center gap-3"
        style={{ borderTopColor: primary, borderTopWidth: 3 }}
      >
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="h-9 w-auto max-w-[160px] object-contain" />
        ) : null}
        <span className="text-slate-800 font-semibold text-lg">{name || 'Hot Tub Companion'}</span>
      </header>
      <main className="flex-1 px-4 py-8 max-w-lg mx-auto w-full">{children}</main>
    </div>
  );
}
