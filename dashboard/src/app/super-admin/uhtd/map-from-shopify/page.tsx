'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { Button } from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { Pagination } from '@/components/ui/Pagination';
import { PartForm, type PartFormData } from '@/components/uhtd/PartForm';
import type { PartQualifierValue } from '@/components/uhtd/PartQualifiersInput';

const REJECT_REASONS = [
  { value: 'non_spa_category', label: 'Non-spa category' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'other', label: 'Other' },
] as const;

const LINK_SEARCH_FIELDS: { value: string; label: string; hint: string }[] = [
  { value: 'all', label: 'All fields', hint: 'Name, numbers, UPC/EAN, manufacturer, notes, UUID' },
  { value: 'id', label: 'Part ID (UUID)', hint: 'Exact database id' },
  { value: 'name', label: 'Part name', hint: 'Contains match + fuzzy (pg_trgm)' },
  { value: 'part_number', label: 'Part # / aliases', hint: 'Part number or sku_aliases array' },
  { value: 'manufacturer', label: 'Manufacturer', hint: 'Brand name contains' },
  { value: 'identifiers', label: 'UPC · EAN · Mfg SKU', hint: 'Exact barcode or SKU-style ids' },
  { value: 'notes', label: 'Notes / description', hint: 'Internal notes text + fuzzy' },
];

type InboxRow = {
  id: string;
  tenant_id: string;
  title: string;
  sku: string | null;
  barcode: string | null;
  mapping_status: string;
  uhtd_part_id: string | null;
  last_synced_at: string | null;
  updated_at: string;
  uhtd_import_needs_reverify_at: string | null;
  pos_product_id: string;
  pos_variant_id: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  topSuggestionScore: number | null;
};

type Suggestion = {
  partId: string;
  name: string;
  partNumber: string | null;
  manufacturer: string | null;
  score: number;
  reason: string;
};

type TenantOpt = { id: string; name: string; slug: string | null };

type PcdbSearchHit = {
  id: string;
  name: string;
  partNumber?: string | null;
  manufacturer?: string | null;
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function posProductToPartInitial(p: Record<string, unknown>): Partial<PartFormData> {
  const desc = p.description;
  let notes = '';
  if (typeof desc === 'string' && desc) {
    notes = stripHtml(desc).slice(0, 8000);
  }
  return {
    name: String(p.title ?? ''),
    manufacturer: p.vendor ? String(p.vendor) : '',
    partNumber: p.sku ? String(p.sku) : '',
    upc: p.barcode ? String(p.barcode) : '',
    notes,
    dataSource: 'Map from Shopify',
  };
}

function partFormToCreatePayload(fd: PartFormData) {
  const aliases = fd.skuAliases
    ? fd.skuAliases
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  return {
    categoryId: fd.categoryId,
    partNumber: fd.partNumber?.trim() || undefined,
    manufacturerSku: fd.manufacturerSku?.trim() || undefined,
    upc: fd.upc?.trim() || undefined,
    ean: fd.ean?.trim() || undefined,
    skuAliases: aliases.length ? aliases : undefined,
    name: fd.name,
    manufacturer: fd.manufacturer?.trim() || undefined,
    isOem: fd.isOem,
    isUniversal: fd.isUniversal,
    isDiscontinued: fd.isDiscontinued,
    displayImportance: fd.displayImportance,
    imageUrl: fd.imageUrl?.trim() || undefined,
    specSheetUrl: fd.specSheetUrl?.trim() || undefined,
    notes: fd.notes?.trim() || undefined,
    dataSource: fd.dataSource?.trim() || undefined,
  };
}

export default function MapFromShopifyPage() {
  const fetchWithAuth = useSuperAdminFetch();
  const [tenants, setTenants] = useState<TenantOpt[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [search, setSearch] = useState('');
  const [needsReverifyOnly, setNeedsReverifyOnly] = useState(false);
  const [includeConfirmed, setIncludeConfirmed] = useState(false);
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [product, setProduct] = useState<Record<string, unknown> | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [actionError, setActionError] = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState<string>(REJECT_REASONS[0].value);
  const [rejectNote, setRejectNote] = useState('');
  const [linkPartId, setLinkPartId] = useState('');
  const [linkPickLabel, setLinkPickLabel] = useState('');
  const [linkSearchField, setLinkSearchField] = useState('all');
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  const [linkSearchResults, setLinkSearchResults] = useState<PcdbSearchHit[]>([]);
  const [linkSearchLoading, setLinkSearchLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalKey, setCreateModalKey] = useState(0);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setActionError('');
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (tenantId) params.set('tenantId', tenantId);
      if (search.trim()) params.set('search', search.trim());
      if (needsReverifyOnly) params.set('needsReverify', 'true');
      if (includeConfirmed) params.set('includeConfirmed', 'true');

      const res = await fetchWithAuth(
        `/api/dashboard/super-admin/uhtd/shopify-map/inbox?${params.toString()}`
      );
      const data = await res.json();
      if (!data.success) {
        setActionError(data.error?.message || 'Failed to load inbox');
        setRows([]);
        setTotal(0);
        return;
      }
      setRows(data.data?.rows || []);
      setTotal(data.data?.pagination?.total ?? 0);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to load');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth, page, pageSize, tenantId, search, needsReverifyOnly, includeConfirmed]);

  useEffect(() => {
    fetchInbox();
  }, [fetchInbox]);

  useEffect(() => {
    async function loadTenants() {
      try {
        const res = await fetchWithAuth('/api/dashboard/super-admin/tenants');
        const data = await res.json();
        const list = data.data?.tenants;
        if (data.success && Array.isArray(list)) {
          setTenants(
            list.map((t: { id: string; name: string; slug?: string }) => ({
              id: t.id,
              name: t.name,
              slug: t.slug ?? null,
            }))
          );
        }
      } catch {
        /* ignore */
      }
    }
    loadTenants();
  }, [fetchWithAuth]);

  useEffect(() => {
    const q = linkSearchQuery.trim();
    if (!q) {
      setLinkSearchResults([]);
      setLinkSearchLoading(false);
      return;
    }
    const handle = window.setTimeout(async () => {
      setLinkSearchLoading(true);
      try {
        const params = new URLSearchParams({
          q,
          field: linkSearchField,
          limit: '35',
        });
        const res = await fetchWithAuth(
          `/api/dashboard/super-admin/pcdb/parts/search?${params.toString()}`
        );
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setLinkSearchResults(data.data as PcdbSearchHit[]);
        } else {
          setLinkSearchResults([]);
        }
      } catch {
        setLinkSearchResults([]);
      } finally {
        setLinkSearchLoading(false);
      }
    }, 320);
    return () => window.clearTimeout(handle);
  }, [linkSearchQuery, linkSearchField, fetchWithAuth]);

  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetailLoading(true);
    setProduct(null);
    setSuggestions([]);
    setLinkPartId('');
    setLinkPickLabel('');
    setLinkSearchQuery('');
    setLinkSearchResults([]);
    setLinkSearchField('all');
    setRejectOpen(false);
    setActionError('');
    try {
      const res = await fetchWithAuth(`/api/dashboard/super-admin/uhtd/shopify-map/inbox/${id}`);
      const data = await res.json();
      if (!data.success) {
        setActionError(data.error?.message || 'Failed to load row');
        return;
      }
      setProduct(data.data?.product || null);
      setSuggestions(data.data?.suggestions || []);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Failed to load row');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailId(null);
    setProduct(null);
    setSuggestions([]);
    setCreateModalOpen(false);
  };

  const openCreateModal = () => {
    setCreateModalKey((k) => k + 1);
    setCreateModalOpen(true);
  };

  const handleReject = async () => {
    if (!detailId) return;
    setActionBusy(true);
    setActionError('');
    try {
      const res = await fetchWithAuth(
        `/api/dashboard/super-admin/uhtd/shopify-map/inbox/${detailId}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reasonCode: rejectReason, note: rejectNote || undefined }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error?.message || 'Reject failed');
        return;
      }
      setRejectOpen(false);
      closeDetail();
      fetchInbox();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setActionBusy(false);
    }
  };

  const pickLinkPart = (hit: PcdbSearchHit) => {
    setLinkPartId(hit.id);
    const pn = hit.partNumber ? ` · #${hit.partNumber}` : '';
    setLinkPickLabel(`${hit.name}${pn}`);
  };

  const handlePublishLink = async () => {
    if (!detailId || !linkPartId.trim()) {
      setActionError('Search and select a part to link, or pick a suggestion above.');
      return;
    }
    const sug = suggestions.find((s) => s.partId === linkPartId.trim());
    setActionBusy(true);
    setActionError('');
    try {
      const res = await fetchWithAuth(
        `/api/dashboard/super-admin/uhtd/shopify-map/inbox/${detailId}/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'link',
            uhtdPartId: linkPartId.trim(),
            mappingConfidence: sug?.score,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error?.message || 'Publish failed');
        return;
      }
      closeDetail();
      fetchInbox();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Publish failed');
    } finally {
      setActionBusy(false);
    }
  };

  const handleFullCreateSubmit = async (
    formData: PartFormData,
    spaIds: string[],
    qualifierValues?: Record<string, PartQualifierValue>
  ) => {
    if (!detailId) return;
    setActionBusy(true);
    setActionError('');
    try {
      const part = partFormToCreatePayload(formData);
      const res = await fetchWithAuth(
        `/api/dashboard/super-admin/uhtd/shopify-map/inbox/${detailId}/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'create',
            mappingConfidence: suggestions[0]?.score,
            part,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error?.message || 'Create failed');
        return;
      }
      const partId = data.data?.partId as string | undefined;
      if (!partId) {
        setActionError('Part created but response missing part id');
        return;
      }

      if (spaIds.length > 0 && !formData.isUniversal) {
        await fetchWithAuth('/api/dashboard/super-admin/comps/compatibility/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partId,
            spaModelIds: spaIds,
            status: 'pending',
          }),
        });
      }

      if (qualifierValues && Object.keys(qualifierValues).length > 0) {
        for (const [qualifierId, { value, isRequired }] of Object.entries(qualifierValues)) {
          await fetchWithAuth(`/api/dashboard/super-admin/qdb/part-qualifiers/${partId}/${qualifierId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value, isRequired }),
          });
        }
      }

      setCreateModalOpen(false);
      closeDetail();
      fetchInbox();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setActionBusy(false);
    }
  };

  const handleSendReview = async () => {
    if (!detailId) return;
    setActionBusy(true);
    setActionError('');
    try {
      const res = await fetchWithAuth(
        `/api/dashboard/super-admin/uhtd/shopify-map/inbox/${detailId}/send-review`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            draftPayload: {
              note: 'Sent from Map from Shopify inbox',
              shopifyTitle: product?.title,
            },
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error?.message || 'Send failed');
        return;
      }
      closeDetail();
      fetchInbox();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Send failed');
    } finally {
      setActionBusy(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedIds.length === 0) return;
    const reason = window.prompt(
      'Reason code: non_spa_category, duplicate, or other',
      'other'
    ) as string | null;
    if (!reason || !['non_spa_category', 'duplicate', 'other'].includes(reason)) {
      setActionError('Invalid reason code.');
      return;
    }
    const note = window.prompt('Optional note') || undefined;
    setActionBusy(true);
    setActionError('');
    try {
      const res = await fetchWithAuth('/api/dashboard/super-admin/uhtd/shopify-map/bulk-reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posProductIds: selectedIds, reasonCode: reason, note }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error?.message || 'Bulk reject failed');
        return;
      }
      setSelectedIds([]);
      fetchInbox();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Bulk reject failed');
    } finally {
      setActionBusy(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const selectAllOnPage = () => {
    if (selectedIds.length === rows.length && rows.length > 0) setSelectedIds([]);
    else setSelectedIds(rows.map((r) => r.id));
  };

  const fieldHint = LINK_SEARCH_FIELDS.find((f) => f.value === linkSearchField)?.hint ?? '';

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Map from Shopify</h1>
        <p className="text-sm text-gray-500 mt-1">
          Triage Shopify catalog rows across retailers: link or create PCdb parts, reject with a reason, or
          send to the review queue. Confirmed mappings appear for retailers without extra mapping work.
        </p>
        <p className="text-sm mt-2">
          <Link href="/super-admin/uhtd/review-queue" className="text-blue-600 hover:text-blue-800 font-medium">
            Open Review Queue → Shopify part imports tab
          </Link>
        </p>
      </div>

      {actionError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {actionError}
        </div>
      )}

      <div className="card rounded-lg p-4 mb-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Retailer</label>
            <select
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[200px]"
              value={tenantId}
              onChange={(e) => {
                setTenantId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Shopify tenants</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
            <input
              type="search"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              placeholder="Title, SKU, barcode, Shopify product id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (setPage(1), fetchInbox())}
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setPage(1);
              fetchInbox();
            }}
          >
            Apply filters
          </Button>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={needsReverifyOnly}
            onChange={(e) => {
              setNeedsReverifyOnly(e.target.checked);
              setPage(1);
            }}
          />
          Listing changed (needs reverify)
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={includeConfirmed}
            onChange={(e) => {
              setIncludeConfirmed(e.target.checked);
              setPage(1);
            }}
          />
          Include confirmed mappings
        </label>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="text-sm text-amber-900">{selectedIds.length} selected</span>
          <Button size="sm" variant="secondary" loading={actionBusy} onClick={handleBulkReject}>
            Bulk reject…
          </Button>
        </div>
      )}

      <div className="card rounded-lg overflow-hidden">
        <Table
          columns={[
            {
              key: 'sel',
              header: (
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={rows.length > 0 && selectedIds.length === rows.length}
                  onChange={selectAllOnPage}
                />
              ),
              className: 'w-10',
              render: (r: InboxRow) => (
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={selectedIds.includes(r.id)}
                  onChange={() => toggleSelect(r.id)}
                />
              ),
            },
            {
              key: 'tenant',
              header: 'Retailer',
              render: (r: InboxRow) => (
                <span className="text-sm text-gray-800">{r.tenant_name || r.tenant_slug || '—'}</span>
              ),
            },
            {
              key: 'title',
              header: 'Product',
              render: (r: InboxRow) => (
                <div>
                  <button
                    type="button"
                    className="text-left font-medium text-blue-600 hover:text-blue-800"
                    onClick={() => openDetail(r.id)}
                  >
                    {r.title}
                  </button>
                  <div className="text-xs text-gray-500">
                    SKU {r.sku || '—'} · Barcode {r.barcode || '—'}
                  </div>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Map',
              render: (r: InboxRow) => (
                <div className="text-sm">
                  <span className="text-gray-700">{r.mapping_status}</span>
                  {r.uhtd_import_needs_reverify_at && (
                    <span className="ml-2 text-xs font-medium text-amber-700">Reverify</span>
                  )}
                  {r.topSuggestionScore != null && (
                    <div className="text-xs text-gray-500">Top score {(r.topSuggestionScore * 100).toFixed(0)}%</div>
                  )}
                </div>
              ),
            },
            {
              key: 'sync',
              header: 'Synced',
              render: (r: InboxRow) => (
                <span className="text-xs text-gray-500">
                  {r.last_synced_at ? new Date(r.last_synced_at).toLocaleString() : '—'}
                </span>
              ),
            },
          ]}
          data={rows}
          keyField="id"
          loading={loading}
          emptyMessage="No rows in the inbox. Try another retailer, include confirmed, or sync Shopify catalog."
        />
        {total > 0 && (
          <div className="p-4 border-t border-gray-100">
            <Pagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={setPage}
              onPageSizeChange={(s) => {
                setPageSize(s);
                setPage(1);
              }}
            />
          </div>
        )}
      </div>

      {detailId && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/30"
          role="dialog"
          aria-modal="true"
          onClick={closeDetail}
        >
          <div
            className="w-full max-w-lg h-full bg-white shadow-xl overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Map row</h2>
              <button type="button" className="text-gray-500 hover:text-gray-800" onClick={closeDetail}>
                ✕
              </button>
            </div>

            {detailLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : product ? (
              <div className="space-y-4">
                <div className="text-sm text-gray-800">
                  <div className="font-medium">{String(product.title ?? '')}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Variant {String(product.pos_variant_id ?? '—')} · Shopify product {String(product.pos_product_id ?? '')}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Suggestions</h3>
                  {suggestions.length === 0 ? (
                    <p className="text-xs text-gray-500">No automatic suggestions.</p>
                  ) : (
                    <ul className="space-y-2 max-h-48 overflow-y-auto">
                      {suggestions.map((s) => (
                        <li key={s.partId}>
                          <button
                            type="button"
                            className="w-full text-left rounded-lg border border-gray-200 px-3 py-2 hover:bg-gray-50"
                            onClick={() => {
                              setLinkPartId(s.partId);
                              const pn = s.partNumber ? ` · #${s.partNumber}` : '';
                              setLinkPickLabel(`${s.name}${pn}`);
                            }}
                          >
                            <div className="text-sm font-medium text-gray-900">{s.name}</div>
                            <div className="text-xs text-gray-500">
                              {(s.score * 100).toFixed(0)}% · {s.reason}
                              {s.partNumber ? ` · #${s.partNumber}` : ''}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <h3 className="text-sm font-medium text-gray-900">Link existing part</h3>
                  <p className="text-xs text-gray-500">
                    Search PCdb by field type, then pick a row. Same engine as super-admin part search (includes
                    fuzzy name when using Name or All fields).
                  </p>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-gray-600">Search in</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                      value={linkSearchField}
                      onChange={(e) => setLinkSearchField(e.target.value)}
                    >
                      {LINK_SEARCH_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-400">{fieldHint}</p>
                  </div>
                  <input
                    type="search"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Type to search…"
                    value={linkSearchQuery}
                    onChange={(e) => setLinkSearchQuery(e.target.value)}
                  />
                  {linkSearchLoading ? (
                    <p className="text-xs text-gray-500">Searching…</p>
                  ) : linkSearchQuery.trim() ? (
                    <ul className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
                      {linkSearchResults.length === 0 ? (
                        <li className="px-3 py-2 text-xs text-gray-500">No matches</li>
                      ) : (
                        linkSearchResults.map((hit) => (
                          <li key={hit.id}>
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                              onClick={() => pickLinkPart(hit)}
                            >
                              <span className="font-medium text-gray-900">{hit.name}</span>
                              {hit.partNumber ? (
                                <span className="text-gray-500"> · #{hit.partNumber}</span>
                              ) : null}
                              {hit.manufacturer ? (
                                <span className="text-xs text-gray-500 block">{hit.manufacturer}</span>
                              ) : null}
                              <span className="text-[10px] text-gray-400 font-mono block truncate">{hit.id}</span>
                            </button>
                          </li>
                        ))
                      )}
                    </ul>
                  ) : null}
                  {linkPartId ? (
                    <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-sm">
                      <div className="text-blue-900 font-medium">Selected</div>
                      <div className="text-blue-800">{linkPickLabel || linkPartId}</div>
                      <div className="text-xs text-blue-700/80 font-mono break-all">{linkPartId}</div>
                      <button
                        type="button"
                        className="text-xs text-blue-600 underline mt-1"
                        onClick={() => {
                          setLinkPartId('');
                          setLinkPickLabel('');
                        }}
                      >
                        Clear selection
                      </button>
                    </div>
                  ) : null}
                  <Button size="sm" loading={actionBusy} onClick={handlePublishLink}>
                    Save &amp; Publish (link)
                  </Button>
                </div>

                <div className="border-t border-gray-100 pt-4 space-y-3">
                  <h3 className="text-sm font-medium text-gray-900">Create new part</h3>
                  <p className="text-xs text-gray-500">
                    Opens the same full form as Add Part: all fields, spa compatibility, comp sidebar, qualifiers.
                  </p>
                  <Button size="sm" variant="secondary" onClick={openCreateModal}>
                    Open full create form…
                  </Button>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <Button size="sm" variant="secondary" loading={actionBusy} onClick={handleSendReview}>
                    Send for review
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    Queues without confirming the mapping. Resolve from Review Queue → Shopify part imports.
                  </p>
                </div>

                <div className="border-t border-gray-100 pt-4 space-y-2">
                  {!rejectOpen ? (
                    <>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setRejectOpen(true)}
                        title="Exclude this variant from the mapping inbox with a tracked reason"
                      >
                        Reject…
                      </Button>
                      <p className="text-xs text-gray-500 leading-relaxed pr-1">
                        Rejecting marks this Shopify variant as intentionally unmapped (for example: not spa-related,
                        duplicate listing, or other). It leaves the retailer catalog as-is but hides the row from this
                        inbox and from super-admin triage until you change data in the database. Use a reason code so
                        the team knows why it was skipped.
                      </p>
                    </>
                  ) : (
                    <div className="w-full space-y-2 rounded-lg border border-gray-200 p-3">
                      <select
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      >
                        {REJECT_REASONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <textarea
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
                        rows={2}
                        placeholder="Optional note"
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setRejectOpen(false)}>
                          Cancel
                        </Button>
                        <Button size="sm" loading={actionBusy} onClick={handleReject}>
                          Confirm reject
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Could not load row.</p>
            )}
          </div>
        </div>
      )}

      {createModalOpen && detailId && product ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 md:p-8"
          role="dialog"
          aria-modal="true"
          onClick={() => !actionBusy && setCreateModalOpen(false)}
        >
          <div
            className="relative w-full max-w-[1600px] rounded-xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Create part &amp; map to Shopify</h2>
                <p className="text-sm text-gray-500">
                  Same workflow as{' '}
                  <Link href="/super-admin/uhtd/parts/new" className="text-blue-600 hover:underline">
                    Add Part
                  </Link>
                  — submit publishes the mapping when the part is created.
                </p>
              </div>
              <Button variant="secondary" disabled={actionBusy} onClick={() => setCreateModalOpen(false)}>
                Close
              </Button>
            </div>
            <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-6 py-6">
              <PartForm
                key={createModalKey}
                initialData={posProductToPartInitial(product)}
                onSubmit={handleFullCreateSubmit}
                submitLabel="Save & publish mapping"
                loading={actionBusy}
                formClassName="pb-8"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
