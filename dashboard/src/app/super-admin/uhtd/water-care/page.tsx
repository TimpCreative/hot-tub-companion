'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSuperAdminFetch } from '@/hooks/useSuperAdminFetch';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

type ScopeType = 'global' | 'brand' | 'model_line' | 'spa_model';

interface WaterCareMeasurement {
  id?: string;
  metricKey: string;
  label: string;
  unit: string;
  minValue: number;
  maxValue: number;
  sortOrder: number;
  isEnabled: boolean;
}

interface WaterCareProfile {
  id: string;
  name: string;
  description: string | null;
  notes: string | null;
  isActive: boolean;
  measurements: WaterCareMeasurement[];
}

interface WaterCareMapping {
  id: string;
  scopeType: ScopeType;
  scopeId: string | null;
  sanitationSystemValue: string | null;
  profileId: string;
  priority: number;
}

interface OptionRow {
  id: string;
  name: string;
}

const DEFAULT_MEASUREMENT: WaterCareMeasurement = {
  metricKey: '',
  label: '',
  unit: '',
  minValue: 0,
  maxValue: 0,
  sortOrder: 0,
  isEnabled: true,
};

type WaterMetricRow = {
  id: string;
  metricKey: string;
  label: string;
  unit: string;
  defaultMinValue: number;
  defaultMaxValue: number;
};

type KitMetricDetail = {
  id: string;
  metricKey: string;
  sortOrder: number;
  inputMode: string;
  colorScaleJson: unknown;
  helpCopy: string | null;
};

type WaterTestKitRow = {
  id: string;
  slug: string;
  title: string;
  status: string;
  imageUrl?: string | null;
  manufacturer?: string | null;
  effectiveFrom?: string | null;
  reviewStatus?: string | null;
  sourceNotes?: string | null;
  manufacturerDocUrl?: string | null;
  metrics?: KitMetricDetail[];
};

type KitFormMetric = {
  metricKey: string;
  inputMode: 'numeric' | 'color_assist';
  helpCopy: string;
  colorScaleJson: string;
};

type KitFormState = {
  slug: string;
  title: string;
  imageUrl: string;
  manufacturer: string;
  status: 'draft' | 'published';
  effectiveFrom: string;
  reviewStatus: string;
  sourceNotes: string;
  manufacturerDocUrl: string;
  metrics: KitFormMetric[];
};

const DEFAULT_KIT_FORM_METRIC: KitFormMetric = {
  metricKey: '',
  inputMode: 'numeric',
  helpCopy: '',
  colorScaleJson: '',
};

export default function WaterCareAdminPage() {
  const fetchWithAuth = useSuperAdminFetch();
  const [wSection, setWSection] = useState<'profiles' | 'metrics' | 'kits'>('profiles');
  const [profiles, setProfiles] = useState<WaterCareProfile[]>([]);
  const [mappings, setMappings] = useState<WaterCareMapping[]>([]);
  const [waterMetrics, setWaterMetrics] = useState<WaterMetricRow[]>([]);
  const [testKits, setTestKits] = useState<WaterTestKitRow[]>([]);
  const [brands, setBrands] = useState<OptionRow[]>([]);
  const [modelLines, setModelLines] = useState<OptionRow[]>([]);
  const [spas, setSpas] = useState<OptionRow[]>([]);
  const [sanitationOptions, setSanitationOptions] = useState<Array<{ value: string; displayName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<WaterCareProfile | null>(null);
  const [profileForm, setProfileForm] = useState({
    name: '',
    description: '',
    notes: '',
    isActive: true,
    measurements: [{ ...DEFAULT_MEASUREMENT }],
  });

  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<WaterCareMapping | null>(null);
  const [mappingForm, setMappingForm] = useState({
    scopeType: 'global' as ScopeType,
    scopeId: '',
    sanitationSystemValue: '',
    profileId: '',
    priority: 0,
  });

  const [metricAddOpen, setMetricAddOpen] = useState(false);
  const [metricAddForm, setMetricAddForm] = useState({
    metricKey: '',
    label: '',
    unit: '',
    defaultMinValue: 0,
    defaultMaxValue: 0,
  });

  const [kitModalOpen, setKitModalOpen] = useState(false);
  const [editingKitId, setEditingKitId] = useState<string | null>(null);
  const [kitSaving, setKitSaving] = useState(false);
  const [kitForm, setKitForm] = useState<KitFormState>({
    slug: '',
    title: '',
    imageUrl: '',
    manufacturer: '',
    status: 'draft',
    effectiveFrom: '',
    reviewStatus: 'pending',
    sourceNotes: '',
    manufacturerDocUrl: '',
    metrics: [{ ...DEFAULT_KIT_FORM_METRIC }],
  });

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const [profilesRes, mappingsRes, brandsRes, modelLinesRes, spasRes, qualifiersRes, metricsRes, kitsRes] =
        await Promise.all([
          fetchWithAuth('/api/dashboard/super-admin/water-care/profiles'),
          fetchWithAuth('/api/dashboard/super-admin/water-care/mappings'),
          fetchWithAuth('/api/dashboard/super-admin/scdb/brands?page=1&pageSize=500'),
          fetchWithAuth('/api/dashboard/super-admin/scdb/model-lines'),
          fetchWithAuth('/api/dashboard/super-admin/scdb/spa-models?page=1&pageSize=500'),
          fetchWithAuth('/api/dashboard/super-admin/qdb/qualifiers'),
          fetchWithAuth('/api/dashboard/super-admin/water-care/metrics'),
          fetchWithAuth('/api/dashboard/super-admin/water-care/test-kits'),
        ]);

      const [
        profilesData,
        mappingsData,
        brandsData,
        modelLinesData,
        spasData,
        qualifiersData,
        metricsData,
        kitsData,
      ] = await Promise.all([
        profilesRes.json(),
        mappingsRes.json(),
        brandsRes.json(),
        modelLinesRes.json(),
        spasRes.json(),
        qualifiersRes.json(),
        metricsRes.json(),
        kitsRes.json(),
      ]);

      if (profilesData.success) setProfiles(profilesData.data || []);
      if (mappingsData.success) setMappings(mappingsData.data || []);
      if (metricsData.success) setWaterMetrics(metricsData.data || []);
      if (kitsData.success) setTestKits(kitsData.data || []);
      if (brandsData.success) setBrands((brandsData.data || []).map((row: OptionRow) => ({ id: row.id, name: row.name })));
      if (modelLinesData.success) setModelLines((modelLinesData.data || []).map((row: OptionRow) => ({ id: row.id, name: row.name })));
      if (spasData.success) {
        setSpas(
          (spasData.data || []).map((row: { id: string; brandName?: string; modelLineName?: string; name: string; year: number }) => ({
            id: row.id,
            name: `${row.brandName || ''} ${row.modelLineName || ''} ${row.name} ${row.year}`.replace(/\s+/g, ' ').trim(),
          }))
        );
      }
      const sanitationQualifier = (qualifiersData?.data || []).find(
        (qualifier: { name?: string }) =>
          qualifier.name === 'sanitation_system' || qualifier.name === 'sanitization_system'
      );
      setSanitationOptions(
        Array.isArray(sanitationQualifier?.allowedValues)
          ? sanitationQualifier.allowedValues.map((option: { value: string; displayName?: string }) => ({
              value: option.value,
              displayName: option.displayName || option.value,
            }))
          : []
      );
    } catch (err) {
      console.error('Error loading water care admin:', err);
      setError('Failed to load water care data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const sortedLibraryMetrics = useMemo(
    () => [...waterMetrics].sort((a, b) => a.metricKey.localeCompare(b.metricKey)),
    [waterMetrics]
  );

  const metricsByKey = useMemo(() => {
    const map = new Map<string, WaterMetricRow>();
    for (const m of waterMetrics) map.set(m.metricKey, m);
    return map;
  }, [waterMetrics]);

  function openCreateProfile() {
    setEditingProfile(null);
    setProfileForm({
      name: '',
      description: '',
      notes: '',
      isActive: true,
      measurements: [{ ...DEFAULT_MEASUREMENT }],
    });
    setProfileModalOpen(true);
  }

  function openEditProfile(profile: WaterCareProfile) {
    setEditingProfile(profile);
    setProfileForm({
      name: profile.name,
      description: profile.description || '',
      notes: profile.notes || '',
      isActive: profile.isActive,
      measurements: profile.measurements.length > 0 ? profile.measurements : [{ ...DEFAULT_MEASUREMENT }],
    });
    setProfileModalOpen(true);
  }

  function updateMeasurement(index: number, field: keyof WaterCareMeasurement, value: string | number | boolean) {
    const next = [...profileForm.measurements];
    next[index] = { ...next[index], [field]: value };
    setProfileForm({ ...profileForm, measurements: next });
  }

  function addMeasurement() {
    setProfileForm((current) => ({
      ...current,
      measurements: [
        ...current.measurements,
        { ...DEFAULT_MEASUREMENT, sortOrder: current.measurements.length },
      ],
    }));
  }

  function removeMeasurement(index: number) {
    setProfileForm((current) => ({
      ...current,
      measurements: current.measurements.filter((_, measurementIndex) => measurementIndex !== index),
    }));
  }

  function selectProfileMetric(index: number, metricKey: string) {
    setProfileForm((current) => {
      const next = [...current.measurements];
      const prev = next[index];
      const lib = metricsByKey.get(metricKey);
      if (!metricKey) {
        next[index] = { ...prev, metricKey: '', label: '', unit: '' };
      } else if (!lib) {
        next[index] = { ...prev, metricKey };
      } else {
        next[index] = {
          ...prev,
          metricKey: lib.metricKey,
          label: lib.label,
          unit: lib.unit,
          minValue: lib.defaultMinValue,
          maxValue: lib.defaultMaxValue,
        };
      }
      return { ...current, measurements: next };
    });
  }

  async function saveProfile() {
    setError(null);
    const measurements = profileForm.measurements
      .map((measurement, index) => ({
        ...measurement,
        sortOrder: index,
        minValue: Number(measurement.minValue),
        maxValue: Number(measurement.maxValue),
      }))
      .filter((measurement) => measurement.metricKey.trim().length > 0);

    if (measurements.length === 0) {
      setError('Add at least one row and choose a metric from the library for each.');
      return;
    }

    const payload = {
      name: profileForm.name,
      description: profileForm.description || null,
      notes: profileForm.notes || null,
      isActive: profileForm.isActive,
      measurements,
    };

    const url = editingProfile
      ? `/api/dashboard/super-admin/water-care/profiles/${editingProfile.id}`
      : '/api/dashboard/super-admin/water-care/profiles';
    const method = editingProfile ? 'PUT' : 'POST';
    const res = await fetchWithAuth(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setError(data.error?.message || 'Failed to save water care profile');
      return;
    }
    setProfileModalOpen(false);
    await loadAll();
  }

  async function deleteProfile(id: string) {
    if (!confirm('Delete this water care profile?')) return;
    const res = await fetchWithAuth(`/api/dashboard/super-admin/water-care/profiles/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setError(data.error?.message || 'Failed to delete water care profile');
      return;
    }
    await loadAll();
  }

  function openCreateMapping() {
    setEditingMapping(null);
    setMappingForm({
      scopeType: 'global',
      scopeId: '',
      sanitationSystemValue: '',
      profileId: profiles[0]?.id || '',
      priority: 0,
    });
    setMappingModalOpen(true);
  }

  function openEditMapping(mapping: WaterCareMapping) {
    setEditingMapping(mapping);
    setMappingForm({
      scopeType: mapping.scopeType,
      scopeId: mapping.scopeId || '',
      sanitationSystemValue: mapping.sanitationSystemValue || '',
      profileId: mapping.profileId,
      priority: mapping.priority,
    });
    setMappingModalOpen(true);
  }

  const scopeOptions = useMemo(() => {
    if (mappingForm.scopeType === 'brand') return brands;
    if (mappingForm.scopeType === 'model_line') return modelLines;
    if (mappingForm.scopeType === 'spa_model') return spas;
    return [];
  }, [mappingForm.scopeType, brands, modelLines, spas]);

  async function saveMapping() {
    const payload = {
      scopeType: mappingForm.scopeType,
      scopeId: mappingForm.scopeType === 'global' ? null : mappingForm.scopeId || null,
      sanitationSystemValue: mappingForm.sanitationSystemValue || null,
      profileId: mappingForm.profileId,
      priority: Number(mappingForm.priority) || 0,
    };
    const url = editingMapping
      ? `/api/dashboard/super-admin/water-care/mappings/${editingMapping.id}`
      : '/api/dashboard/super-admin/water-care/mappings';
    const method = editingMapping ? 'PUT' : 'POST';
    const res = await fetchWithAuth(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setError(data.error?.message || 'Failed to save water care mapping');
      return;
    }
    setMappingModalOpen(false);
    await loadAll();
  }

  async function deleteMapping(id: string) {
    if (!confirm('Delete this water care mapping?')) return;
    const res = await fetchWithAuth(`/api/dashboard/super-admin/water-care/mappings/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok || !data.success) {
      setError(data.error?.message || 'Failed to delete water care mapping');
      return;
    }
    await loadAll();
  }

  function scopeLabel(mapping: WaterCareMapping) {
    if (mapping.scopeType === 'global') return 'Global';
    const pool = mapping.scopeType === 'brand' ? brands : mapping.scopeType === 'model_line' ? modelLines : spas;
    return pool.find((row) => row.id === mapping.scopeId)?.name || mapping.scopeId || 'Unknown';
  }

  function profileName(profileId: string) {
    return profiles.find((profile) => profile.id === profileId)?.name || profileId;
  }

  async function saveMetric(row: WaterMetricRow) {
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/dashboard/super-admin/water-care/metrics/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: row.label,
          unit: row.unit,
          defaultMinValue: row.defaultMinValue,
          defaultMaxValue: row.defaultMaxValue,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Save failed');
      await loadAll();
    } catch (err) {
      console.error(err);
      setError('Failed to save metric');
    }
  }

  async function deleteKitRow(id: string) {
    if (!confirm('Delete this test kit?')) return;
    setError(null);
    try {
      const res = await fetchWithAuth(`/api/dashboard/super-admin/water-care/test-kits/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) throw new Error(data.error?.message || 'Delete failed');
      await loadAll();
    } catch (err) {
      console.error(err);
      setError('Failed to delete kit');
    }
  }

  function openCreateKit() {
    setEditingKitId(null);
    setKitForm({
      slug: '',
      title: '',
      imageUrl: '',
      manufacturer: '',
      status: 'draft',
      effectiveFrom: '',
      reviewStatus: 'pending',
      sourceNotes: '',
      manufacturerDocUrl: '',
      metrics: [{ ...DEFAULT_KIT_FORM_METRIC }],
    });
    setKitModalOpen(true);
  }

  function openEditKit(kit: WaterTestKitRow) {
    setEditingKitId(kit.id);
    const metrics: KitFormMetric[] =
      kit.metrics && kit.metrics.length > 0
        ? kit.metrics.map((m) => {
            const cs = m.colorScaleJson;
            let colorScaleJson = '';
            if (cs != null && cs !== '') {
              colorScaleJson = typeof cs === 'string' ? cs : JSON.stringify(cs, null, 2);
            }
            return {
              metricKey: m.metricKey,
              inputMode: m.inputMode === 'color_assist' ? 'color_assist' : 'numeric',
              helpCopy: m.helpCopy || '',
              colorScaleJson,
            };
          })
        : [{ ...DEFAULT_KIT_FORM_METRIC }];
    setKitForm({
      slug: kit.slug,
      title: kit.title,
      imageUrl: kit.imageUrl || '',
      manufacturer: kit.manufacturer || '',
      status: kit.status === 'published' ? 'published' : 'draft',
      effectiveFrom: kit.effectiveFrom ? kit.effectiveFrom.slice(0, 10) : '',
      reviewStatus: kit.reviewStatus || 'pending',
      sourceNotes: kit.sourceNotes || '',
      manufacturerDocUrl: kit.manufacturerDocUrl || '',
      metrics,
    });
    setKitModalOpen(true);
  }

  function addKitMetricRow() {
    setKitForm((k) => ({
      ...k,
      metrics: [...k.metrics, { ...DEFAULT_KIT_FORM_METRIC }],
    }));
  }

  function removeKitMetricRow(index: number) {
    setKitForm((k) => ({
      ...k,
      metrics: k.metrics.filter((_, i) => i !== index),
    }));
  }

  function updateKitMetricRow(index: number, patch: Partial<KitFormMetric>) {
    setKitForm((k) => {
      const next = [...k.metrics];
      next[index] = { ...next[index], ...patch };
      return { ...k, metrics: next };
    });
  }

  async function saveKit() {
    setError(null);
    const metricsPayload: Array<{
      metricKey: string;
      sortOrder: number;
      inputMode: 'numeric' | 'color_assist';
      helpCopy: string | null;
      colorScaleJson: unknown;
    }> = [];
    for (let i = 0; i < kitForm.metrics.length; i++) {
      const m = kitForm.metrics[i];
      if (!m.metricKey.trim()) continue;
      const raw = m.colorScaleJson.trim();
      let colorScaleJson: unknown = null;
      if (raw) {
        try {
          colorScaleJson = JSON.parse(raw);
        } catch {
          setError('Color scale JSON is invalid for one of the metrics.');
          return;
        }
      }
      metricsPayload.push({
        metricKey: m.metricKey.trim(),
        sortOrder: metricsPayload.length,
        inputMode: m.inputMode,
        helpCopy: m.helpCopy.trim() || null,
        colorScaleJson,
      });
    }

    if (!kitForm.slug.trim() || !kitForm.title.trim()) {
      setError('Kit slug and title are required.');
      return;
    }

    setKitSaving(true);
    try {
      const body = {
        slug: kitForm.slug.trim(),
        title: kitForm.title.trim(),
        imageUrl: kitForm.imageUrl.trim() || null,
        manufacturer: kitForm.manufacturer.trim() || null,
        status: kitForm.status,
        effectiveFrom: kitForm.effectiveFrom.trim() || null,
        reviewStatus: kitForm.reviewStatus.trim() || null,
        sourceNotes: kitForm.sourceNotes.trim() || null,
        manufacturerDocUrl: kitForm.manufacturerDocUrl.trim() || null,
        metrics: metricsPayload,
      };
      const url = editingKitId
        ? `/api/dashboard/super-admin/water-care/test-kits/${editingKitId}`
        : '/api/dashboard/super-admin/water-care/test-kits';
      const method = editingKitId ? 'PUT' : 'POST';
      const res = await fetchWithAuth(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Failed to save kit');
        return;
      }
      setKitModalOpen(false);
      await loadAll();
    } catch (err) {
      console.error(err);
      setError('Failed to save kit');
    } finally {
      setKitSaving(false);
    }
  }

  async function saveNewLibraryMetric() {
    setError(null);
    try {
      const res = await fetchWithAuth('/api/dashboard/super-admin/water-care/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metricKey: metricAddForm.metricKey.trim(),
          label: metricAddForm.label.trim(),
          unit: metricAddForm.unit.trim(),
          defaultMinValue: Number(metricAddForm.defaultMinValue),
          defaultMaxValue: Number(metricAddForm.defaultMaxValue),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error?.message || 'Failed to create metric');
        return;
      }
      setMetricAddOpen(false);
      setMetricAddForm({ metricKey: '', label: '', unit: '', defaultMinValue: 0, defaultMaxValue: 0 });
      await loadAll();
    } catch (err) {
      console.error(err);
      setError('Failed to create metric');
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading water care…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Water Care</h1>
          <p className="text-sm text-gray-500 mt-1">Profiles, canonical metrics, test kits, and mappings.</p>
        </div>
        <div className="flex gap-2">
          {wSection === 'profiles' ? (
            <>
              <Button variant="secondary" onClick={openCreateMapping}>
                + Add Mapping
              </Button>
              <Button onClick={openCreateProfile}>+ Add Profile</Button>
            </>
          ) : wSection === 'metrics' ? (
            <Button
              onClick={() => {
                setMetricAddForm({ metricKey: '', label: '', unit: '', defaultMinValue: 0, defaultMaxValue: 0 });
                setMetricAddOpen(true);
              }}
            >
              + Add metric
            </Button>
          ) : (
            <Button onClick={openCreateKit}>+ Add kit</Button>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200 pb-2">
        {(['profiles', 'metrics', 'kits'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setWSection(s)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              wSection === s ? 'bg-blue-100 text-blue-800' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {s === 'profiles' ? 'Profiles & mappings' : s === 'metrics' ? 'Metric library' : 'Test kits'}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div> : null}

      {wSection === 'metrics' ? (
        <div className="card rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Canonical metrics</h2>
          <p className="text-sm text-gray-500">Defaults sync into profiles when measurements share the same metric key.</p>
          <div className="overflow-x-auto space-y-4">
            {waterMetrics.map((m) => (
              <div
                key={m.id}
                className="grid gap-2 md:grid-cols-6 items-end border border-gray-100 rounded-lg p-3"
              >
                <div className="text-xs text-gray-500 md:col-span-1 font-mono">{m.metricKey}</div>
                <input
                  className="rounded border border-gray-300 px-2 py-2 text-sm"
                  value={m.label}
                  onChange={(e) =>
                    setWaterMetrics((prev) => prev.map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)))
                  }
                />
                <input
                  className="rounded border border-gray-300 px-2 py-2 text-sm"
                  value={m.unit}
                  onChange={(e) =>
                    setWaterMetrics((prev) => prev.map((x) => (x.id === m.id ? { ...x, unit: e.target.value } : x)))
                  }
                />
                <input
                  type="number"
                  className="rounded border border-gray-300 px-2 py-2 text-sm"
                  value={m.defaultMinValue}
                  onChange={(e) =>
                    setWaterMetrics((prev) =>
                      prev.map((x) => (x.id === m.id ? { ...x, defaultMinValue: Number(e.target.value) } : x))
                    )
                  }
                />
                <input
                  type="number"
                  className="rounded border border-gray-300 px-2 py-2 text-sm"
                  value={m.defaultMaxValue}
                  onChange={(e) =>
                    setWaterMetrics((prev) =>
                      prev.map((x) => (x.id === m.id ? { ...x, defaultMaxValue: Number(e.target.value) } : x))
                    )
                  }
                />
                <Button size="sm" onClick={() => void saveMetric(m)}>
                  Save
                </Button>
              </div>
            ))}
            {waterMetrics.length === 0 ? <div className="text-sm text-gray-500">No metrics yet.</div> : null}
          </div>
        </div>
      ) : null}

      {wSection === 'kits' ? (
        <div className="card rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Water test kits</h2>
          <p className="text-sm text-gray-500">Published kits appear in the mobile picker. Draft kits stay hidden on mobile.</p>
          <div className="space-y-2">
            {testKits.map((k) => (
              <div key={k.id} className="flex items-center justify-between gap-4 rounded-lg border border-gray-200 p-3">
                <div>
                  <div className="font-medium text-gray-900">{k.title}</div>
                  <div className="text-xs text-gray-500 font-mono">
                    {k.slug} · {k.status}
                    {k.metrics?.length != null ? ` · ${k.metrics.length} metric(s)` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEditKit(k)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => void deleteKitRow(k.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {testKits.length === 0 ? <div className="text-sm text-gray-500">No kits yet.</div> : null}
          </div>
        </div>
      ) : null}

      {wSection === 'profiles' ? (
        <>
      <div className="card rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Chemistry Profiles</h2>
          <p className="text-sm text-gray-500">Flexible measurement sets like chlorine, bromine, or saltwater.</p>
        </div>
        <div className="space-y-4">
          {profiles.map((profile) => (
            <div key={profile.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-medium text-gray-900">{profile.name}</div>
                  {profile.description ? <div className="text-sm text-gray-500 mt-1">{profile.description}</div> : null}
                  {profile.notes ? <div className="text-sm text-gray-600 mt-2">{profile.notes}</div> : null}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEditProfile(profile)}>Edit</Button>
                  <Button size="sm" variant="danger" onClick={() => deleteProfile(profile.id)}>Delete</Button>
                </div>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {profile.measurements.map((measurement) => (
                  <div key={`${profile.id}-${measurement.metricKey}`} className="rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                    <div className="font-medium text-gray-900">{measurement.label}</div>
                    <div className="text-gray-600">
                      {measurement.minValue} - {measurement.maxValue} {measurement.unit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {profiles.length === 0 ? <div className="text-sm text-gray-500">No water care profiles yet.</div> : null}
        </div>
      </div>

      <div className="card rounded-lg p-6 space-y-4">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Resolution Mappings</h2>
          <p className="text-sm text-gray-500">Profiles can resolve by scope and optional sanitation system value.</p>
        </div>
        <div className="space-y-3">
          {mappings.map((mapping) => (
            <div key={mapping.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
              <div className="text-sm text-gray-700">
                <span className="font-medium">{mapping.scopeType}</span>
                {' · '}
                <span>{scopeLabel(mapping)}</span>
                {' · '}
                <span>{mapping.sanitationSystemValue || 'Any sanitation system'}</span>
                {' · '}
                <span>{profileName(mapping.profileId)}</span>
                {' · '}
                <span>Priority {mapping.priority}</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => openEditMapping(mapping)}>Edit</Button>
                <Button size="sm" variant="danger" onClick={() => deleteMapping(mapping.id)}>Delete</Button>
              </div>
            </div>
          ))}
          {mappings.length === 0 ? <div className="text-sm text-gray-500">No water care mappings yet.</div> : null}
        </div>
      </div>
        </>
      ) : null}

      <Modal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        title={editingProfile ? 'Edit Water Care Profile' : 'Add Water Care Profile'}
        size="2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              value={profileForm.name}
              onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              value={profileForm.description}
              onChange={(e) => setProfileForm({ ...profileForm, description: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={profileForm.notes}
              onChange={(e) => setProfileForm({ ...profileForm, notes: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
              rows={3}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={profileForm.isActive}
              onChange={(e) => setProfileForm({ ...profileForm, isActive: e.target.checked })}
            />
            Active
          </label>
          {waterMetrics.length === 0 ? (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              Add canonical metrics in the <strong>Metric library</strong> tab before attaching measurements to this profile.
            </div>
          ) : null}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700">Measurements</div>
              <Button type="button" size="sm" variant="secondary" onClick={addMeasurement}>
                + Add Measurement
              </Button>
            </div>
            <p className="text-xs text-gray-500">
              Pick a library metric for each row. Label and unit come from the library; adjust ideal min/max for this profile.
            </p>
            {profileForm.measurements.map((measurement, index) => (
              <div key={`profile-m-${index}`} className="grid gap-3 rounded-lg border border-gray-200 p-3 md:grid-cols-6">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Metric</label>
                  <select
                    value={measurement.metricKey}
                    onChange={(e) => selectProfileMetric(index, e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-2 text-sm font-mono"
                  >
                    <option value="">Select metric…</option>
                    {measurement.metricKey && !metricsByKey.has(measurement.metricKey) ? (
                      <option value={measurement.metricKey}>
                        {measurement.metricKey} (not in library — pick a metric or add it in Metric library)
                      </option>
                    ) : null}
                    {sortedLibraryMetrics.map((m) => (
                      <option key={m.id} value={m.metricKey}>
                        {m.metricKey}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-1">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Label</label>
                  <div className="rounded border border-gray-100 bg-gray-50 px-2 py-2 text-sm text-gray-800">
                    {measurement.label || '—'}
                  </div>
                </div>
                <div className="md:col-span-1">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Unit</label>
                  <div className="rounded border border-gray-100 bg-gray-50 px-2 py-2 text-sm text-gray-800">
                    {measurement.unit || '—'}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Ideal min</label>
                  <input
                    type="number"
                    value={measurement.minValue}
                    onChange={(e) => updateMeasurement(index, 'minValue', Number(e.target.value))}
                    className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Ideal max</label>
                  <input
                    type="number"
                    value={measurement.maxValue}
                    onChange={(e) => updateMeasurement(index, 'maxValue', Number(e.target.value))}
                    className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                  />
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <label className="flex items-center gap-2 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={measurement.isEnabled}
                      onChange={(e) => updateMeasurement(index, 'isEnabled', e.target.checked)}
                    />
                    Enabled
                  </label>
                  <button type="button" className="text-sm text-red-600" onClick={() => removeMeasurement(index)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setProfileModalOpen(false)}>Cancel</Button>
            <Button onClick={saveProfile}>{editingProfile ? 'Save Profile' : 'Create Profile'}</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={mappingModalOpen}
        onClose={() => setMappingModalOpen(false)}
        title={editingMapping ? 'Edit Water Care Mapping' : 'Add Water Care Mapping'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
            <select
              value={mappingForm.scopeType}
              onChange={(e) => setMappingForm({ ...mappingForm, scopeType: e.target.value as ScopeType, scopeId: '' })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="global">Global</option>
              <option value="brand">Brand</option>
              <option value="model_line">Model line</option>
              <option value="spa_model">Spa model</option>
            </select>
          </div>
          {mappingForm.scopeType !== 'global' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target</label>
              <select
                value={mappingForm.scopeId}
                onChange={(e) => setMappingForm({ ...mappingForm, scopeId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                <option value="">Select target</option>
                {scopeOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sanitation System Override</label>
            <select
              value={mappingForm.sanitationSystemValue}
              onChange={(e) => setMappingForm({ ...mappingForm, sanitationSystemValue: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Any sanitation system</option>
              {sanitationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.displayName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Profile</label>
            <select
              value={mappingForm.profileId}
              onChange={(e) => setMappingForm({ ...mappingForm, profileId: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            >
              <option value="">Select profile</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <input
              type="number"
              value={mappingForm.priority}
              onChange={(e) => setMappingForm({ ...mappingForm, priority: Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setMappingModalOpen(false)}>Cancel</Button>
            <Button onClick={saveMapping}>{editingMapping ? 'Save Mapping' : 'Create Mapping'}</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={metricAddOpen}
        onClose={() => setMetricAddOpen(false)}
        title="Add canonical metric"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Metric key</label>
            <input
              value={metricAddForm.metricKey}
              onChange={(e) => setMetricAddForm({ ...metricAddForm, metricKey: e.target.value })}
              placeholder="e.g. ph, free_chlorine"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">Stable identifier; use lowercase with underscores. Must be unique.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Label</label>
            <input
              value={metricAddForm.label}
              onChange={(e) => setMetricAddForm({ ...metricAddForm, label: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Unit</label>
            <input
              value={metricAddForm.unit}
              onChange={(e) => setMetricAddForm({ ...metricAddForm, unit: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Default min</label>
              <input
                type="number"
                value={metricAddForm.defaultMinValue}
                onChange={(e) =>
                  setMetricAddForm({ ...metricAddForm, defaultMinValue: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Default max</label>
              <input
                type="number"
                value={metricAddForm.defaultMaxValue}
                onChange={(e) =>
                  setMetricAddForm({ ...metricAddForm, defaultMaxValue: Number(e.target.value) })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setMetricAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void saveNewLibraryMetric()}>Create metric</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={kitModalOpen}
        onClose={() => setKitModalOpen(false)}
        title={editingKitId ? 'Edit test kit' : 'Add test kit'}
        size="2xl"
      >
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Slug</label>
              <input
                value={kitForm.slug}
                onChange={(e) => setKitForm({ ...kitForm, slug: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Title</label>
              <input
                value={kitForm.title}
                onChange={(e) => setKitForm({ ...kitForm, title: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Image URL</label>
              <input
                value={kitForm.imageUrl}
                onChange={(e) => setKitForm({ ...kitForm, imageUrl: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Manufacturer</label>
              <input
                value={kitForm.manufacturer}
                onChange={(e) => setKitForm({ ...kitForm, manufacturer: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
              <select
                value={kitForm.status}
                onChange={(e) =>
                  setKitForm({ ...kitForm, status: e.target.value === 'published' ? 'published' : 'draft' })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Effective from</label>
              <input
                type="date"
                value={kitForm.effectiveFrom}
                onChange={(e) => setKitForm({ ...kitForm, effectiveFrom: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Review status</label>
              <input
                value={kitForm.reviewStatus}
                onChange={(e) => setKitForm({ ...kitForm, reviewStatus: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Source notes</label>
              <textarea
                value={kitForm.sourceNotes}
                onChange={(e) => setKitForm({ ...kitForm, sourceNotes: e.target.value })}
                rows={2}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700">Manufacturer doc URL</label>
              <input
                value={kitForm.manufacturerDocUrl}
                onChange={(e) => setKitForm({ ...kitForm, manufacturerDocUrl: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="border-t border-gray-200 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm font-medium text-gray-700">Kit metrics</div>
              <Button type="button" size="sm" variant="secondary" onClick={addKitMetricRow}>
                + Add metric row
              </Button>
            </div>
            <p className="mb-3 text-xs text-gray-500">
              Each row maps to a canonical metric. Empty metric rows are ignored on save.
            </p>
            <div className="space-y-3">
              {kitForm.metrics.map((row, index) => (
                <div key={`kit-m-${index}`} className="rounded-lg border border-gray-200 p-3 space-y-2">
                  <div className="grid gap-2 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Metric</label>
                      <select
                        value={row.metricKey}
                        onChange={(e) => updateKitMetricRow(index, { metricKey: e.target.value })}
                        className="w-full rounded border border-gray-300 px-2 py-2 text-sm font-mono"
                      >
                        <option value="">Select…</option>
                        {row.metricKey && !metricsByKey.has(row.metricKey) ? (
                          <option value={row.metricKey}>{row.metricKey} (not in library)</option>
                        ) : null}
                        {sortedLibraryMetrics.map((m) => (
                          <option key={m.id} value={m.metricKey}>
                            {m.metricKey}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Input mode</label>
                      <select
                        value={row.inputMode}
                        onChange={(e) =>
                          updateKitMetricRow(index, {
                            inputMode: e.target.value === 'color_assist' ? 'color_assist' : 'numeric',
                          })
                        }
                        className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                      >
                        <option value="numeric">Numeric</option>
                        <option value="color_assist">Color assist</option>
                      </select>
                    </div>
                    <div className="flex items-end justify-end">
                      <button
                        type="button"
                        className="text-sm text-red-600"
                        onClick={() => removeKitMetricRow(index)}
                      >
                        Remove row
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Help copy</label>
                    <textarea
                      value={row.helpCopy}
                      onChange={(e) => updateKitMetricRow(index, { helpCopy: e.target.value })}
                      rows={2}
                      className="w-full rounded border border-gray-300 px-2 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Color scale JSON (optional)</label>
                    <textarea
                      value={row.colorScaleJson}
                      onChange={(e) => updateKitMetricRow(index, { colorScaleJson: e.target.value })}
                      rows={3}
                      placeholder="{}"
                      className="w-full rounded border border-gray-300 px-2 py-2 font-mono text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
            <Button variant="secondary" onClick={() => setKitModalOpen(false)} disabled={kitSaving}>
              Cancel
            </Button>
            <Button onClick={() => void saveKit()} disabled={kitSaving}>
              {kitSaving ? 'Saving…' : editingKitId ? 'Save kit' : 'Create kit'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
