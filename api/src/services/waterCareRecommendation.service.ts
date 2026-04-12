import { db } from '../config/database';

export type RecommendationAction = {
  metricKey: string;
  status: 'in_range' | 'low' | 'high';
  suggestedChemical?: string;
  amountOz?: number;
  capped?: boolean;
  messages: string[];
  capfulHint?: string | null;
  safetyNote?: string | null;
};

interface DoseCapRow {
  metric_key: string;
  sanitizer: string;
  max_oz_per_dose: string | number;
  max_oz_per_24h: string | number | null;
}

interface RuleRow {
  metric_key: string;
  sanitizer: string;
  direction: string;
  suggested_chemical: string;
  oz_per_100gal_per_unit: string | number;
  capful_hint: string | null;
  safety_note: string | null;
}

function sanitizerKey(raw: string | null | undefined): string {
  return (raw ?? '').trim();
}

function pickCap(metricKey: string, sanitizer: string | null | undefined, caps: DoseCapRow[]): DoseCapRow | null {
  const s = sanitizerKey(sanitizer);
  const exact = caps.find((c) => c.metric_key === metricKey && c.sanitizer === s);
  if (exact) return exact;
  return caps.find((c) => c.metric_key === metricKey && c.sanitizer === '') ?? null;
}

function pickRule(
  metricKey: string,
  direction: string,
  sanitizer: string | null | undefined,
  rules: RuleRow[]
): RuleRow | null {
  const s = sanitizerKey(sanitizer);
  const exact = rules.find((r) => r.metric_key === metricKey && r.direction === direction && r.sanitizer === s);
  if (exact) return exact;
  return (
    rules.find((r) => r.metric_key === metricKey && r.direction === direction && r.sanitizer === '') ?? null
  );
}

/**
 * v1 linear model: oz = |deltaUnits| * coeff * (volumeGal / 100), clamped by dose_caps.
 * deltaUnits is distance from nearest ideal bound toward the ideal midpoint for "raise"/"lower".
 */
export async function buildRecommendations(input: {
  measurements: Array<{ metricKey: string; value: number }>;
  idealByMetric: Map<string, { min: number; max: number }>;
  volumeGallons: number;
  sanitizer: string | null;
}): Promise<RecommendationAction[]> {
  const caps = (await db('dose_caps').select('*')) as DoseCapRow[];
  const rules = (await db('chemical_rules').select('*')) as RuleRow[];

  const vol = Math.max(50, Math.min(2000, input.volumeGallons > 0 ? input.volumeGallons : 400));
  const out: RecommendationAction[] = [];

  for (const m of input.measurements) {
    const metricKey = m.metricKey.trim().toLowerCase();
    const ideal = input.idealByMetric.get(metricKey);
    if (!ideal) continue;

    const { min: lo, max: hi } = ideal;
    const mid = (lo + hi) / 2;
    let status: RecommendationAction['status'] = 'in_range';
    if (m.value < lo) status = 'low';
    else if (m.value > hi) status = 'high';

    if (status === 'in_range') {
      out.push({ metricKey, status, messages: ['Reading is within the ideal range.'] });
      continue;
    }

    const direction = status === 'low' ? 'raise' : 'lower';
    const rule = pickRule(metricKey, direction, input.sanitizer, rules);
    if (!rule) {
      out.push({
        metricKey,
        status,
        messages: ['No automated recommendation is configured for this reading. Consult your dealer.'],
      });
      continue;
    }

    const coeff = Number(rule.oz_per_100gal_per_unit);
    let deltaUnits = 0;
    if (direction === 'raise') {
      deltaUnits = Math.max(0, mid - m.value);
    } else {
      deltaUnits = Math.max(0, m.value - mid);
    }

    let amountOz = deltaUnits * coeff * (vol / 100);
    const cap = pickCap(metricKey, input.sanitizer, caps);
    let capped = false;
    const messages: string[] = [];

    if (cap && Number.isFinite(Number(cap.max_oz_per_dose))) {
      const maxD = Number(cap.max_oz_per_dose);
      if (amountOz > maxD) {
        amountOz = maxD;
        capped = true;
        messages.push('Amount limited to the configured maximum per dose. Consider a split dose and retest.');
      }
    }

    if (coeff === 0 || deltaUnits === 0) {
      out.push({
        metricKey,
        status,
        suggestedChemical: rule.suggested_chemical,
        messages: [
          rule.safety_note?.trim() ||
            'Follow manufacturer or dealer guidance for this adjustment.',
        ],
        capfulHint: rule.capful_hint,
        safetyNote: rule.safety_note,
      });
      continue;
    }

    messages.push(
      `Approximate starting dose ${amountOz.toFixed(2)} oz for ~${vol} gal (informational only — retest after circulation).`
    );
    if (rule.safety_note?.trim()) messages.push(rule.safety_note.trim());

    out.push({
      metricKey,
      status,
      suggestedChemical: rule.suggested_chemical,
      amountOz: Math.round(amountOz * 1000) / 1000,
      capped,
      messages,
      capfulHint: rule.capful_hint,
      safetyNote: rule.safety_note,
    });
  }

  return out;
}
