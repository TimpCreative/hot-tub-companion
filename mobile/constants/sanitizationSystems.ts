/** Labels for spa_profiles.sanitization_system (matches API + tenant config keys). */
export const SANITIZATION_LABELS: Record<string, string> = {
  bromine: 'Bromine',
  chlorine: 'Chlorine',
  frog_ease: 'Frog @Ease',
  copper: 'Copper',
  silver_mineral: 'Silver / Mineral stick',
};

export function labelForSanitizer(key: string): string {
  return SANITIZATION_LABELS[key] ?? key.replace(/_/g, ' ');
}
