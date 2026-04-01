/** Labels for spa_profiles.sanitization_system (matches API + tenant config keys). */
export const SANITIZATION_LABELS: Record<string, string> = {
  bromine: 'Bromine',
  chlorine: 'Chlorine',
  frog_ease: 'Frog @Ease',
  copper: 'Copper',
  silver_mineral: 'Silver / Mineral stick',
  other: 'Other (describe below)',
};

export function labelForSanitizer(key: string): string {
  return SANITIZATION_LABELS[key] ?? key.replace(/_/g, ' ');
}

export function labelForSanitationOption(
  key: string,
  options?: Array<{ value: string; displayName: string }>
): string {
  const match = options?.find((option) => option.value === key);
  return match?.displayName ?? labelForSanitizer(key);
}
