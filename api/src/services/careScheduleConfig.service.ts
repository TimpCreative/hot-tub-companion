import type { MaintenanceCatalogRecurring } from './maintenanceCatalog';
import { MAINTENANCE_RECURRING_CATALOG } from './maintenanceCatalog';

export type CareScheduleEventOverride = {
  enabled?: boolean;
  intervalDays?: number;
  notificationDaysBefore?: number;
};

export type CareScheduleConfigDTO = {
  version: number;
  events: Record<string, CareScheduleEventOverride>;
};

const DEFAULT: CareScheduleConfigDTO = {
  version: 1,
  events: {},
};

export function normalizeCareScheduleConfig(raw: unknown): CareScheduleConfigDTO {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT, events: { ...DEFAULT.events } };
  const r = raw as { version?: unknown; events?: unknown };
  const version = typeof r.version === 'number' && r.version >= 1 ? Math.min(99, Math.trunc(r.version)) : 1;
  const events: Record<string, CareScheduleEventOverride> = {};
  if (r.events && typeof r.events === 'object') {
    for (const [k, v] of Object.entries(r.events as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const o = v as Record<string, unknown>;
      const entry: CareScheduleEventOverride = {};
      if (typeof o.enabled === 'boolean') entry.enabled = o.enabled;
      if (typeof o.intervalDays === 'number' && Number.isFinite(o.intervalDays)) {
        entry.intervalDays = Math.min(730, Math.max(1, Math.trunc(o.intervalDays)));
      }
      if (typeof o.notificationDaysBefore === 'number' && Number.isFinite(o.notificationDaysBefore)) {
        entry.notificationDaysBefore = Math.min(30, Math.max(0, Math.trunc(o.notificationDaysBefore)));
      }
      if (Object.keys(entry).length > 0) events[k.slice(0, 50)] = entry;
    }
  }
  return { version, events };
}

/** Merge order: retailer care_schedule_config → platform catalog defaults (WC-7b). */
export function getEffectiveRecurringCatalog(careSchedule: CareScheduleConfigDTO): MaintenanceCatalogRecurring[] {
  const out: MaintenanceCatalogRecurring[] = [];
  for (const base of MAINTENANCE_RECURRING_CATALOG) {
    const o = careSchedule.events[base.eventType];
    if (o?.enabled === false) continue;
    out.push({
      eventType: base.eventType,
      intervalDays: o?.intervalDays ?? base.intervalDays,
      notificationDaysBefore: o?.notificationDaysBefore ?? base.notificationDaysBefore,
      linkedProductCategory: base.linkedProductCategory,
    });
  }
  return out;
}
