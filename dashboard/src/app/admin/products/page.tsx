'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Menu, MenuButton, MenuHeading, MenuItem, MenuItems, MenuSection, MenuSeparator } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/contexts/AuthContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { SearchInput } from '@/components/ui/SearchInput';

type MappingStatus = 'unmapped' | 'auto_suggested' | 'confirmed';

type CollectionSummary = {
  shopifyCollectionId: string;
  title: string | null;
  handle: string | null;
};

type PosProductRow = Record<string, unknown> & {
  id: string;
  title: string;
  description?: string | null;
  vendor?: string | null;
  product_type?: string | null;
  tags?: string[] | null;
  sku: string | null;
  barcode: string | null;
  price: number;
  compare_at_price?: number | null;
  inventory_quantity: number;
  mapping_status: MappingStatus;
  mapping_confidence: number | null;
  is_hidden: boolean;
  uhtd_part_id: string | null;
  uhtd_part_name?: string | null;
  uhtd_part_number?: string | null;
  top_suggestion_score?: number | null;
  pos_product_id: string;
  pos_variant_id: string | null;
  last_synced_at: string;
  updated_at: string;
  collections?: CollectionSummary[];
  first_image_url?: string | null;
  subscription_eligible?: boolean;
  subscription_stripe_price_id?: string | null;
  subscription_unit_amount_cents?: number | null;
  subscription_currency?: string | null;
  subscription_interval?: string | null;
};

interface Suggestion {
  partId: string;
  name: string;
  partNumber: string | null;
  manufacturer: string | null;
  score: number;
  reason: string;
}

type ShopifyCollectionOpt = {
  shopify_collection_id: string;
  title: string | null;
  handle: string | null;
};

function formatCents(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function statusBadge(status: MappingStatus) {
  switch (status) {
    case 'confirmed':
      return <Badge variant="success">Confirmed</Badge>;
    case 'auto_suggested':
      return <Badge variant="pending">Suggested</Badge>;
    default:
      return <Badge variant="default">Unmapped</Badge>;
  }
}

/** Tier colors for suggestion / mapping confidence 0–1 scores (red / orange / yellow). */
function confidenceTierClasses(score: number): string {
  const pct = Math.round(score * 100);
  if (pct < 50) return 'bg-red-100 text-red-800 border-red-200';
  if (pct < 90) return 'bg-orange-100 text-orange-800 border-orange-200';
  return 'bg-yellow-100 text-yellow-900 border-yellow-200';
}

function ConfidencePill({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${confidenceTierClasses(
        score
      )}`}
    >
      {pct}%
    </span>
  );
}

const TABLE_SORTABLE_API_FIELDS = [
  'title',
  'price',
  'inventory',
  'mapping_status',
  'is_hidden',
] as const;

function tableSortProps(sortVal: string): {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
} {
  const m = sortVal.match(
    /^(title|price|inventory|mapping_status|is_hidden|mapping_confidence|updated_at)_(asc|desc)$/
  );
  if (!m) return {};
  return { sortBy: m[1], sortOrder: m[2] as 'asc' | 'desc' };
}

function toggleSortForColumn(currentSort: string, columnKey: string): string | null {
  const field = columnKey;
  if (!TABLE_SORTABLE_API_FIELDS.includes(columnKey as (typeof TABLE_SORTABLE_API_FIELDS)[number])) {
    return null;
  }
  const asc = `${field}_asc`;
  const desc = `${field}_desc`;
  if (currentSort === asc) return desc;
  if (currentSort === desc) return asc;
  return asc;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default function AdminProductsPage() {
  const { getIdToken } = useAuth();
  const api = useMemo(() => createTenantApiClient(async () => await getIdToken()), [getIdToken]);

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PosProductRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [mappingStatus, setMappingStatus] = useState<MappingStatus | 'all'>('all');
  const [shopifyCollectionId, setShopifyCollectionId] = useState('');
  const [vendor, setVendor] = useState('');
  const [productType, setProductType] = useState('');
  const [inStock, setInStock] = useState<'all' | 'true' | 'false'>('all');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [tag, setTag] = useState('');
  const [sort, setSort] = useState('updated_at_desc');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isHidden, setIsHidden] = useState<'all' | 'true' | 'false'>('all');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);

  const [collections, setCollections] = useState<ShopifyCollectionOpt[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [showCheckedOnly, setShowCheckedOnly] = useState(false);
  const [selectionToken, setSelectionToken] = useState<string | null>(null);
  const [selectionCount, setSelectionCount] = useState<number>(0);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkInfo, setBulkInfo] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const importPreviewInputRef = useRef<HTMLInputElement>(null);
  const importApplyInputRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected] = useState<PosProductRow | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [offerDollars, setOfferDollars] = useState('');
  const [offerInterval, setOfferInterval] = useState<'month' | 'year'>('month');
  const [subscriptionActionError, setSubscriptionActionError] = useState<string | null>(null);

  const buildListParams = useCallback(
    (forIds?: string) => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sort: sort || 'updated_at_desc',
      });
      if (search.trim()) params.set('search', search.trim());
      if (mappingStatus !== 'all') params.set('mappingStatus', mappingStatus);
      if (shopifyCollectionId.trim()) params.set('shopifyCollectionId', shopifyCollectionId.trim());
      if (vendor.trim()) params.set('vendor', vendor.trim());
      if (productType.trim()) params.set('productType', productType.trim());
      if (inStock !== 'all') params.set('inStock', inStock);
      if (priceMin.trim()) params.set('priceMin', priceMin.trim());
      if (priceMax.trim()) params.set('priceMax', priceMax.trim());
      if (tag.trim()) params.set('tag', tag.trim());
      if (isHidden !== 'all') params.set('isHidden', isHidden);
      if (forIds) params.set('ids', forIds);
      return params;
    },
    [
      page,
      pageSize,
      search,
      mappingStatus,
      shopifyCollectionId,
      vendor,
      productType,
      inStock,
      priceMin,
      priceMax,
      tag,
      sort,
      isHidden,
    ]
  );

  const selectionListDep = useMemo(
    () => (showCheckedOnly ? [...selectedIds].sort().join(',') : ''),
    [showCheckedOnly, selectedIds]
  );

  const fetchProducts = useCallback(
    async (options?: { skipLoading?: boolean }) => {
      const silent = options?.skipLoading === true;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const idsParam =
          showCheckedOnly && selectionListDep.length > 0 ? selectionListDep : undefined;
        const params = buildListParams(idsParam);
        const res = (await api.get(`/admin/products?${params.toString()}`)) as any;
        if (res?.success) {
          const data = (res.data || []) as PosProductRow[];
          setRows(data);
          setTotal(res.pagination?.total || 0);
          setSelected((prev) => {
            if (!prev) return prev;
            const hit = data.find((r) => r.id === prev.id);
            return hit ? { ...prev, ...hit } : prev;
          });
        } else {
          setError(res?.error?.message || 'Failed to load products');
        }
      } catch (err: any) {
        setError(err?.error?.message || err?.message || 'Failed to load products');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [api, buildListParams, showCheckedOnly, selectionListDep]
  );

  const filtersDep = useMemo(
    () =>
      JSON.stringify({
        search,
        mappingStatus,
        shopifyCollectionId,
        vendor,
        productType,
        inStock,
        priceMin,
        priceMax,
        tag,
        sort,
        isHidden,
      }),
    [
      search,
      mappingStatus,
      shopifyCollectionId,
      vendor,
      productType,
      inStock,
      priceMin,
      priceMax,
      tag,
      sort,
      isHidden,
    ]
  );

  useEffect(() => {
    (async () => {
      try {
        const res = (await api.get('/admin/shopify-collections')) as any;
        if (res?.success) setCollections(res.data || []);
      } catch {
        setCollections([]);
      }
    })();
  }, [api]);

  useEffect(() => {
    setPage(1);
  }, [filtersDep]);

  useEffect(() => {
    if (!selected) {
      setOfferDollars('');
      setOfferInterval('month');
      return;
    }
    const c = selected.subscription_unit_amount_cents;
    setOfferDollars(
      c != null && Number.isFinite(Number(c)) ? (Number(c) / 100).toFixed(2) : ''
    );
    setOfferInterval(selected.subscription_interval === 'year' ? 'year' : 'month');
  }, [selected?.id, selected?.subscription_unit_amount_cents, selected?.subscription_interval]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void fetchProducts();
    }, 280);
    return () => window.clearTimeout(t);
  }, [page, pageSize, filtersDep, showCheckedOnly, selectionListDep, fetchProducts]);

  async function loadSuggestions(productId: string) {
    setSuggestions([]);
    setSuggestionsLoading(true);
    try {
      const res = (await api.get(`/admin/products/${productId}/uhtd-suggestions`)) as any;
      if (res?.success) setSuggestions(res.data || []);
    } finally {
      setSuggestionsLoading(false);
    }
  }

  async function toggleHidden(row: PosProductRow) {
    setActionLoading(true);
    try {
      await api.put(`/admin/products/${row.id}/visibility`, { isHidden: !row.is_hidden });
      await fetchProducts({ skipLoading: true });
      if (selected?.id === row.id) {
        setSelected({ ...row, is_hidden: !row.is_hidden });
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function confirmMappingTo(
    partId: string,
    confidence?: number,
    partMeta?: { name: string; partNumber: string | null }
  ) {
    if (!selected) return;
    const selId = selected.id;
    setActionLoading(true);
    try {
      const res = (await api.post(`/admin/products/${selId}/map`, {
        uhtdPartId: partId,
        mappingConfidence: typeof confidence === 'number' ? confidence : null,
      })) as any;
      if (res?.success && res.data) {
        const updated = res.data as Record<string, unknown>;
        setSelected((prev) =>
          prev && prev.id === selId
            ? ({
                ...prev,
                ...updated,
                collections: prev.collections,
                first_image_url: prev.first_image_url,
                uhtd_part_name: partMeta?.name ?? prev.uhtd_part_name,
                uhtd_part_number: partMeta?.partNumber ?? prev.uhtd_part_number,
                top_suggestion_score: null,
              } as PosProductRow)
            : prev
        );
      }
      await fetchProducts({ skipLoading: true });
    } finally {
      setActionLoading(false);
    }
  }

  async function setSubscriptionEligibleForRow(row: PosProductRow, eligible: boolean) {
    setSubscriptionActionError(null);
    setActionLoading(true);
    try {
      const res = (await api.put(`/admin/products/${row.id}/subscription-eligible`, {
        subscriptionEligible: eligible,
      })) as { success?: boolean; data?: PosProductRow };
      if (res?.success && res.data) {
        const updated = res.data;
        if (selected?.id === row.id) {
          setSelected((prev) => (prev ? { ...prev, ...updated } : prev));
        }
      }
      await fetchProducts({ skipLoading: true });
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'error' in err
          ? String((err as { error?: { message?: string } }).error?.message || '')
          : '';
      setSubscriptionActionError(msg || 'Could not update subscription eligibility');
    } finally {
      setActionLoading(false);
    }
  }

  async function saveSubscriptionOffer() {
    if (!selected) return;
    const selId = selected.id;
    const dollars = parseFloat(offerDollars.replace(/,/g, ''));
    if (!Number.isFinite(dollars) || dollars <= 0) {
      window.alert('Enter a valid subscription price in USD.');
      return;
    }
    setActionLoading(true);
    try {
      const res = (await api.put(`/admin/products/${selId}/subscription-offer`, {
        unitAmountCents: Math.round(dollars * 100),
        currency: 'usd',
        interval: offerInterval,
      })) as { success?: boolean; data?: PosProductRow };
      if (res?.success && res.data) {
        const updated = res.data;
        setSelected((prev) => (prev && prev.id === selId ? { ...prev, ...updated } : prev));
      }
      await fetchProducts({ skipLoading: true });
    } finally {
      setActionLoading(false);
    }
  }

  async function clearSubscriptionOffer() {
    if (!selected) return;
    const selId = selected.id;
    if (!confirm('Remove Stripe subscription pricing for this variant?')) return;
    setActionLoading(true);
    try {
      const res = (await api.put(`/admin/products/${selId}/subscription-offer`, {
        clear: true,
      })) as { success?: boolean; data?: PosProductRow };
      if (res?.success && res.data) {
        const updated = res.data;
        setSelected((prev) => (prev && prev.id === selId ? { ...prev, ...updated } : prev));
      }
      await fetchProducts({ skipLoading: true });
    } finally {
      setActionLoading(false);
    }
  }

  async function clearMapping() {
    if (!selected) return;
    const selId = selected.id;
    setActionLoading(true);
    try {
      const res = (await api.delete(`/admin/products/${selId}/map`)) as any;
      if (res?.success && res.data) {
        const updated = res.data as Record<string, unknown>;
        setSelected((prev) =>
          prev && prev.id === selId
            ? ({
                ...prev,
                ...updated,
                collections: prev.collections,
                first_image_url: prev.first_image_url,
                uhtd_part_name: null,
                uhtd_part_number: null,
              } as PosProductRow)
            : prev
        );
        void loadSuggestions(selId);
      }
      await fetchProducts({ skipLoading: true });
    } finally {
      setActionLoading(false);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const r of rows) next.add(r.id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setSelectionToken(null);
    setSelectionCount(0);
    setBulkInfo(null);
  }

  useEffect(() => {
    setSubscriptionActionError(null);
  }, [selected?.id]);

  async function selectAllMatchingFilter() {
    setBulkBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = { sort: sort || 'updated_at_desc' };
      if (search.trim()) body.search = search.trim();
      if (mappingStatus !== 'all') body.mappingStatus = mappingStatus;
      if (shopifyCollectionId.trim()) body.shopifyCollectionId = shopifyCollectionId.trim();
      if (vendor.trim()) body.vendor = vendor.trim();
      if (productType.trim()) body.productType = productType.trim();
      if (inStock !== 'all') body.inStock = inStock;
      if (priceMin.trim()) body.priceMin = priceMin.trim();
      if (priceMax.trim()) body.priceMax = priceMax.trim();
      if (tag.trim()) body.tag = tag.trim();
      if (isHidden !== 'all') body.isHidden = isHidden;

      const res = (await api.post('/admin/products/bulk-selection', body)) as any;
      if (!res?.success) {
        setError(res?.error?.message || 'Bulk selection failed');
        return;
      }
      setSelectionToken(res.data?.selection_token || null);
      setSelectionCount(res.data?.count ?? 0);
    } catch (err: any) {
      setError(err?.error?.message || err?.message || 'Bulk selection failed');
    } finally {
      setBulkBusy(false);
    }
  }

  function confirmBulkAction(
    action: 'set_hidden' | 'clear_mapping' | 'set_subscription_eligible',
    opts?: { isHidden?: boolean; subscriptionEligible?: boolean }
  ): boolean {
    const scope =
      selectionCount > 0
        ? `This applies to ${selectionCount} product(s) in your bulk scope (current filters).`
        : 'This applies to all products in your bulk scope (current filters).';
    let detail = '';
    if (action === 'set_hidden') {
      detail = opts?.isHidden
        ? `${scope}\n\nEvery product in that set will be hidden in the app (not deleted from Shopify).`
        : `${scope}\n\nEvery product in that set will be shown again in the app.`;
    } else if (action === 'clear_mapping') {
      detail = `${scope}\n\nUHTD part links will be removed and each product’s mapping status will return to unmapped.`;
    } else if (action === 'set_subscription_eligible') {
      detail =
        opts?.subscriptionEligible === true
          ? `${scope}\n\nProducts will be marked subscription-eligible so they can be used for individual subscriptions and subscription bundles.`
          : `${scope}\n\nSubscription eligibility will be turned off where possible. Products still used in a subscription bundle will be skipped until you remove them from those bundles.`;
    }
    return window.confirm(`Are you sure?\n\n${detail}`);
  }

  async function bulkApply(
    action: 'set_hidden' | 'clear_mapping' | 'set_subscription_eligible',
    opts?: { isHidden?: boolean; subscriptionEligible?: boolean }
  ) {
    if (!selectionToken) {
      setError('Click “Select all matching filters” (under the filters) first to choose which products bulk actions apply to.');
      return;
    }
    if (!confirmBulkAction(action, opts)) {
      return;
    }
    setBulkBusy(true);
    setError(null);
    setBulkInfo(null);
    try {
      const payload =
        action === 'set_hidden'
          ? { isHidden: opts?.isHidden === true }
          : action === 'set_subscription_eligible'
            ? { subscriptionEligible: opts?.subscriptionEligible === true }
            : {};
      const res = (await api.post('/admin/products/bulk-apply', {
        selection_token: selectionToken,
        action,
        payload,
      })) as {
        success?: boolean;
        data?: { updated?: number; skipped_in_bundles?: number };
        error?: { message?: string };
      };
      if (!res?.success) {
        setError(res?.error?.message || 'Bulk apply failed');
        return;
      }
      const skipped = res.data?.skipped_in_bundles ?? 0;
      const n = res.data?.updated ?? 0;
      if (action === 'set_subscription_eligible' && opts?.subscriptionEligible === false && skipped > 0) {
        setBulkInfo(
          `Updated ${n} product(s). ${skipped} skipped (still in a subscription bundle—remove from bundles first).`
        );
      } else {
        setBulkInfo(`Updated ${n} product(s).`);
      }
      clearSelection();
      await fetchProducts();
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'error' in err
          ? (err as { error?: { message?: string } }).error?.message
          : undefined;
      setError(msg || (err instanceof Error ? err.message : null) || 'Bulk apply failed');
    } finally {
      setBulkBusy(false);
    }
  }

  async function downloadExport() {
    const params = buildListParams();
    params.delete('page');
    params.delete('pageSize');
    const token = await getIdToken();
    const res = await fetch(
      `/api/dashboard/proxy/admin/products/export.csv?${params.toString()}`,
      {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }
    );
    if (!res.ok) {
      setError('Export failed');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'htc-products-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport(file: File, mode: 'dry_run' | 'apply') {
    setImportBusy(true);
    setImportResult(null);
    setError(null);
    try {
      const token = await getIdToken();
      const form = new FormData();
      form.append('file', file);
      form.append('mode', mode);
      const res = await fetch('/api/dashboard/proxy/admin/products/import', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const text = await res.text();
      let json: any;
      try {
        json = JSON.parse(text);
      } catch {
        setImportResult(text.slice(0, 500));
        return;
      }
      if (json?.success) {
        const d = json.data;
        const errLines =
          d.errors?.length > 0
            ? '\n' +
              d.errors
                .slice(0, 12)
                .map((e: { row: number; message: string }) => `Row ${e.row}: ${e.message}`)
                .join('\n')
            : '';
        setImportResult(
          `${d.mode}: ${d.rowsValid} valid rows, ${d.errors?.length || 0} errors${
            d.applied ? ' (applied)' : ''
          }${errLines}`
        );
        if (d.applied) await fetchProducts();
      } else {
        setError(json?.error?.message || 'Import failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Import failed');
    } finally {
      setImportBusy(false);
    }
  }

  const allPageSelected = rows.length > 0 && rows.every((r) => selectedIds.has(r.id));
  const selectedOnPageCount = rows.filter((r) => selectedIds.has(r.id)).length;

  const { sortBy: tableSortBy, sortOrder: tableSortOrder } = tableSortProps(sort);

  const columns = [
    {
      key: '_check',
      header: (
        <input
          type="checkbox"
          checked={allPageSelected}
          onChange={() => {
            if (allPageSelected) {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                for (const r of rows) next.delete(r.id);
                return next;
              });
            } else selectAllOnPage();
          }}
          aria-label="Select page"
        />
      ),
      render: (item: PosProductRow) => (
        <span
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="presentation"
        >
          <input
            type="checkbox"
            checked={selectedIds.has(item.id)}
            onChange={() => toggleSelected(item.id)}
            aria-label={`Select ${item.title}`}
          />
        </span>
      ),
      className: 'w-10',
    },
    {
      key: 'title',
      header: 'Product',
      sortable: true,
      render: (item: PosProductRow) => (
        <div className="min-w-[260px]">
          <div className="font-medium text-gray-900 truncate">{item.title}</div>
          <div className="text-xs text-gray-500">
            SKU: {item.sku || '—'} · Barcode: {item.barcode || '—'}
          </div>
          {Array.isArray(item.collections) && item.collections.length > 0 && (
            <div className="text-xs text-blue-700 truncate mt-0.5">
              {item.collections.map((c) => c.title || c.shopifyCollectionId).join(', ')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'price',
      header: 'Price',
      sortable: true,
      render: (item: PosProductRow) => formatCents(item.price),
      className: 'w-28',
    },
    {
      key: 'inventory',
      header: 'Stock',
      sortable: true,
      render: (item: PosProductRow) => (
        <span className={item.inventory_quantity <= 0 ? 'text-red-600' : 'text-gray-900'}>
          {item.inventory_quantity}
        </span>
      ),
      className: 'w-20',
    },
    {
      key: 'mapping_status',
      header: 'Mapping',
      sortable: true,
      render: (item: PosProductRow) => (
        <div className="flex items-center gap-2 flex-wrap">
          {statusBadge(item.mapping_status)}
          {item.mapping_status === 'confirmed' && typeof item.mapping_confidence === 'number' ? (
            <ConfidencePill score={item.mapping_confidence} />
          ) : null}
          {item.mapping_status !== 'confirmed' &&
          typeof item.top_suggestion_score === 'number' &&
          item.top_suggestion_score != null ? (
            <ConfidencePill score={item.top_suggestion_score} />
          ) : null}
        </div>
      ),
      className: 'w-44',
    },
    {
      key: 'is_hidden',
      header: 'Visible',
      sortable: true,
      render: (item: PosProductRow) =>
        item.is_hidden ? <Badge variant="warning">Hidden</Badge> : <Badge variant="success">Shown</Badge>,
      className: 'w-24',
    },
    {
      key: 'subscription_eligible',
      header: 'Sub',
      render: (item: PosProductRow) =>
        item.subscription_eligible ? (
          <Badge variant="success">Eligible</Badge>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
      className: 'w-24',
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Products</h2>
          <p className="text-sm text-gray-500 mt-1">
            Map Shopify variants to UHTD parts.{' '}
            <Link href="/admin/settings" className="text-blue-600 hover:text-blue-800 underline-offset-2 hover:underline">
              Catalog sync
            </Link>
            {' · '}
            <Link href="/admin/products/categories" className="text-blue-600 hover:text-blue-800 underline-offset-2 hover:underline">
              Collection → category maps
            </Link>
            {' · '}
            <Link href="/admin/products/bundles" className="text-blue-600 hover:text-blue-800 underline-offset-2 hover:underline">
              Subscription bundles
            </Link>
          </p>
        </div>
        <div className="flex justify-end">
          <input
            ref={importPreviewInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            tabIndex={-1}
            disabled={importBusy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void runImport(f, 'dry_run');
            }}
          />
          <input
            ref={importApplyInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            tabIndex={-1}
            disabled={importBusy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f && confirm('Apply CSV changes to Hot Tub Companion fields for this store?')) void runImport(f, 'apply');
            }}
          />
          <Menu as="div" className="relative inline-block text-left">
            <MenuButton
              disabled={importBusy}
              aria-label="Import and export spreadsheet (CSV)"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Import / export
              <ChevronDownIcon className="h-4 w-4 text-gray-600" aria-hidden />
            </MenuButton>
            <MenuItems
              anchor="bottom end"
              modal={false}
              className="z-50 mt-1 w-[min(calc(100vw-2rem),18rem)] rounded-xl border border-gray-200 bg-white py-1 shadow-lg ring-1 ring-black/5 outline-none"
            >
              <MenuSection>
                <MenuHeading className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Export
                </MenuHeading>
                <MenuItem>
                  <button
                    type="button"
                    className="group flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm data-focus:bg-gray-50"
                    onClick={() => void downloadExport()}
                  >
                    <span className="font-medium text-gray-900">Download CSV</span>
                    <span className="text-xs text-gray-500">Rows matching your current filters</span>
                  </button>
                </MenuItem>
              </MenuSection>
              <MenuSeparator className="my-1 h-px bg-gray-100" />
              <MenuSection>
                <MenuHeading className="px-3 pt-1 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Import CSV
                </MenuHeading>
                <MenuItem>
                  <button
                    type="button"
                    className="group flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm data-focus:bg-gray-50"
                    onClick={() => {
                      requestAnimationFrame(() => importPreviewInputRef.current?.click());
                    }}
                  >
                    <span className="font-medium text-gray-900">Preview import</span>
                    <span className="text-xs text-gray-500">Check the file for errors; nothing is saved</span>
                  </button>
                </MenuItem>
                <MenuItem>
                  <button
                    type="button"
                    className="group flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm data-focus:bg-gray-50"
                    onClick={() => {
                      requestAnimationFrame(() => importApplyInputRef.current?.click());
                    }}
                  >
                    <span className="font-medium text-gray-900">Apply import</span>
                    <span className="text-xs text-gray-500">Updates HTC-editable columns after you confirm</span>
                  </button>
                </MenuItem>
              </MenuSection>
            </MenuItems>
          </Menu>
        </div>
      </div>

      {importResult && (
        <div className="mb-4 rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-800 whitespace-pre-wrap">
          {importResult}
        </div>
      )}

      {error && <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>}
      {bulkInfo && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-100 p-4 text-emerald-900 text-sm">{bulkInfo}</div>
      )}

      {/* Always render this strip so selecting checkboxes does not shift the page; empty state matches height/padding */}
      <div
        className={`sticky top-0 z-10 mb-4 rounded-lg border px-4 py-3 text-sm transition-colors ${
          selectedIds.size > 0 || selectionToken
            ? 'border-blue-200 bg-blue-50'
            : 'border-gray-100 bg-gray-50/80'
        }`}
      >
        <div className="mb-3 pb-3 border-b border-gray-200/70">
          <h3 className="text-sm font-semibold text-gray-900">Bulk edit</h3>
          <p className="text-xs text-gray-600 mt-1 leading-relaxed">
            These actions update many products at once. Set your filters below, then click{' '}
            <strong className="font-medium text-gray-800">Select all matching filters</strong> so the bulk buttons apply
            to that full result set (not just the rows checked on this page).
          </p>
        </div>
        {selectedIds.size > 0 || selectionToken ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-gray-800">
              <strong>{selectedIds.size}</strong> checked on this page
              {selectionToken ? (
                <>
                  {' · '}
                  <strong>{selectionCount}</strong> in bulk scope (current filters)
                </>
              ) : null}
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={bulkBusy}
              onClick={() => void bulkApply('set_hidden', { isHidden: true })}
            >
              Hide
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={bulkBusy}
              onClick={() => void bulkApply('set_hidden', { isHidden: false })}
            >
              Show
            </Button>
            <Button size="sm" variant="secondary" disabled={bulkBusy} onClick={() => void bulkApply('clear_mapping')}>
              Clear mapping
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={bulkBusy}
              onClick={() => void bulkApply('set_subscription_eligible', { subscriptionEligible: true })}
            >
              Subscription eligible
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={bulkBusy}
              onClick={() => void bulkApply('set_subscription_eligible', { subscriptionEligible: false })}
            >
              Subscription not eligible
            </Button>
            <Button size="sm" variant="secondary" onClick={clearSelection}>
              Clear selection
            </Button>
          </div>
        ) : (
          <p className="text-gray-500 text-sm leading-snug">
            When you’re ready, use <strong className="font-medium text-gray-700">Select all matching filters</strong>{' '}
            (under the filters) and return here to run bulk actions.
          </p>
        )}
      </div>

      <div className="card rounded-lg p-4 mb-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <div className="text-xs font-medium text-gray-600 mb-1">Search</div>
            <SearchInput value={search} onChange={setSearch} placeholder="Title, SKU, barcode, vendor, type, tags…" />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Collection</div>
            <select
              value={shopifyCollectionId}
              onChange={(e) => setShopifyCollectionId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">All collections</option>
              {collections.map((c) => (
                <option key={c.shopify_collection_id} value={c.shopify_collection_id}>
                  {c.title || c.handle || c.shopify_collection_id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Mapping status</div>
            <select
              value={mappingStatus}
              onChange={(e) => setMappingStatus(e.target.value as MappingStatus | 'all')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">All</option>
              <option value="unmapped">Unmapped</option>
              <option value="auto_suggested">Suggested</option>
              <option value="confirmed">Confirmed</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Vendor contains</div>
            <input
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Product type</div>
            <input
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Stock</div>
            <select
              value={inStock}
              onChange={(e) => setInStock(e.target.value as 'all' | 'true' | 'false')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="all">Any</option>
              <option value="true">In stock</option>
              <option value="false">Out of stock</option>
            </select>
          </div>
          <div>
            <div className="text-xs font-medium text-gray-600 mb-1">Sort</div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="updated_at_desc">Updated (newest)</option>
              <option value="updated_at_asc">Updated (oldest)</option>
              <option value="title_asc">Title A–Z</option>
              <option value="title_desc">Title Z–A</option>
              <option value="price_asc">Price low–high</option>
              <option value="price_desc">Price high–low</option>
              <option value="inventory_desc">Stock high–low</option>
              <option value="inventory_asc">Stock low–high</option>
              <option value="is_hidden_asc">Visibility (shown first)</option>
              <option value="is_hidden_desc">Visibility (hidden first)</option>
              <option value="mapping_status_asc">Mapping status A–Z</option>
              <option value="mapping_status_desc">Mapping status Z–A</option>
              <option value="mapping_confidence_desc">Mapping confidence (high)</option>
              <option value="mapping_confidence_asc">Mapping confidence (low)</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          className="text-sm text-blue-600 hover:text-blue-800"
          onClick={() => setAdvancedOpen((o) => !o)}
        >
          {advancedOpen ? 'Hide advanced filters' : 'Advanced filters'}
        </button>

        {advancedOpen && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-gray-100">
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Visibility</div>
              <select
                value={isHidden}
                onChange={(e) => setIsHidden(e.target.value as 'all' | 'true' | 'false')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                <option value="false">Shown</option>
                <option value="true">Hidden</option>
              </select>
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Price min (cents)</div>
              <input
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                inputMode="numeric"
              />
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Price max (cents)</div>
              <input
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                inputMode="numeric"
              />
            </div>
            <div>
              <div className="text-xs font-medium text-gray-600 mb-1">Tag (exact)</div>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button size="sm" variant="secondary" onClick={selectAllOnPage}>
            Select page ({rows.length})
          </Button>
          <Button size="sm" variant="secondary" loading={bulkBusy} onClick={() => void selectAllMatchingFilter()}>
            Select all matching filters
          </Button>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={showCheckedOnly}
              onChange={(e) => setShowCheckedOnly(e.target.checked)}
            />
            Show checked only ({selectedIds.size})
          </label>
          <span className="text-xs text-gray-500 self-center">
            {selectedOnPageCount} checked on this page
          </span>
        </div>
      </div>

      <Table<PosProductRow>
        columns={columns as any}
        data={rows}
        keyField="id"
        loading={loading}
        emptyMessage="No products found. Run catalog sync from Settings → POS Integration."
        sortBy={tableSortBy}
        sortOrder={tableSortOrder}
        onSort={(key) => {
          const next = toggleSortForColumn(sort, key);
          if (next) setSort(next);
        }}
        onRowClick={(item) => {
          setSelected(item);
          if (item.mapping_status === 'confirmed' && item.uhtd_part_id) {
            setSuggestions([]);
            setSuggestionsLoading(false);
          } else {
            void loadSuggestions(item.id);
          }
        }}
      />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Map Product: ${selected.title}` : 'Map Product'}
        size="xl"
        footer={
          selected ? (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Button
                variant="secondary"
                onClick={() => selected && toggleHidden(selected)}
                loading={actionLoading}
              >
                {selected.is_hidden ? 'Show product' : 'Hide product'}
              </Button>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={clearMapping} loading={actionLoading}>
                  Clear mapping
                </Button>
                <Button onClick={() => setSelected(null)} variant="primary">
                  Close
                </Button>
              </div>
            </div>
          ) : null
        }
      >
        {!selected ? null : (
          <div className="space-y-4">
            {selected.first_image_url ? (
              <div className="rounded-lg overflow-hidden border border-gray-200 max-w-xs">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selected.first_image_url} alt="" className="w-full h-auto object-cover" />
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-gray-500">SKU</div>
                <div className="font-mono">{selected.sku || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Barcode</div>
                <div className="font-mono">{selected.barcode || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Vendor</div>
                <div>{selected.vendor || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Product type</div>
                <div>{selected.product_type || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Price</div>
                <div>{formatCents(selected.price)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Stock</div>
                <div>{selected.inventory_quantity}</div>
              </div>
            </div>
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Subscriptions</h3>
              <p className="text-xs text-gray-600">
                Eligible variants can be sold as individual subscriptions and included in kit bundles (
                <Link href="/admin/products/bundles" className="text-blue-600 hover:underline">
                  Products → Bundles
                </Link>
                ).
              </p>
              {subscriptionActionError ? (
                <p className="text-sm text-red-600" role="alert">
                  {subscriptionActionError}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-700">Status:</span>
                {selected.subscription_eligible ? (
                  <Badge variant="success">Subscription eligible</Badge>
                ) : (
                  <Badge variant="default">Not subscription eligible</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  loading={actionLoading}
                  disabled={Boolean(selected.subscription_eligible)}
                  onClick={() => void setSubscriptionEligibleForRow(selected, true)}
                >
                  Make subscription eligible
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={actionLoading}
                  disabled={!selected.subscription_eligible}
                  onClick={() => void setSubscriptionEligibleForRow(selected, false)}
                >
                  Make subscription not eligible
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                To mark a product not eligible, remove it from all subscription bundles first (otherwise the API will
                reject the change).
              </p>
              {selected.subscription_eligible ? (
                <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 space-y-2">
                  <div className="text-xs text-gray-600">
                    {selected.subscription_stripe_price_id ? (
                      <span>
                        Active Stripe price:{' '}
                        <code className="text-xs bg-white px-1 rounded border">{selected.subscription_stripe_price_id}</code>
                      </span>
                    ) : (
                      <span>No recurring price yet — set amount below (requires Stripe Connect).</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-1">Price (USD)</div>
                      <input
                        className="w-32 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        value={offerDollars}
                        onChange={(e) => setOfferDollars(e.target.value)}
                        placeholder="29.99"
                      />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-gray-600 mb-1">Interval</div>
                      <select
                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        value={offerInterval}
                        onChange={(e) => setOfferInterval(e.target.value as 'month' | 'year')}
                      >
                        <option value="month">Monthly</option>
                        <option value="year">Yearly</option>
                      </select>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={actionLoading}
                      onClick={() => void saveSubscriptionOffer()}
                    >
                      Save subscription price
                    </Button>
                    {selected.subscription_stripe_price_id ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        loading={actionLoading}
                        onClick={() => void clearSubscriptionOffer()}
                      >
                        Clear offer
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {selected.description ? (
              <div className="text-sm">
                <div className="text-xs text-gray-500 mb-1">Description</div>
                <p className="text-gray-800 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {stripHtml(selected.description)}
                </p>
              </div>
            ) : null}
            {Array.isArray(selected.tags) && selected.tags.length > 0 ? (
              <div className="text-sm">
                <div className="text-xs text-gray-500 mb-1">Tags</div>
                <div className="flex flex-wrap gap-1">
                  {selected.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-800 text-xs">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {Array.isArray(selected.collections) && selected.collections.length > 0 ? (
              <div className="text-sm">
                <div className="text-xs text-gray-500 mb-1">Collections</div>
                <ul className="list-disc list-inside text-gray-800">
                  {selected.collections.map((c) => (
                    <li key={c.shopifyCollectionId}>
                      {c.title || c.handle || c.shopifyCollectionId}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {selected.mapping_status === 'confirmed' && selected.uhtd_part_id ? (
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Product mapping</h3>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-sm">
                  <div className="font-medium text-gray-900">
                    {selected.uhtd_part_name || 'Linked UHTD part'}
                  </div>
                  <div className="text-xs text-gray-600 font-mono mt-1">
                    {selected.uhtd_part_number
                      ? `Part #${selected.uhtd_part_number}`
                      : `Part ID ${selected.uhtd_part_id}`}
                  </div>
                  {typeof selected.mapping_confidence === 'number' ? (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-gray-600">Confidence:</span>
                      <ConfidencePill score={selected.mapping_confidence} />
                    </div>
                  ) : null}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Clear mapping below to see UHTD suggestions again.
                </p>
              </div>
            ) : (
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900">UHTD Suggestions</h3>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => selected && loadSuggestions(selected.id)}
                    loading={suggestionsLoading}
                  >
                    Refresh
                  </Button>
                </div>
                {suggestionsLoading ? (
                  <div className="text-sm text-gray-500">Loading suggestions…</div>
                ) : suggestions.length === 0 ? (
                  <div className="text-sm text-gray-500">
                    No suggestions found. Add UHTD parts (PCdb) and try again.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {suggestions.map((s) => (
                      <div
                        key={s.partId}
                        className="flex items-center justify-between border border-gray-200 rounded-lg p-3"
                      >
                        <div>
                          <div className="font-medium text-gray-900">{s.name}</div>
                          <div className="text-xs text-gray-500">
                            {s.partNumber ? `#${s.partNumber}` : '—'} · {s.manufacturer || '—'} · {s.reason} ·{' '}
                            {Math.round(s.score * 100)}%
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() =>
                            confirmMappingTo(s.partId, s.score, {
                              name: s.name,
                              partNumber: s.partNumber,
                            })
                          }
                          loading={actionLoading}
                        >
                          Map
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
