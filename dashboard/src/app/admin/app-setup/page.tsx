'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createTenantApiClient } from '@/services/api';
import { Button } from '@/components/ui/Button';

type StepId = 'brand' | 'modelPick' | 'sanitizer';

interface OnboardingConfig {
  version: number;
  allowSkip: boolean;
  steps: { id: StepId; enabled: boolean }[];
}

const STEP_LABELS: Record<StepId, string> = {
  brand: 'Hot tub make (brand)',
  modelPick: 'Model selection (UHTD)',
  sanitizer: 'Sanitizer system',
};

export default function AdminAppSetupPage() {
  const { getIdToken } = useAuth();
  const api = useMemo(() => createTenantApiClient(async () => await getIdToken()), [getIdToken]);

  const [onboarding, setOnboarding] = useState<OnboardingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const body = (await api.get('/admin/settings/app-setup')) as {
          success?: boolean;
          data?: { onboarding?: OnboardingConfig };
        };
        if (!cancelled && body?.data?.onboarding) {
          setOnboarding(body.data.onboarding);
        }
      } catch (e: unknown) {
        const msg =
          e && typeof e === 'object' && 'error' in e
            ? (e as { error?: { message?: string } }).error?.message
            : 'Failed to load app setup';
        if (!cancelled) setError(msg ?? 'Failed to load app setup');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  function toggleStep(id: StepId) {
    setOnboarding((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: prev.steps.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)),
      };
    });
  }

  function setAllowSkip(v: boolean) {
    setOnboarding((prev) => (prev ? { ...prev, allowSkip: v } : prev));
  }

  async function handleSave() {
    if (!onboarding) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body = (await api.put('/admin/settings/app-setup', { onboarding })) as {
        success?: boolean;
        data?: { onboarding?: OnboardingConfig };
        message?: string;
      };
      if (body?.data?.onboarding) {
        setOnboarding(body.data.onboarding);
      }
      setSuccess(body.message ?? 'Saved');
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'error' in e
          ? (e as { error?: { message?: string } }).error?.message
          : 'Failed to save';
      setError(msg ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  if (!onboarding) {
    return <div className="rounded-lg bg-red-50 p-4 text-red-700">{error || 'Could not load app setup.'}</div>;
  }

  return (
    <div className="max-w-2xl">
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">App setup</h2>
      <p className="text-gray-600 mb-6">
        Control onboarding options for the customer mobile app. Model selection always stays on (UHTD link required
        for compatibility).
      </p>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-4 text-red-700">{error}</div>}
      {success && <div className="mb-4 rounded-lg bg-green-50 p-4 text-green-800">{success}</div>}

      <div className="space-y-6 bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm font-medium text-gray-900">Allow skip</div>
            <div className="text-xs text-gray-500">Users can enter the app without finishing hot tub setup (nudged later).</div>
          </div>
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={onboarding.allowSkip}
              onChange={(e) => setAllowSkip(e.target.checked)}
            />
            <span className="ml-2 text-sm text-gray-700">Enabled</span>
          </label>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Onboarding steps</h3>
          <ul className="space-y-3">
            {onboarding.steps.map((step) => (
              <li key={step.id} className="flex items-center justify-between gap-4">
                <span className="text-sm text-gray-800">{STEP_LABELS[step.id]}</span>
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={step.enabled}
                    disabled={step.id === 'modelPick'}
                    onChange={() => toggleStep(step.id)}
                  />
                  <span className="ml-2 text-sm text-gray-700">{step.id === 'modelPick' ? 'Always on' : 'Enabled'}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <Button type="button" loading={saving} onClick={handleSave}>
          Save app setup
        </Button>
      </div>
    </div>
  );
}
