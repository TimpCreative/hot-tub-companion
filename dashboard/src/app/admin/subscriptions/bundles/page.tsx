'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';

type BundleRow = {
  id: string;
  title: string;
  slug?: string | null;
  stripePriceId: string;
  posProductId?: string | null;
  components: Array<{ posProductId: string; quantity: number }>;
  active: boolean;
  sortOrder: number;
  heroSubscribeCategory?: string | null;
};

function errMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'error' in e) {
    const er = (e as { error?: { message?: string } }).error;
    if (er?.message) return er.message;
  }
  return 'Request failed';
}

export default function SubscriptionsBundlesPage() {
  const { getIdToken } = useAuth();
  const api = useMemo(() => createTenantApiClient(async () => await getIdToken()), [getIdToken]);
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [stripePriceId, setStripePriceId] = useState('');
  const [posProductId, setPosProductId] = useState('');
  const [componentsJson, setComponentsJson] = useState('[{"posProductId":"","quantity":1}]');
  const [active, setActive] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = (await api.get('/admin/subscriptions/bundles')) as { data?: { bundles?: BundleRow[] } };
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
    setStripePriceId('');
    setPosProductId('');
    setComponentsJson('[{"posProductId":"","quantity":1}]');
    setActive(true);
  }

  function startEdit(b: BundleRow) {
    setEditingId(b.id);
    setTitle(b.title);
    setStripePriceId(b.stripePriceId);
    setPosProductId(b.posProductId || '');
    setComponentsJson(JSON.stringify(b.components?.length ? b.components : [{ posProductId: '', quantity: 1 }], null, 2));
    setActive(b.active);
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
    const body = {
      title: title.trim(),
      stripePriceId: stripePriceId.trim(),
      posProductId: posProductId.trim() || null,
      components,
      active,
    };
    try {
      if (editingId) {
        await api.put(`/admin/subscriptions/bundles/${editingId}`, body);
        setMsg('Bundle updated');
      } else {
        await api.post('/admin/subscriptions/bundles', body);
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
      await api.delete(`/admin/subscriptions/bundles/${id}`);
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
          Map POS products to Stripe Prices on your connected account. The mobile app uses the bundle linked to a
          product&apos;s POS id for Subscribe.
        </p>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-green-700">{msg}</p> : null}

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-medium text-gray-900">{editingId ? 'Edit bundle' : 'New bundle'}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Title</label>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Stripe Price ID (on connected account)</label>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
              value={stripePriceId}
              onChange={(e) => setStripePriceId(e.target.value)}
              placeholder="price_..."
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">Hero POS product id (optional)</label>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
              value={posProductId}
              onChange={(e) => setPosProductId(e.target.value)}
              placeholder="UUID from POS product — used for PDP Subscribe"
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
              <th className="px-4 py-2 font-medium">Active</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {bundles.map((b) => (
              <tr key={b.id} className="border-t border-gray-100">
                <td className="px-4 py-2">{b.title}</td>
                <td className="px-4 py-2 font-mono text-xs">{b.stripePriceId}</td>
                <td className="px-4 py-2 font-mono text-xs">{b.posProductId || '—'}</td>
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
                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
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
