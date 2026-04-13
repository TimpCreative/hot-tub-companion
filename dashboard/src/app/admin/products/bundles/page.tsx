'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';

type BundleRow = {
  id: string;
  title: string;
  slug?: string | null;
  stripePriceId: string | null;
  stripeProductId?: string | null;
  posProductId?: string | null;
  components: Array<{ posProductId: string; quantity: number }>;
  active: boolean;
  sortOrder: number;
  heroSubscribeCategory?: string | null;
  isKit?: boolean;
};

function errMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'error' in e) {
    const er = (e as { error?: { message?: string } }).error;
    if (er?.message) return er.message;
  }
  return 'Request failed';
}

export default function ProductsBundlesPage() {
  const { getIdToken } = useAuth();
  const api = useMemo(() => createTenantApiClient(async () => await getIdToken()), [getIdToken]);
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [unitDollars, setUnitDollars] = useState('');
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [stripePriceId, setStripePriceId] = useState('');
  const [stripeProductId, setStripeProductId] = useState('');
  const [posProductId, setPosProductId] = useState('');
  const [componentsJson, setComponentsJson] = useState('[{"posProductId":"","quantity":1}]');
  const [isKit, setIsKit] = useState(true);
  const [active, setActive] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = (await api.get('/admin/products/bundles')) as { data?: { bundles?: BundleRow[] } };
      setBundles(Array.isArray(res?.data?.bundles) ? res.data!.bundles! : []);
    } catch (e: unknown) {
      setErr(errMessage(e));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setUnitDollars('');
    setInterval('month');
    setAdvancedOpen(false);
    setStripePriceId('');
    setStripeProductId('');
    setPosProductId('');
    setComponentsJson('[{"posProductId":"","quantity":1}]');
    setIsKit(true);
    setActive(true);
  }

  function startEdit(b: BundleRow) {
    setEditingId(b.id);
    setTitle(b.title);
    setAdvancedOpen(true);
    setStripePriceId(b.stripePriceId || '');
    setStripeProductId(b.stripeProductId || '');
    setPosProductId(b.posProductId || '');
    setComponentsJson(JSON.stringify(b.components?.length ? b.components : [{ posProductId: '', quantity: 1 }], null, 2));
    setIsKit(b.isKit !== false);
    setActive(b.active);
    setUnitDollars('');
    setInterval('month');
  }

  async function save() {
    setMsg(null);
    setErr(null);
    let components: Array<{ posProductId: string; quantity: number }>;
    try {
      const parsed = JSON.parse(componentsJson) as unknown;
      if (!Array.isArray(parsed)) throw new Error('Components must be a JSON array');
      components = parsed.map((x) => {
        if (!x || typeof x !== 'object') throw new Error('Invalid component row');
        const o = x as { posProductId?: string; quantity?: number };
        if (!o.posProductId?.trim()) throw new Error('Each component needs posProductId');
        const q = Number(o.quantity);
        if (!Number.isFinite(q) || q < 1) throw new Error('Each component needs quantity ≥ 1');
        return { posProductId: o.posProductId.trim(), quantity: Math.floor(q) };
      });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Invalid components JSON');
      return;
    }

    const useAdvanced = advancedOpen && stripePriceId.trim().length > 0;
    const dollars = parseFloat(unitDollars.replace(/,/g, ''));
    const body: Record<string, unknown> = {
      title: title.trim(),
      posProductId: posProductId.trim() || null,
      components,
      active,
      isKit,
    };

    if (useAdvanced) {
      body.stripePriceId = stripePriceId.trim();
      if (stripeProductId.trim()) body.stripeProductId = stripeProductId.trim();
    } else {
      if (!Number.isFinite(dollars) || dollars <= 0) {
        setErr('Enter a valid kit price (USD) or use advanced Stripe price id');
        return;
      }
      body.pricing = {
        unitAmountCents: Math.round(dollars * 100),
        currency: 'usd',
        interval,
      };
    }

    try {
      if (editingId) {
        await api.put(`/admin/products/bundles/${editingId}`, body);
        setMsg('Bundle updated');
      } else {
        await api.post('/admin/products/bundles', body);
        setMsg('Bundle created');
      }
      resetForm();
      await load();
    } catch (e: unknown) {
      setErr(errMessage(e));
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this bundle?')) return;
    setErr(null);
    try {
      await api.delete(`/admin/products/bundles/${id}`);
      setMsg('Bundle deleted');
      if (editingId === id) resetForm();
      await load();
    } catch (e: unknown) {
      setErr(errMessage(e));
    }
  }

  if (loading) return <p className="text-gray-600">Loading…</p>;

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Subscription bundles</h1>
        <p className="mt-1 text-sm text-gray-600">
          Build kit subscriptions from subscription-eligible POS products. Stripe recurring prices are created on your
          connected account when you set a kit price below (or paste an existing price id in advanced).
        </p>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-green-700">{msg}</p> : null}

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-medium text-gray-900">{editingId ? 'Edit bundle' : 'New bundle'}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Kit price (USD)</label>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={unitDollars}
              onChange={(e) => setUnitDollars(e.target.value)}
              placeholder="e.g. 29.99"
              disabled={advancedOpen && !!stripePriceId.trim()}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Billing interval</label>
            <select
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={interval}
              onChange={(e) => setInterval(e.target.value as 'month' | 'year')}
              disabled={advancedOpen && !!stripePriceId.trim()}
            >
              <option value="month">Monthly</option>
              <option value="year">Yearly</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-800 sm:col-span-2">
            <input type="checkbox" checked={isKit} onChange={(e) => setIsKit(e.target.checked)} />
            Treat as kit upsell on product pages (uncheck for single-line bundles you do not want as kit upsells)
          </label>
          <div className="sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={advancedOpen}
                onChange={(e) => {
                  setAdvancedOpen(e.target.checked);
                  if (!e.target.checked) {
                    setStripePriceId('');
                    setStripeProductId('');
                  }
                }}
              />
              Advanced: paste Stripe Price ID (connected account)
            </label>
            {advancedOpen ? (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600">Stripe Price ID</label>
                  <input
                    className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                    value={stripePriceId}
                    onChange={(e) => setStripePriceId(e.target.value)}
                    placeholder="price_..."
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600">Stripe Product ID (optional)</label>
                  <input
                    className="mt-0.5 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                    value={stripeProductId}
                    onChange={(e) => setStripeProductId(e.target.value)}
                    placeholder="prod_..."
                  />
                </div>
              </div>
            ) : null}
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Hero POS product id (optional)</label>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
              value={posProductId}
              onChange={(e) => setPosProductId(e.target.value)}
              placeholder="UUID — PDP can match hero or any line item"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Line items (JSON)</label>
            <textarea
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono min-h-[120px]"
              value={componentsJson}
              onChange={(e) => setComponentsJson(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-800 sm:col-span-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Active
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="primary" onClick={() => void save()}>
            {editingId ? 'Save changes' : 'Create bundle'}
          </Button>
          {editingId ? (
            <Button type="button" variant="secondary" onClick={resetForm}>
              Cancel edit
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Price</th>
              <th className="px-4 py-2 font-medium">POS link</th>
              <th className="px-4 py-2 font-medium">Kit upsell</th>
              <th className="px-4 py-2 font-medium">Active</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {bundles.map((b) => (
              <tr key={b.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{b.title}</td>
                <td className="px-4 py-2 font-mono text-xs">{b.stripePriceId || '—'}</td>
                <td className="px-4 py-2 font-mono text-xs">{b.posProductId || '—'}</td>
                <td className="px-4 py-2">{b.isKit !== false ? 'Yes' : 'No'}</td>
                <td className="px-4 py-2">{b.active ? 'Yes' : 'No'}</td>
                <td className="px-4 py-2 text-right space-x-2">
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => startEdit(b)}>
                    Edit
                  </button>
                  <button type="button" className="text-red-600 hover:underline" onClick={() => void remove(b.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {bundles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                  No bundles yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
