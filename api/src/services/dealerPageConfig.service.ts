export type DealerActionType = 'call' | 'directions' | 'message' | 'book_service' | 'chat' | 'external_url';
export type DealerActionLayout = 'grid_2x2' | 'single';

export interface DealerActionButtonDTO {
  id: string;
  enabled: boolean;
  label: string;
  iconKey: string;
  actionType: DealerActionType;
  actionValue?: string | null;
  order: number;
}

export interface DealerServiceItemDTO {
  id: string;
  enabled: boolean;
  title: string;
  body: string;
  iconKey: string;
  order: number;
}

export interface DealerLatestItemDTO {
  id: string;
  enabled: boolean;
  title: string;
  body: string;
  accentColor?: string;
  order: number;
}

export interface DealerPageConfigDTO {
  version: number;
  layout: {
    actionButtonsLayout: DealerActionLayout;
  };
  dealerInfo: {
    showName: boolean;
    showAddress: boolean;
    showPhone: boolean;
    showEmail: boolean;
    showHours: boolean;
  };
  actionButtons: DealerActionButtonDTO[];
  servicesBlock: {
    enabled: boolean;
    title: string;
    subtitle?: string;
    items: DealerServiceItemDTO[];
  };
  assistanceBlock: {
    enabled: boolean;
    title: string;
    body: string;
    buttonLabel: string;
    actionType: 'chat' | 'call' | 'external_url';
    actionValue?: string | null;
  };
  latestBlock: {
    enabled: boolean;
    title: string;
    subtitle?: string;
    items: DealerLatestItemDTO[];
  };
}

const MAX_TITLE = 120;
const MAX_SUBTITLE = 200;
const MAX_BODY = 400;
const MAX_BUTTONS = 4;
const MAX_SERVICES = 6;
const MAX_LATEST = 6;
const ALLOWED_ACTION_TYPES = new Set<DealerActionType>([
  'call',
  'directions',
  'message',
  'book_service',
  'chat',
  'external_url',
]);
const ALLOWED_ASSISTANCE_ACTIONS = new Set<DealerPageConfigDTO['assistanceBlock']['actionType']>([
  'chat',
  'call',
  'external_url',
]);

function clampStr(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function isValidHex(value: unknown): boolean {
  return typeof value === 'string' && /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/.test(value.trim());
}

function validUrlOrNull(value: unknown): string | null {
  const trimmed = clampStr(value, 2000);
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function sortByOrder<T extends { order: number; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function normalizeActionButton(raw: unknown, fallback: DealerActionButtonDTO, fallbackOrder: number): DealerActionButtonDTO {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const actionType = ALLOWED_ACTION_TYPES.has(row.actionType as DealerActionType)
    ? (row.actionType as DealerActionType)
    : fallback.actionType;
  const actionValue =
    actionType === 'external_url'
      ? validUrlOrNull(row.actionValue) ?? fallback.actionValue ?? null
      : clampStr(row.actionValue, 2000) || null;

  return {
    id: clampStr(row.id, 64) || fallback.id,
    enabled: row.enabled !== undefined ? row.enabled !== false : fallback.enabled,
    label: clampStr(row.label, 40) || fallback.label,
    iconKey: clampStr(row.iconKey, 40) || fallback.iconKey,
    actionType,
    actionValue,
    order: typeof row.order === 'number' && Number.isFinite(row.order) ? Math.floor(row.order) : fallbackOrder,
  };
}

function normalizeServiceItem(raw: unknown, fallback: DealerServiceItemDTO, fallbackOrder: number): DealerServiceItemDTO {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    id: clampStr(row.id, 64) || fallback.id,
    enabled: row.enabled !== undefined ? row.enabled !== false : fallback.enabled,
    title: clampStr(row.title, MAX_TITLE) || fallback.title,
    body: clampStr(row.body, MAX_BODY) || fallback.body,
    iconKey: clampStr(row.iconKey, 40) || fallback.iconKey,
    order: typeof row.order === 'number' && Number.isFinite(row.order) ? Math.floor(row.order) : fallbackOrder,
  };
}

function normalizeLatestItem(raw: unknown, fallback: DealerLatestItemDTO, fallbackOrder: number): DealerLatestItemDTO {
  const row = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    id: clampStr(row.id, 64) || fallback.id,
    enabled: row.enabled !== undefined ? row.enabled !== false : fallback.enabled,
    title: clampStr(row.title, MAX_TITLE) || fallback.title,
    body: clampStr(row.body, MAX_BODY) || fallback.body,
    accentColor: isValidHex(row.accentColor) ? String(row.accentColor).trim() : fallback.accentColor,
    order: typeof row.order === 'number' && Number.isFinite(row.order) ? Math.floor(row.order) : fallbackOrder,
  };
}

export const DEFAULT_DEALER_PAGE_CONFIG: DealerPageConfigDTO = {
  version: 1,
  layout: {
    actionButtonsLayout: 'grid_2x2',
  },
  dealerInfo: {
    showName: true,
    showAddress: true,
    showPhone: true,
    showEmail: true,
    showHours: true,
  },
  actionButtons: [
    { id: 'call_now', enabled: true, label: 'Call Now', iconKey: 'call-outline', actionType: 'call', actionValue: null, order: 0 },
    { id: 'directions', enabled: true, label: 'Directions', iconKey: 'navigate-outline', actionType: 'directions', actionValue: null, order: 1 },
    { id: 'message', enabled: true, label: 'Message', iconKey: 'chatbubble-outline', actionType: 'message', actionValue: null, order: 2 },
    { id: 'book_service', enabled: true, label: 'Book Service', iconKey: 'calendar-outline', actionType: 'book_service', actionValue: null, order: 3 },
  ],
  servicesBlock: {
    enabled: true,
    title: 'Services We Offer',
    subtitle: 'Everything you need for your hot tub',
    items: [
      { id: 'water_testing', enabled: true, title: 'Water Testing', body: 'Free in-store water analysis', iconKey: 'water-outline', order: 0 },
      { id: 'repairs_service', enabled: true, title: 'Repairs & Service', body: 'Professional maintenance', iconKey: 'build-outline', order: 1 },
      { id: 'parts_accessories', enabled: true, title: 'Parts & Accessories', body: 'Genuine OEM parts in stock', iconKey: 'construct-outline', order: 2 },
      { id: 'consultation', enabled: true, title: 'Consultation', body: 'Expert advice and support', iconKey: 'chatbubble-ellipses-outline', order: 3 },
    ],
  },
  assistanceBlock: {
    enabled: true,
    title: 'Need Assistance?',
    body: 'Our team is ready to help with your hot tub questions and service needs.',
    buttonLabel: 'Start a Conversation',
    actionType: 'chat',
    actionValue: null,
  },
  latestBlock: {
    enabled: true,
    title: 'Latest from Your Dealer',
    subtitle: 'Updates and tips for your hot tub',
    items: [
      { id: 'latest_1', enabled: true, title: 'Spring Service Special', body: 'Schedule your seasonal maintenance and save 10%.', accentColor: '#0ea5e9', order: 0 },
      { id: 'latest_2', enabled: true, title: 'Filter Sale This Month', body: '20% off all replacement filters while supplies last.', accentColor: '#2563eb', order: 1 },
      { id: 'latest_3', enabled: true, title: 'New Water Care Products', body: 'Stop by to see our newest chemicals and accessories.', accentColor: '#14b8a6', order: 2 },
    ],
  },
};

export function normalizeDealerPageConfig(raw: unknown): DealerPageConfigDTO {
  const defaults = DEFAULT_DEALER_PAGE_CONFIG;
  if (!raw || typeof raw !== 'object') {
    return {
      ...defaults,
      layout: { ...defaults.layout },
      dealerInfo: { ...defaults.dealerInfo },
      actionButtons: defaults.actionButtons.map((button) => ({ ...button })),
      servicesBlock: { ...defaults.servicesBlock, items: defaults.servicesBlock.items.map((item) => ({ ...item })) },
      assistanceBlock: { ...defaults.assistanceBlock },
      latestBlock: { ...defaults.latestBlock, items: defaults.latestBlock.items.map((item) => ({ ...item })) },
    };
  }

  const record = raw as Record<string, unknown>;
  const layoutRecord = record.layout && typeof record.layout === 'object' ? (record.layout as Record<string, unknown>) : {};
  const dealerInfoRecord =
    record.dealerInfo && typeof record.dealerInfo === 'object' ? (record.dealerInfo as Record<string, unknown>) : {};
  const servicesBlockRecord =
    record.servicesBlock && typeof record.servicesBlock === 'object'
      ? (record.servicesBlock as Record<string, unknown>)
      : {};
  const assistanceBlockRecord =
    record.assistanceBlock && typeof record.assistanceBlock === 'object'
      ? (record.assistanceBlock as Record<string, unknown>)
      : {};
  const latestBlockRecord =
    record.latestBlock && typeof record.latestBlock === 'object' ? (record.latestBlock as Record<string, unknown>) : {};

  const actionButtons = defaults.actionButtons.map((button, index) =>
    normalizeActionButton(
      Array.isArray(record.actionButtons)
        ? record.actionButtons.find((row) => row && typeof row === 'object' && clampStr((row as Record<string, unknown>).id, 64) === button.id)
        : null,
      button,
      index
    )
  );

  const servicesItems = defaults.servicesBlock.items.map((item, index) =>
    normalizeServiceItem(
      Array.isArray(servicesBlockRecord.items)
        ? servicesBlockRecord.items.find((row) => row && typeof row === 'object' && clampStr((row as Record<string, unknown>).id, 64) === item.id)
        : null,
      item,
      index
    )
  );

  let latestItems = Array.isArray(latestBlockRecord.items)
    ? latestBlockRecord.items
        .slice(0, MAX_LATEST)
        .map((row, index) => normalizeLatestItem(row, defaults.latestBlock.items[index] ?? defaults.latestBlock.items[0], index))
    : [];
  if (latestItems.length === 0) {
    latestItems = defaults.latestBlock.items.map((item) => ({ ...item }));
  }

  return {
    version: typeof record.version === 'number' ? record.version : defaults.version,
    layout: {
      actionButtonsLayout: layoutRecord.actionButtonsLayout === 'single' ? 'single' : defaults.layout.actionButtonsLayout,
    },
    dealerInfo: {
      showName: dealerInfoRecord.showName !== undefined ? dealerInfoRecord.showName !== false : defaults.dealerInfo.showName,
      showAddress: dealerInfoRecord.showAddress !== undefined ? dealerInfoRecord.showAddress !== false : defaults.dealerInfo.showAddress,
      showPhone: dealerInfoRecord.showPhone !== undefined ? dealerInfoRecord.showPhone !== false : defaults.dealerInfo.showPhone,
      showEmail: dealerInfoRecord.showEmail !== undefined ? dealerInfoRecord.showEmail !== false : defaults.dealerInfo.showEmail,
      showHours: dealerInfoRecord.showHours !== undefined ? dealerInfoRecord.showHours !== false : defaults.dealerInfo.showHours,
    },
    actionButtons: sortByOrder(actionButtons).slice(0, MAX_BUTTONS),
    servicesBlock: {
      enabled: servicesBlockRecord.enabled !== undefined ? servicesBlockRecord.enabled !== false : defaults.servicesBlock.enabled,
      title: clampStr(servicesBlockRecord.title, MAX_TITLE) || defaults.servicesBlock.title,
      subtitle: clampStr(servicesBlockRecord.subtitle, MAX_SUBTITLE) || defaults.servicesBlock.subtitle,
      items: sortByOrder(servicesItems).slice(0, MAX_SERVICES),
    },
    assistanceBlock: {
      enabled:
        assistanceBlockRecord.enabled !== undefined ? assistanceBlockRecord.enabled !== false : defaults.assistanceBlock.enabled,
      title: clampStr(assistanceBlockRecord.title, MAX_TITLE) || defaults.assistanceBlock.title,
      body: clampStr(assistanceBlockRecord.body, MAX_BODY) || defaults.assistanceBlock.body,
      buttonLabel: clampStr(assistanceBlockRecord.buttonLabel, 40) || defaults.assistanceBlock.buttonLabel,
      actionType: ALLOWED_ASSISTANCE_ACTIONS.has(assistanceBlockRecord.actionType as DealerPageConfigDTO['assistanceBlock']['actionType'])
        ? (assistanceBlockRecord.actionType as DealerPageConfigDTO['assistanceBlock']['actionType'])
        : defaults.assistanceBlock.actionType,
      actionValue:
        assistanceBlockRecord.actionType === 'external_url'
          ? validUrlOrNull(assistanceBlockRecord.actionValue)
          : clampStr(assistanceBlockRecord.actionValue, 2000) || null,
    },
    latestBlock: {
      enabled: latestBlockRecord.enabled !== undefined ? latestBlockRecord.enabled !== false : defaults.latestBlock.enabled,
      title: clampStr(latestBlockRecord.title, MAX_TITLE) || defaults.latestBlock.title,
      subtitle: clampStr(latestBlockRecord.subtitle, MAX_SUBTITLE) || defaults.latestBlock.subtitle,
      items: sortByOrder(latestItems).slice(0, MAX_LATEST),
    },
  };
}
