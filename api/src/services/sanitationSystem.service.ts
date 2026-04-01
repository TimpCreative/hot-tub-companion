import { db } from '../config/database';

export interface SanitationSystemOption {
  value: string;
  displayName: string;
}

const FALLBACK_OPTIONS: SanitationSystemOption[] = [
  { value: 'bromine', displayName: 'Bromine' },
  { value: 'chlorine', displayName: 'Chlorine' },
  { value: 'frog_ease', displayName: 'Frog @Ease' },
  { value: 'copper', displayName: 'Copper' },
  { value: 'silver_mineral', displayName: 'Silver / Mineral stick' },
];

function normalizeOption(option: unknown): SanitationSystemOption | null {
  if (!option) return null;
  if (typeof option === 'string') {
    const value = option.trim();
    return value ? { value, displayName: value.replace(/_/g, ' ') } : null;
  }
  if (typeof option !== 'object') return null;
  const row = option as { value?: unknown; displayName?: unknown };
  const value = typeof row.value === 'string' ? row.value.trim() : '';
  if (!value) return null;
  const displayName =
    typeof row.displayName === 'string' && row.displayName.trim()
      ? row.displayName.trim()
      : value.replace(/_/g, ' ');
  return { value, displayName };
}

export async function getSanitationSystemOptions(includeOther = false): Promise<SanitationSystemOption[]> {
  try {
    const qualifier = await db('qdb_qualifiers')
      .whereIn('name', ['sanitation_system', 'sanitization_system'])
      .orderByRaw(`CASE WHEN name = 'sanitation_system' THEN 0 ELSE 1 END`)
      .first();

    const rawAllowedValues = qualifier?.allowed_values;
    const parsed =
      rawAllowedValues == null
        ? null
        : typeof rawAllowedValues === 'string'
          ? JSON.parse(rawAllowedValues)
          : rawAllowedValues;

    const options = Array.isArray(parsed)
      ? parsed.map(normalizeOption).filter((item): item is SanitationSystemOption => !!item)
      : [];

    const base = options.length > 0 ? options : FALLBACK_OPTIONS;
    if (!includeOther) return base;
    if (base.some((option) => option.value === 'other')) return base;
    return [...base, { value: 'other', displayName: 'Other (describe below)' }];
  } catch {
    if (!includeOther) return FALLBACK_OPTIONS;
    return [...FALLBACK_OPTIONS, { value: 'other', displayName: 'Other (describe below)' }];
  }
}

export async function getSanitationSystemValues(includeOther = false): Promise<string[]> {
  const options = await getSanitationSystemOptions(includeOther);
  return options.map((option) => option.value);
}

export async function isValidSanitationSystem(value: string, includeOther = false): Promise<boolean> {
  const values = await getSanitationSystemValues(includeOther);
  return values.includes(value);
}
