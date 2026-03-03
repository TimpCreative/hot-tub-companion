'use client';

import React, { useEffect, useState } from 'react';

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
}

export interface PartQualifierValue {
  value: unknown;
  isRequired: boolean;
}

interface PartQualifiersInputProps {
  value: Record<string, PartQualifierValue>;
  onChange: (values: Record<string, PartQualifierValue>) => void;
  fetchWithAuth: (url: string, opts?: RequestInit) => Promise<Response>;
}

function getOpts(av: QualifierAllowedValue[] | string[] | null): { value: string; displayName: string }[] {
  if (!av || !Array.isArray(av)) return [];
  return av.map((item) =>
    typeof item === 'string' ? { value: item, displayName: item } : { value: item.value, displayName: item.displayName }
  );
}

export function PartQualifiersInput({ value, onChange, fetchWithAuth }: PartQualifiersInputProps) {
  const [qualifiers, setQualifiers] = useState<Qualifier[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchWithAuth('/api/dashboard/super-admin/qdb/qualifiers')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data.success) return;
        const all = data.data || [];
        setQualifiers(all.filter((q: Qualifier & { appliesTo: string }) => q.appliesTo === 'part' || q.appliesTo === 'both'));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => { cancelled = true; };
  }, [fetchWithAuth]);

  const updateQualifier = (qualifierId: string, val: unknown, isRequired: boolean) => {
    const next = { ...value };
    if (val === undefined || val === null || (Array.isArray(val) && val.length === 0)) {
      delete next[qualifierId];
    } else {
      next[qualifierId] = { value: val, isRequired };
    }
    onChange(next);
  };

  const renderQualifier = (q: Qualifier) => {
    const current = value[q.id];
    const currentVal = current?.value;
    const isReq = current?.isRequired ?? false;

    if (q.dataType === 'boolean') {
      const checked = currentVal === true;
      return (
        <div key={q.id} className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => updateQualifier(q.id, e.target.checked, isReq)}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-sm font-medium text-gray-700">{q.displayName}</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isReq}
              onChange={(e) => updateQualifier(q.id, currentVal ?? false, e.target.checked)}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-xs text-gray-500">Required</span>
          </label>
        </div>
      );
    }

    if (q.dataType === 'enum') {
      const opts = getOpts(q.allowedValues);
      const strVal = String(currentVal ?? '');
      return (
        <div key={q.id} className="flex items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">{q.displayName}</label>
            <select
              value={strVal}
              onChange={(e) => updateQualifier(q.id, e.target.value || undefined, isReq)}
              className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">—</option>
              {opts.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.displayName}</option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer pt-6">
            <input
              type="checkbox"
              checked={isReq}
              onChange={(e) => updateQualifier(q.id, currentVal ?? null, e.target.checked)}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-xs text-gray-500">Required</span>
          </label>
        </div>
      );
    }

    if (q.dataType === 'array') {
      const opts = getOpts(q.allowedValues);
      const selected = (Array.isArray(currentVal) ? currentVal : []) as string[];
      if (opts.length === 0) return null;
      return (
        <div key={q.id} className="flex items-start gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">{q.displayName}</label>
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
                      updateQualifier(q.id, next.length > 0 ? next : undefined, isReq);
                    }}
                    className="rounded border-gray-300 text-blue-600"
                  />
                  <span className="text-sm text-gray-900">{opt.displayName}</span>
                </label>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer pt-6">
            <input
              type="checkbox"
              checked={isReq}
              onChange={(e) => updateQualifier(q.id, currentVal ?? null, e.target.checked)}
              className="rounded border-gray-300 text-blue-600"
            />
            <span className="text-xs text-gray-500">Required</span>
          </label>
        </div>
      );
    }

    return null;
  };

  if (loading) return <div className="text-sm text-gray-500 py-2">Loading qualifiers...</div>;
  if (qualifiers.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-900">Part Qualifier Requirements</h3>
      <p className="text-xs text-gray-500">
        Set qualifier requirements for this part. Required qualifiers must match spa values for compatibility.
      </p>
      <div className="space-y-4">{qualifiers.map(renderQualifier)}</div>
    </div>
  );
}
