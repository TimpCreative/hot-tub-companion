/**
 * Single source of truth for auto-generated maintenance templates (WC-7a reference + schedule engine).
 */

export type MaintenanceCatalogRecurring = {
  eventType: string;
  intervalDays: number;
  notificationDaysBefore: number;
  linkedProductCategory: string | null;
};

export const MAINTENANCE_EVENT_COPY: Record<string, { title: string; description: string }> = {
  filter_rinse: {
    title: 'Rinse the filter',
    description: 'Quick rinse removes debris and helps flow between deep cleans.',
  },
  filter_deep_clean: {
    title: 'Deep clean the filter',
    description: 'Soak or spray per manufacturer directions to restore filter media.',
  },
  filter_replace: {
    title: 'Replace the filter cartridge',
    description: 'Annual replacement keeps water clear and protects the pump.',
  },
  drain_refill: {
    title: 'Drain and refill',
    description: 'Fresh water resets dissolved solids and improves sanitizer performance.',
  },
  cover_check: {
    title: 'Check the cover',
    description: 'Inspect vinyl, seams, and locks; treat or replace if waterlogged.',
  },
  water_test: {
    title: 'Test your water',
    description: 'Log a water test to keep chemistry in range.',
  },
  winterize: {
    title: 'Winterize the spa',
    description: 'Drain, blow lines, and protect equipment before the off season.',
  },
  spring_startup: {
    title: 'Spring startup',
    description: 'Refill, balance water, and restart circulation after the off season.',
  },
};

export const FILTER_CHAIN_EVENT_TYPES = ['filter_rinse', 'filter_deep_clean', 'filter_replace'] as const;
export type FilterChainEventType = (typeof FILTER_CHAIN_EVENT_TYPES)[number];

export const MAINTENANCE_RECURRING_CATALOG: MaintenanceCatalogRecurring[] = [
  { eventType: 'filter_rinse', intervalDays: 14, notificationDaysBefore: 1, linkedProductCategory: 'filter' },
  { eventType: 'filter_deep_clean', intervalDays: 90, notificationDaysBefore: 3, linkedProductCategory: 'filter' },
  { eventType: 'filter_replace', intervalDays: 365, notificationDaysBefore: 7, linkedProductCategory: 'filter' },
  { eventType: 'drain_refill', intervalDays: 180, notificationDaysBefore: 5, linkedProductCategory: 'chemical' },
  { eventType: 'cover_check', intervalDays: 180, notificationDaysBefore: 3, linkedProductCategory: 'cover' },
  { eventType: 'water_test', intervalDays: 7, notificationDaysBefore: 1, linkedProductCategory: 'chemical' },
];

/** Plain-language seasonal rules for retailer reference UI (WC-7a). */
export const MAINTENANCE_SEASONAL_REFERENCE = {
  title: 'Seasonal winterize / startup',
  description:
    'When winter_strategy is **shutdown** and usage_months exclude a calendar month, the generator adds a **winterize** reminder about **14 days before** that off month begins. When usage resumes after an off month, **spring_startup** is placed about **7 days before** the next in-use month. If winter_strategy is **operate**, these seasonal rows are not generated.',
};

export function buildCareScheduleReferencePayload() {
  return {
    recurring: MAINTENANCE_RECURRING_CATALOG.map((row) => ({
      ...row,
      title: MAINTENANCE_EVENT_COPY[row.eventType]?.title ?? row.eventType,
      description: MAINTENANCE_EVENT_COPY[row.eventType]?.description ?? '',
    })),
    seasonal: MAINTENANCE_SEASONAL_REFERENCE,
    scheduleNote:
      'Recurring tasks (except filter rinse, deep clean, and replace) align to calendar days from the spa registration date. Filter tasks are spaced from each completion and coordinated to reduce clutter.',
  };
}
