/**
 * Client fallback when API omits homeDashboard (mirrors api homeDashboardConfig.service defaults).
 */
import type { HomeDashboardConfig } from '../contexts/TenantContext';

export const DEFAULT_HOME_DASHBOARD: HomeDashboardConfig = {
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
      props: { title: 'Your Dealership', subtitle: 'We are here to help' },
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
          { title: 'Test water weekly', body: 'For your sanitizer system, test pH and sanitizer levels weekly.' },
          { title: 'Clean filters monthly', body: 'Rinse your filters with a hose every month — we can help!' },
          { title: 'Schedule annual service', body: 'Let certified techs keep your spa running smoothly.' },
        ],
      },
    },
    {
      id: 'product_strip',
      type: 'product_strip',
      enabled: true,
      order: 5,
      props: { title: 'Recommended for You', subtitle: 'Hand-picked for your spa' },
    },
  ],
};
