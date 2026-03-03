'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '../ui/Button';
import { ElectricalConfigInput, ElectricalConfig } from './ElectricalConfigInput';

interface QualifierAllowedValue {
  value: string;
  displayName: string;
  brandIds?: string[] | null;
}

interface Qualifier {
  id: string;
  name: string;
  displayName: string;
  dataType: 'boolean' | 'enum' | 'array' | 'number' | 'text';
  allowedValues: QualifierAllowedValue[] | string[] | null;
  isRequired: boolean;
}

interface Section {
  id: string;
  name: string;
  sortOrder: number;
}

interface QualifiersForBrandResponse {
  sections: Section[];
  qualifiersBySection: Record<string, Qualifier[]>;
}

interface SpaQualifiersInputProps {
  brandId: string;
  value: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
}

export function SpaQualifiersInput({ brandId, value, onChange, fetchWithAuth }: SpaQualifiersInputProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [qualifiersBySection, setQualifiersBySection] = useState<Record<string, Qualifier[]>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!brandId) {
      setSections([]);
      setQualifiersBySection({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchWithAuth(`/api/dashboard/super-admin/qdb/qualifiers/for-brand/${brandId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.success) return;
        setSections(data.data?.sections || []);
        setQualifiersBySection(data.data?.qualifiersBySection || {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => { cancelled = true; };
  }, [brandId, fetchWithAuth]);

  const updateQualifier = (qualifierId: string, val: unknown) => {
    const next = { ...value };
    if (val === undefined || val === null || (Array.isArray(val) && val.length === 0)) {
      delete next[qualifierId];
    } else {
      next[qualifierId] = val;
    }
    onChange(next);
  };

  const getOpts = (q: Qualifier): { value: string; displayName: string }[] => {
    if (!q.allowedValues || !Array.isArray(q.allowedValues)) return [];
    return q.allowedValues.map((av) =>
      typeof av === 'string' ? { value: av, displayName: av } : { value: av.value, displayName: av.displayName }
    );
  };

  const renderQualifier = (q: Qualifier) => {
    if (q.name === 'electrical_configs') {
      const configs = (value[q.id] as { voltage: number; voltageUnit?: string; frequencyHz?: number; amperage: string }[]) || [];
      const electricalConfigs: ElectricalConfig[] = configs.map((c) => ({
        voltage: c.voltage ?? '',
        voltageUnit: c.voltageUnit || 'VAC',
        frequencyHz: c.frequencyHz ?? '',
        amperage: c.amperage || '',
      }));
      return (
        <div key={q.id} className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            {q.displayName} {q.isRequired && <span className="text-red-500">*</span>}
          </label>
          <ElectricalConfigInput
            configs={electricalConfigs}
            onChange={(next) => {
              const valid = next.filter((c) => c.voltage && c.amperage);
              const payload = valid.map((c) => ({
                voltage: Number(c.voltage),
                voltageUnit: c.voltageUnit,
                frequencyHz: c.frequencyHz ? Number(c.frequencyHz) : null,
                amperage: String(c.amperage),
              }));
              updateQualifier(q.id, payload.length > 0 ? payload : undefined);
            }}
          />
        </div>
      );
    }

    if (q.name === 'sanitization_systems') {
      const selected = (value[q.id] as string[]) || [];
      const opts = getOpts(q);
      return (
        <div key={q.id}>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {q.displayName} {q.isRequired && <span className="text-red-500">*</span>}
          </label>
          <div className="flex flex-wrap gap-3">
            {opts.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selected, opt.value]
                      : selected.filter((v) => v !== opt.value);
                    updateQualifier(q.id, next.length > 0 ? next : undefined);
                  }}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-900">{opt.displayName}</span>
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (q.dataType === 'enum') {
      const opts = getOpts(q);
      const current = (value[q.id] as string) ?? '';
      return (
        <div key={q.id}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {q.displayName} {q.isRequired && <span className="text-red-500">*</span>}
          </label>
          <select
            value={current}
            onChange={(e) => updateQualifier(q.id, e.target.value || undefined)}
            className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">—</option>
            {opts.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.displayName}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (q.dataType === 'boolean') {
      const current = (value[q.id] as boolean) ?? false;
      return (
        <div key={q.id}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={current}
              onChange={(e) => updateQualifier(q.id, e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-700">{q.displayName}</span>
          </label>
        </div>
      );
    }

    return null;
  };

  if (!brandId) return null;
  if (loading) return <div className="text-sm text-gray-500 py-2">Loading qualifiers...</div>;

  const sectionOrder = [...sections].sort((a, b) => a.sortOrder - b.sortOrder).map((s) => s.id);
  const noneKey = '_none';
  if (qualifiersBySection[noneKey]?.length) sectionOrder.push(noneKey);

  const hasAny = sectionOrder.some((sid) => (qualifiersBySection[sid]?.length ?? 0) > 0);
  if (!hasAny) return null;

  return (
    <div className="space-y-6">
      {sectionOrder.map((sectionId) => {
        const quals = qualifiersBySection[sectionId];
        if (!quals?.length) return null;
        const section = sections.find((s) => s.id === sectionId);
        const title = section?.name ?? 'Other';
        return (
          <div key={sectionId} className="bg-gray-50 p-4 rounded-lg space-y-4">
            <h3 className="font-medium text-gray-900">{title}</h3>
            <div className="space-y-4">{quals.map(renderQualifier)}</div>
          </div>
        );
      })}
    </div>
  );
}
