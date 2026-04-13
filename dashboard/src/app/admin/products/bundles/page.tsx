'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

type MappingStatus = 'confirmed' | 'auto_suggested' | string;

type PickerProduct = {
  id: string;
  title: string;
  sku?: string | null;
  price: number;
  mapping_status?: MappingStatus;
  uhtd_part_name?: string | null;
};

type BundleLine = { posProductId: string; quantity: number; title?: string };

type BundleRow = {
  id: string;
  title: string;
  slug?: string | null;
  posProductId?: string | null;
  components: Array<{ posProductId: string; quantity: number }> | string;
  active: boolean;
  sortOrder?: number;
  isKit?: boolean;
  bundleDiscountPercent?: number | null;
  bundleRecurringUnitAmountCents?: number | null;
  previewSubtotalCents?: number;
  previewSuggestedCents?: number;
  previewDiscountPercent?: number;
};

function errMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'error' in e) {
    const er = (e as { error?: { message?: string } }).error;
    if (er?.message) return er.message;
  }
  return 'Request failed';
}

function parseComponents(raw: BundleRow['components']): Array<{ posProductId: string; quantity: number }> {
  if (!raw) return [];
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw) as unknown;
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x) => {
      if (!x || typeof x !== 'object') return null;
      const o = x as { posProductId?: string; quantity?: unknown };
      const id = o.posProductId?.trim();
      const q = Number(o.quantity);
      if (!id || !Number.isFinite(q) || q < 1) return null;
      return { posProductId: id, quantity: Math.floor(q) };
    })
    .filter((x): x is { posProductId: string; quantity: number } => x != null);
}

function mappingBadge(status: MappingStatus | undefined) {
  switch (status) {
    case 'confirmed':
      return <Badge variant="success">Mapped</Badge>;
    case 'auto_suggested':
      return <Badge variant="pending">Suggested</Badge>;
    default:
      return <Badge variant="default">Unmapped</Badge>;
  }
}

function centsToUsd(c: number | null | undefined): string {
  if (c == null || !Number.isFinite(c)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c / 100);
}

export default function ProductsBundlesPage() {
  const { getIdToken } = useAuth();
  const api = useMemo(() => createTenantApiClient(async () => await getIdToken()), [getIdToken]);
  const [bundles, setBundles] = useState<BundleRow[]>([]);
  const [tenantDefaultDiscount, setTenantDefaultDiscount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState('0');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [lines, setLines] = useState<BundleLine[]>([]);
  const [bundleDiscountOverride, setBundleDiscountOverride] = useState('');
  const [unitDollars, setUnitDollars] = useState('');
  const [active, setActive] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isKit, setIsKit] = useState(true);

  const [searchQ, setSearchQ] = useState('');
  const [searchHits, setSearchHits] = useState<PickerProduct[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [preview, setPreview] = useState<{ subtotalCents: number; suggestedCents: number; discountPercent: number } | null>(
    null
  );
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalPriceTouched = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const [bRes, cRes] = await Promise.all([
        api.get('/admin/products/bundles') as Promise<{ data?: { bundles?: BundleRow[] } }>,
        api.get('/admin/subscriptions/connect') as Promise<{
          data?: { subscriptionBundleDefaultDiscountPercent?: number };
        }>,
      ]);
      setBundles(Array.isArray(bRes?.data?.bundles) ? bRes.data!.bundles! : []);
      const d = cRes?.data?.subscriptionBundleDefaultDiscountPercent;
      const n = Number(d ?? 0);
      setTenantDefaultDiscount(Number.isFinite(n) ? n : 0);
      setSettingsDraft(String(Number.isFinite(n) ? n : 0));
    } catch (e: unknown) {
      setErr(errMessage(e));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  const componentsForPreview = useMemo(
    () => lines.map((l) => ({ posProductId: l.posProductId, quantity: l.quantity })),
    [lines]
  );

  const bundleDiscountForApi = useMemo(() => {
    const t = bundleDiscountOverride.trim();
    if (t === '') return null;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }, [bundleDiscountOverride]);

  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => {
      void (async () => {
        try {
          const res = (await api.post('/admin/products/bundles/preview', {
            components: componentsForPreview,
            bundleDiscountPercent: bundleDiscountForApi,
          })) as {
            data?: { subtotalCents?: number; suggestedCents?: number; discountPercent?: number };
          };
          const d = res?.data;
          if (d && typeof d.subtotalCents === 'number' && typeof d.suggestedCents === 'number') {
            setPreview({
              subtotalCents: d.subtotalCents,
              suggestedCents: d.suggestedCents,
              discountPercent: Number(d.discountPercent ?? 0),
            });
          }
        } catch {
          setPreview(null);
        }
      })();
    }, 300);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [api, componentsForPreview, bundleDiscountForApi]);

  useEffect(() => {
    if (!editorOpen || editingId) return;
    if (finalPriceTouched.current || !preview || lines.length < 1) return;
    setUnitDollars((preview.suggestedCents / 100).toFixed(2));
  }, [preview, editorOpen, editingId, lines.length]);

  useEffect(() => {
    const t = searchQ.trim();
    if (t.length < 2) {
      setSearchHits([]);
      return;
    }
    const h = setTimeout(() => {
      void (async () => {
        setSearchLoading(true);
        try {
          const res = (await api.get('/admin/products/search-for-bundles', {
            params: { q: t, limit: 15 },
          })) as { data?: { products?: PickerProduct[] } };
          setSearchHits(Array.isArray(res?.data?.products) ? res.data!.products! : []);
        } catch {
          setSearchHits([]);
        } finally {
          setSearchLoading(false);
        }
      })();
    }, 300);
    return () => clearTimeout(h);
  }, [api, searchQ]);

  function resetEditor() {
    finalPriceTouched.current = false;
    setEditingId(null);
    setTitle('');
    setInterval('month');
    setLines([]);
    setBundleDiscountOverride('');
    setUnitDollars('');
    setActive(true);
    setAdvancedOpen(false);
    setIsKit(true);
    setSearchQ('');
    setSearchHits([]);
    setPreview(null);
  }

  function openCreate() {
    resetEditor();
    setEditorOpen(true);
  }

  function openEdit(b: BundleRow) {
    finalPriceTouched.current = true;
    const comps = parseComponents(b.components);
    setEditingId(b.id);
    setTitle(b.title);
    setInterval('month');
    setLines(
      comps.map((c) => ({
        posProductId: c.posProductId,
        quantity: c.quantity,
      }))
    );
    const o = b.bundleDiscountPercent;
    setBundleDiscountOverride(o != null && Number.isFinite(Number(o)) ? String(o) : '');
    const saved = b.bundleRecurringUnitAmountCents;
    setUnitDollars(
      saved != null && Number.isFinite(saved) ? (saved / 100).toFixed(2) : ''
    );
    setActive(b.active);
    setIsKit(b.isKit !== false);
    setAdvancedOpen(false);
    setSearchQ('');
    setSearchHits([]);
    setEditorOpen(true);
  }

  function addProduct(p: PickerProduct) {
    if (lines.some((l) => l.posProductId === p.id)) return;
    setLines((prev) => [...prev, { posProductId: p.id, quantity: 1, title: p.title }]);
    setSearchQ('');
    setSearchHits([]);
  }

  function setQty(i: number, q: number) {
    const n = Math.max(1, Math.floor(q));
    setLines((prev) => prev.map((l, j) => (j === i ? { ...l, quantity: n } : l)));
  }

  function removeLine(i: number) {
    setLines((prev) => prev.filter((_, j) => j !== i));
  }

  function makePrimary(i: number) {
    if (i <= 0) return;
    setLines((prev) => {
      const next = [...prev];
      const [row] = next.splice(i, 1);
      next.unshift(row);
      return next;
    });
  }

  async function saveBundleDefaults() {
    setMsg(null);
    setErr(null);
    const t = settingsDraft.trim();
    const n = t === '' ? 0 : parseFloat(t);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setErr('Enter a default discount from 0 to 100.');
      return;
    }
    try {
      const res = (await api.put('/admin/subscriptions/settings', {
        subscriptionBundleDefaultDiscountPercent: n,
      })) as { data?: { subscriptionBundleDefaultDiscountPercent?: number } };
      const d = res?.data?.subscriptionBundleDefaultDiscountPercent;
      setTenantDefaultDiscount(Number(d ?? n));
      setSettingsDraft(String(d ?? n));
      setMsg('Bundle defaults saved');
      setSettingsOpen(false);
    } catch (e: unknown) {
      setErr(errMessage(e));
    }
  }

  async function saveBundle() {
    setMsg(null);
    setErr(null);
    if (!title.trim()) {
      setErr('Title is required');
      return;
    }
    if (lines.length < 1) {
      setErr('Add at least one product to the bundle');
      return;
    }
    const dollars = parseFloat(unitDollars.replace(/,/g, ''));
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setErr('Enter a valid final subscription price (USD)');
      return;
    }
    const body: Record<string, unknown> = {
      title: title.trim(),
      components: lines.map((l) => ({ posProductId: l.posProductId, quantity: l.quantity })),
      pricing: {
        unitAmountCents: Math.round(dollars * 100),
        currency: 'usd',
        interval,
      },
      bundleDiscountPercent: bundleDiscountForApi,
      active,
      isKit,
    };
    try {
      if (editingId) {
        await api.put(`/admin/products/bundles/${editingId}`, body);
        setMsg('Bundle updated');
      } else {
        await api.post('/admin/products/bundles', body);
        setMsg('Bundle created');
      }
      setEditorOpen(false);
      resetEditor();
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
      await load();
    } catch (e: unknown) {
      setErr(errMessage(e));
    }
  }

  if (loading) return <p className="text-gray-600">Loading…</p>;

  return (
    <div className="max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Subscription bundles</h1>
          <p className="mt-1 text-sm text-gray-600">
            Add subscription-eligible products as lines. We suggest a price from catalog totals and your discount; you set
            the final recurring price—Stripe prices are created on your connected account.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => setSettingsOpen(true)}>
            Bundle defaults
          </Button>
          <Button type="button" variant="primary" onClick={openCreate}>
            New bundle
          </Button>
        </div>
      </div>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-green-700">{msg}</p> : null}

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Saved price</th>
              <th className="px-4 py-2 font-medium">Suggested</th>
              <th className="px-4 py-2 font-medium">Kit upsell</th>
              <th className="px-4 py-2 font-medium">Active</th>
              <th className="px-4 py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {bundles.map((b) => (
              <tr key={b.id} className="border-t border-gray-100">
                <td className="px-4 py-2 font-medium text-gray-900">{b.title}</td>
                <td className="px-4 py-2">{centsToUsd(b.bundleRecurringUnitAmountCents)}</td>
                <td className="px-4 py-2 text-gray-700">{centsToUsd(b.previewSuggestedCents)}</td>
                <td className="px-4 py-2">{b.isKit !== false ? 'Yes' : 'No'}</td>
                <td className="px-4 py-2">{b.active ? 'Yes' : 'No'}</td>
                <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                  <button type="button" className="text-blue-600 hover:underline" onClick={() => openEdit(b)}>
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

      <Modal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Bundle defaults"
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setSettingsOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={() => void saveBundleDefaults()}>
              Save
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-600 mb-4">
          Default bundle discount ({tenantDefaultDiscount}% today) applies when a bundle does not set its own override.
          Suggested price = sum of line catalog prices minus this percent.
        </p>
        <label className="block text-sm font-medium text-gray-700">Default discount (%)</label>
        <input
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={settingsDraft}
          onChange={(e) => setSettingsDraft(e.target.value)}
        />
      </Modal>

      <Modal
        isOpen={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          resetEditor();
        }}
        title={editingId ? 'Edit bundle' : 'New bundle'}
        size="xl"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setEditorOpen(false);
                resetEditor();
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="primary" onClick={() => void saveBundle()}>
              {editingId ? 'Save changes' : 'Create bundle'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
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
              <label className="block text-sm font-medium text-gray-700">Billing interval</label>
              <select
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={interval}
                onChange={(e) => setInterval(e.target.value as 'month' | 'year')}
              >
                <option value="month">Monthly</option>
                <option value="year">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Bundle discount override (%)</label>
              <input
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                placeholder={`Leave blank for tenant default (${tenantDefaultDiscount}%)`}
                value={bundleDiscountOverride}
                onChange={(e) => setBundleDiscountOverride(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Add products</label>
            <p className="text-xs text-gray-500 mt-0.5">Search subscription-eligible catalog products (min. 2 characters).</p>
            <input
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              placeholder="Search by title, SKU, vendor…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
            {searchLoading ? <p className="text-xs text-gray-500 mt-1">Searching…</p> : null}
            {searchHits.length > 0 ? (
              <ul className="mt-2 max-h-48 overflow-auto rounded-md border border-gray-200 bg-gray-50 divide-y divide-gray-100">
                {searchHits.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-white flex flex-wrap items-center justify-between gap-2"
                      onClick={() => addProduct(p)}
                    >
                      <span className="font-medium text-gray-900">{p.title}</span>
                      <span className="flex items-center gap-2 shrink-0">
                        {mappingBadge(p.mapping_status)}
                        <span className="text-gray-600">{centsToUsd(p.price)}</span>
                      </span>
                    </button>
                    {p.uhtd_part_name ? (
                      <p className="px-3 pb-2 text-xs text-gray-500 -mt-1">{p.uhtd_part_name}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-900">Line items</h3>
            {lines.length === 0 ? (
              <p className="text-sm text-gray-500 mt-1">No products yet. The first line is the primary product for PDP matching.</p>
            ) : (
              <table className="mt-2 min-w-full text-sm border border-gray-200 rounded-md overflow-hidden">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Product</th>
                    <th className="px-3 py-2 text-left font-medium w-28">Qty</th>
                    <th className="px-3 py-2 text-right font-medium w-40">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={`${l.posProductId}-${i}`} className="border-t border-gray-100">
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900">{l.title || l.posProductId}</div>
                        {i === 0 ? <span className="text-xs text-green-700">Primary for PDP</span> : null}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={1}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
                          value={l.quantity}
                          onChange={(e) => setQty(i, parseInt(e.target.value, 10))}
                        />
                      </td>
                      <td className="px-3 py-2 text-right space-x-2">
                        {i > 0 ? (
                          <button type="button" className="text-blue-600 hover:underline text-xs" onClick={() => makePrimary(i)}>
                            Set primary
                          </button>
                        ) : null}
                        <button type="button" className="text-red-600 hover:underline text-xs" onClick={() => removeLine(i)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="rounded-md bg-gray-50 border border-gray-200 p-4 space-y-2">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="text-gray-600">Catalog subtotal</span>
              <span className="font-medium">{preview ? centsToUsd(preview.subtotalCents) : '—'}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="text-gray-600">Discount applied</span>
              <span className="font-medium">{preview ? `${preview.discountPercent}%` : '—'}</span>
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <span className="text-gray-600">Suggested subscription price</span>
              <span className="font-medium">{preview ? centsToUsd(preview.suggestedCents) : '—'}</span>
            </div>
            <div className="pt-2 border-t border-gray-200">
              <label className="block text-sm font-medium text-gray-700">Final subscription price (USD)</label>
              <input
                className="mt-1 w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={unitDollars}
                onChange={(e) => {
                  finalPriceTouched.current = true;
                  setUnitDollars(e.target.value);
                }}
                placeholder="e.g. 29.99"
              />
              <p className="text-xs text-gray-500 mt-1">This amount is used to create the Stripe recurring price.</p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-800">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded border-gray-300" />
            Active
          </label>

          <div>
            <button
              type="button"
              className="text-sm text-blue-600 hover:underline"
              onClick={() => setAdvancedOpen((o) => !o)}
            >
              {advancedOpen ? 'Hide' : 'Show'} advanced
            </button>
            {advancedOpen ? (
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-800">
                <input type="checkbox" checked={isKit} onChange={(e) => setIsKit(e.target.checked)} />
                Treat as kit upsell on product pages
              </label>
            ) : null}
          </div>
        </div>
      </Modal>
    </div>
  );
}
