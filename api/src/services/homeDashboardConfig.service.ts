/**
 * Home dashboard widget config for the customer mobile app.
 * Types are a fixed catalog; props are validated server-side.
 */

export type HomeWidgetType = 'link_tile' | 'dealer_card' | 'tips_list' | 'product_strip';

export interface HomeWidgetDTO {
  id: string;
  type: HomeWidgetType;
  enabled: boolean;
  order: number;
  props: Record<string, unknown>;
}

export interface HomeDashboardConfigDTO {
  version: number;
  widgets: HomeWidgetDTO[];
}

const ALLOWED_TYPES = new Set<HomeWidgetType>(['link_tile', 'dealer_card', 'tips_list', 'product_strip']);

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

export const DEFAULT_HOME_DASHBOARD_CONFIG: HomeDashboardConfigDTO = {
  version: 1,
  widgets: [
    {
      id: 'tile_messages',
      type: 'link_tile',
      enabled: true,
      order: 0,
      props: {
        title: 'Messages',
        subtitle: 'Stay updated with your retailer',
        iconKey: 'mail',
        targetRoute: '/inbox',
      },
    },
    {
      id: 'tile_water_care',
      type: 'link_tile',
      enabled: true,
      order: 1,
      props: {
        title: 'Water Care',
        subtitle: 'Test water, guides & maintenance log',
        iconKey: 'water',
        targetRoute: '/water-care',
      },
    },
    {
      id: 'tile_shop',
      type: 'link_tile',
      enabled: true,
      order: 2,
      props: {
        title: 'Shop Parts & Chemicals',
        subtitle: 'Curated products for your spa',
        iconKey: 'cart',
        targetRoute: '/shop',
      },
    },
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

function validateLinkTileProps(props: Record<string, unknown>): Record<string, unknown> {
  const title = clampStr(props.title, MAX_TITLE) || 'Link';
  const subtitle = clampStr(props.subtitle, MAX_SUBTITLE);
  const iconKey = clampStr(props.iconKey, 40) || 'ellipse';
  const targetRoute = clampStr(props.targetRoute, 120);
  if (!HOME_DASHBOARD_ALLOWED_ROUTES.has(targetRoute)) {
    return {
      title,
      subtitle,
      iconKey,
      targetRoute: '/shop',
    };
  }
  return { title, subtitle, iconKey, targetRoute };
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
  if (!id || !ALLOWED_TYPES.has(type)) return null;
  const enabled = r.enabled !== false;
  const order = typeof r.order === 'number' && Number.isFinite(r.order) ? Math.floor(r.order) : fallbackOrder;
  let props: Record<string, unknown> =
    r.props && typeof r.props === 'object' ? { ...(r.props as Record<string, unknown>) } : {};

  if (type === 'link_tile') props = validateLinkTileProps(props);
  else if (type === 'dealer_card') props = validateDealerCardProps(props);
  else if (type === 'tips_list') props = validateTipsListProps(props);
  else if (type === 'product_strip') props = validateProductStripProps(props);

  return { id, type, enabled, order, props };
}

export function normalizeHomeDashboardConfig(raw: unknown): HomeDashboardConfigDTO {
  if (!raw || typeof raw !== 'object') {
    return {
      version: DEFAULT_HOME_DASHBOARD_CONFIG.version,
      widgets: DEFAULT_HOME_DASHBOARD_CONFIG.widgets.map((w) => ({
        ...w,
        props: { ...w.props, ...(w.props.items ? { items: [...(w.props.items as unknown[])] } : {}) },
      })),
    };
  }
  const r = raw as Record<string, unknown>;
  const version = typeof r.version === 'number' ? r.version : DEFAULT_HOME_DASHBOARD_CONFIG.version;

  const byId = new Map<string, HomeWidgetDTO>();
  if (Array.isArray(r.widgets)) {
    r.widgets.forEach((w, i) => {
      const nw = normalizeWidget(w, i);
      if (nw) byId.set(nw.id, nw);
    });
  }

  if (byId.size === 0) {
    return normalizeHomeDashboardConfig(null);
  }

  const widgets = Array.from(byId.values()).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  return { version, widgets };
}

export function mergePartialHomeDashboard(
  current: HomeDashboardConfigDTO,
  partial: unknown
): HomeDashboardConfigDTO {
  if (!partial || typeof partial !== 'object') return current;
  const p = partial as Record<string, unknown>;
  const merged = {
    version: typeof p.version === 'number' ? p.version : current.version,
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
