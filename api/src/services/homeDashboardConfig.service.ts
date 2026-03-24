/**
 * Home dashboard widget config for the customer mobile app.
 * Quick Links (icon tiles) are separate from Home Dashboard Widgets (dealer_card, tips_list, product_strip).
 */

export type HomeWidgetType = 'dealer_card' | 'tips_list' | 'product_strip';

export interface HomeWidgetDTO {
  id: string;
  type: HomeWidgetType;
  enabled: boolean;
  order: number;
  props: Record<string, unknown>;
}

export interface QuickLinkDTO {
  id: string;
  title: string;
  subtitle?: string;
  iconKey: string;
  targetRoute: string;
  iconColor?: string;
  iconBgColor?: string;
  enabled: boolean;
  order: number;
}

export interface HomeDashboardConfigDTO {
  version: number;
  quickLinks: QuickLinkDTO[];
  quickLinksLayout: 'single' | 'double';
  widgets: HomeWidgetDTO[];
}

const ALLOWED_WIDGET_TYPES = new Set<HomeWidgetType>(['dealer_card', 'tips_list', 'product_strip']);

/** Internal routes allowed for link_tile targetRoute (Expo Router paths). */
export const HOME_DASHBOARD_ALLOWED_ROUTES = new Set<string>([
  '/shop',
  '/water-care',
  '/inbox',
  '/dealer',
  '/services',
  '/onboarding',
]);

const MAX_TITLE = 120;
const MAX_SUBTITLE = 200;
const MAX_BODY = 500;
const MAX_TIPS = 12;

const DEFAULT_QUICK_LINKS: QuickLinkDTO[] = [
  { id: 'tile_messages', title: 'Messages', subtitle: 'Stay updated with your retailer', iconKey: 'mail', targetRoute: '/inbox', enabled: true, order: 0 },
  { id: 'tile_water_care', title: 'Water Care', subtitle: 'Test water, guides & maintenance log', iconKey: 'water', targetRoute: '/water-care', enabled: true, order: 1 },
  { id: 'tile_shop', title: 'Shop Parts & Chemicals', subtitle: 'Curated products for your spa', iconKey: 'cart', targetRoute: '/shop', enabled: true, order: 2 },
  { id: 'tile_dealer', title: 'Dealer', subtitle: 'Contact your dealership', iconKey: 'storefront', targetRoute: '/dealer', enabled: true, order: 3 },
];

function isValidHex(s: unknown): boolean {
  if (typeof s !== 'string') return false;
  return /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/.test(s.trim());
}

function validateQuickLink(raw: unknown, fallbackOrder: number): QuickLinkDTO | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = clampStr(r.id, 64);
  if (!id) return null;
  const title = clampStr(r.title, MAX_TITLE) || 'Link';
  const subtitle = clampStr(r.subtitle, MAX_SUBTITLE);
  const iconKey = clampStr(r.iconKey, 40) || 'ellipse';
  let targetRoute = clampStr(r.targetRoute, 120);
  if (!HOME_DASHBOARD_ALLOWED_ROUTES.has(targetRoute)) targetRoute = '/shop';
  const iconColor = typeof r.iconColor === 'string' && isValidHex(r.iconColor) ? r.iconColor.trim() : undefined;
  const iconBgColor = typeof r.iconBgColor === 'string' && isValidHex(r.iconBgColor) ? r.iconBgColor.trim() : undefined;
  const enabled = r.enabled !== false;
  const order = typeof r.order === 'number' && Number.isFinite(r.order) ? Math.floor(r.order) : fallbackOrder;
  return { id, title, subtitle: subtitle || undefined, iconKey, targetRoute, iconColor, iconBgColor, enabled, order };
}

export const DEFAULT_HOME_DASHBOARD_CONFIG: HomeDashboardConfigDTO = {
  version: 1,
  quickLinks: DEFAULT_QUICK_LINKS.map((q) => ({ ...q })),
  quickLinksLayout: 'single',
  widgets: [
    {
      id: 'dealer_card',
      type: 'dealer_card',
      enabled: true,
      order: 3,
      props: {
        title: 'Your Dealership',
        subtitle: 'We are here to help',
      },
    },
    {
      id: 'tips_experts',
      type: 'tips_list',
      enabled: true,
      order: 4,
      props: {
        title: 'Tips from Our Experts',
        subtitle: 'Recommendations for your spa',
        items: [
          {
            title: 'Test water weekly',
            body: 'For your sanitizer system, test pH and sanitizer levels weekly.',
          },
          {
            title: 'Clean filters monthly',
            body: 'Rinse your filters with a hose every month — we can help!',
          },
          {
            title: 'Schedule annual service',
            body: 'Let certified techs keep your spa running smoothly.',
          },
        ],
      },
    },
    {
      id: 'product_strip',
      type: 'product_strip',
      enabled: true,
      order: 5,
      props: {
        title: 'Recommended for You',
        subtitle: 'Hand-picked for your spa',
      },
    },
  ],
};

function clampStr(s: unknown, max: number): string {
  if (typeof s !== 'string') return '';
  return s.trim().slice(0, max);
}

function validateDealerCardProps(props: Record<string, unknown>): Record<string, unknown> {
  return {
    title: clampStr(props.title, MAX_TITLE) || 'Your Dealership',
    subtitle: clampStr(props.subtitle, MAX_SUBTITLE) || 'We are here to help',
  };
}

function validateTipsListProps(props: Record<string, unknown>): Record<string, unknown> {
  const title = clampStr(props.title, MAX_TITLE) || 'Tips';
  const subtitle = clampStr(props.subtitle, MAX_SUBTITLE);
  const items: { title: string; body: string }[] = [];
  if (Array.isArray(props.items)) {
    for (const row of props.items.slice(0, MAX_TIPS)) {
      if (!row || typeof row !== 'object') continue;
      const t = clampStr((row as { title?: string }).title, MAX_TITLE);
      const b = clampStr((row as { body?: string }).body, MAX_BODY);
      if (t) items.push({ title: t, body: b });
    }
  }
  if (items.length === 0) {
    const fallback = DEFAULT_HOME_DASHBOARD_CONFIG.widgets.find((w) => w.id === 'tips_experts');
    const fallbackItems = (fallback?.props?.items as { title: string; body: string }[]) ?? [];
    return { title, subtitle, items: fallbackItems };
  }
  return { title, subtitle, items };
}

function validateProductStripProps(props: Record<string, unknown>): Record<string, unknown> {
  return {
    title: clampStr(props.title, MAX_TITLE) || 'Recommended for You',
    subtitle: clampStr(props.subtitle, MAX_SUBTITLE),
  };
}

function normalizeWidget(raw: unknown, fallbackOrder: number): HomeWidgetDTO | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = clampStr(r.id, 64);
  const type = r.type as HomeWidgetType;
  if (!id || !ALLOWED_WIDGET_TYPES.has(type)) return null;
  const enabled = r.enabled !== false;
  const order = typeof r.order === 'number' && Number.isFinite(r.order) ? Math.floor(r.order) : fallbackOrder;
  let props: Record<string, unknown> =
    r.props && typeof r.props === 'object' ? { ...(r.props as Record<string, unknown>) } : {};

  if (type === 'dealer_card') props = validateDealerCardProps(props);
  else if (type === 'tips_list') props = validateTipsListProps(props);
  else if (type === 'product_strip') props = validateProductStripProps(props);

  return { id, type, enabled, order, props };
}

function migrateLinkTilesToQuickLinks(widgets: unknown[]): QuickLinkDTO[] {
  const links: QuickLinkDTO[] = [];
  for (const w of widgets) {
    if (!w || typeof w !== 'object') continue;
    const r = w as Record<string, unknown>;
    if (r.type !== 'link_tile') continue;
    const id = clampStr(r.id, 64);
    if (!id) continue;
    const props = r.props && typeof r.props === 'object' ? (r.props as Record<string, unknown>) : {};
    const raw = {
      id,
      title: props.title ?? 'Link',
      subtitle: props.subtitle,
      iconKey: props.iconKey ?? 'ellipse',
      targetRoute: props.targetRoute ?? '/shop',
      enabled: r.enabled !== false,
      order: typeof r.order === 'number' ? r.order : links.length,
    };
    const ql = validateQuickLink(raw, links.length);
    if (ql) links.push(ql);
  }
  return links;
}

export function normalizeHomeDashboardConfig(raw: unknown): HomeDashboardConfigDTO {
  if (!raw || typeof raw !== 'object') {
    return {
      version: DEFAULT_HOME_DASHBOARD_CONFIG.version,
      quickLinks: DEFAULT_QUICK_LINKS.map((q) => ({ ...q })),
      quickLinksLayout: 'single',
      widgets: DEFAULT_HOME_DASHBOARD_CONFIG.widgets.map((w) => ({
        ...w,
        props: { ...w.props, ...(w.props.items ? { items: [...(w.props.items as unknown[])] } : {}) },
      })),
    };
  }
  const r = raw as Record<string, unknown>;
  const version = typeof r.version === 'number' ? r.version : DEFAULT_HOME_DASHBOARD_CONFIG.version;

  // Quick Links: use existing or migrate from link_tile widgets
  let quickLinks: QuickLinkDTO[] = [];
  if (Array.isArray(r.quickLinks) && r.quickLinks.length > 0) {
    const seen = new Set<string>();
    r.quickLinks.forEach((q: unknown, i: number) => {
      const ql = validateQuickLink(q, i);
      if (ql && !seen.has(ql.id)) {
        seen.add(ql.id);
        quickLinks.push(ql);
      }
    });
  }
  if (quickLinks.length === 0 && Array.isArray(r.widgets)) {
    quickLinks = migrateLinkTilesToQuickLinks(r.widgets);
  }
  if (quickLinks.length < 4) {
    const existingIds = new Set(quickLinks.map((q) => q.id));
    for (const def of DEFAULT_QUICK_LINKS) {
      if (!existingIds.has(def.id)) {
        quickLinks.push({ ...def, order: quickLinks.length });
        existingIds.add(def.id);
      }
      if (quickLinks.length >= 4) break;
    }
  }
  quickLinks = quickLinks.slice(0, 4).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const layout = r.quickLinksLayout === 'double' ? 'double' : 'single';

  const byId = new Map<string, HomeWidgetDTO>();
  if (Array.isArray(r.widgets)) {
    r.widgets.forEach((w, i) => {
      const rw = w as Record<string, unknown>;
      if (rw.type === 'link_tile') return; // Exclude link_tile; they live in quickLinks now
      const nw = normalizeWidget(w, i);
      if (nw) byId.set(nw.id, nw);
    });
  }

  let widgets: HomeWidgetDTO[];
  if (byId.size === 0) {
    widgets = DEFAULT_HOME_DASHBOARD_CONFIG.widgets.map((w) => ({
      ...w,
      props: { ...w.props, ...(w.props.items ? { items: [...(w.props.items as unknown[])] } : {}) },
    }));
  } else {
    widgets = Array.from(byId.values()).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  }

  return { version, quickLinks, quickLinksLayout: layout, widgets };
}

export function mergePartialHomeDashboard(
  current: HomeDashboardConfigDTO,
  partial: unknown
): HomeDashboardConfigDTO {
  if (!partial || typeof partial !== 'object') return current;
  const p = partial as Record<string, unknown>;
  const layout =
    p.quickLinksLayout === 'double' ? 'double' : p.quickLinksLayout === 'single' ? 'single' : current.quickLinksLayout;
  const merged = {
    version: typeof p.version === 'number' ? p.version : current.version,
    quickLinks: Array.isArray(p.quickLinks) ? p.quickLinks : current.quickLinks,
    quickLinksLayout: layout,
    widgets: Array.isArray(p.widgets) ? p.widgets : current.widgets,
  };
  return normalizeHomeDashboardConfig(merged);
}

export interface DealerContactDTO {
  phone: string | null;
  address: string | null;
}

export function mapDealerContact(row: {
  public_contact_phone?: string | null;
  public_contact_address?: string | null;
}): DealerContactDTO {
  return {
    phone: row.public_contact_phone?.trim() || null,
    address: row.public_contact_address?.trim() || null,
  };
}
