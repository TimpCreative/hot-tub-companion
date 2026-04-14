/**
 * Maps public plans (hottubcompanion.com/plans) to internal phases + build status.
 * Keep in sync with plans-phase-matrix.html when marketing table changes.
 *
 * Build status rubric (see PHASE-3-ENGAGEMENT.md):
 * - **shipped** — The feature or tooling is functional and complete for what we sell; incomplete
 *   retailer data (catalog rows, UHTD mapping coverage, metric keys, test kits in Super Admin) does
 *   not block shipped.
 * - **partial** — Meaningful product/engineering scope remains (e.g. subscription fulfillment, campaign
 *   UX, shop links from water-care recs), or an inherently ongoing program (app store per retailer,
 *   pilot QA checklists).
 * - **not_yet** / **ops** — Unchanged.
 */

export type BuildStatus = 'shipped' | 'partial' | 'not_yet' | 'ops';

export interface RoadmapRow {
  feature: string;
  base: string;
  core: string;
  adv: string;
  phase: string;
  status: BuildStatus;
  notes?: string;
}

export interface RoadmapSection {
  title: string;
  rows: RoadmapRow[];
}

/** Full comparison table, grouped like the public site */
export const PLANS_ROADMAP_SECTIONS: RoadmapSection[] = [
  {
    title: 'Branded mobile app',
    rows: [
      {
        feature: 'Custom iOS & Android app',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '2 / 3',
        status: 'shipped',
        notes: 'Shell + EAS multi-tenant; per-retailer store release QA is ongoing ops, not feature gap.',
      },
      {
        feature: 'White-label branding (colors, logo, icon, splash)',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '2',
        status: 'shipped',
        notes: 'Tenant config + ThemeProvider; fonts not per-tenant.',
      },
      {
        feature: 'Modular "My Tub" home screen',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '2',
        status: 'shipped',
        notes: 'Hero + widgets registry.',
      },
      {
        feature: 'Configurable home screen widget order',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '2',
        status: 'shipped',
        notes: 'Retailer Admin home editor.',
      },
    ],
  },
  {
    title: 'Customer experience',
    rows: [
      {
        feature: 'Spa registration (brand, model, year, sanitization)',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '2',
        status: 'shipped',
        notes: 'SCdb search + consumer suggestion queue.',
      },
      {
        feature: 'UHTD compatibility engine (personalized recs)',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '1 / 2 / 3',
        status: 'shipped',
        notes:
          'API + Shop compatibility surfaces shipped; expanding part/catalog coverage is retailer data, not engine completeness.',
      },
      {
        feature: 'Water test logging & history',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'shipped',
        notes:
          'Profile-driven log, Maintenance log history, Super Admin metrics/profiles/kits. Trend charts = polish (see PHASE-3-ENGAGEMENT.md), not blocked by metric key breadth.',
      },
      {
        feature: 'Water care assistant (dosage guidance)',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'partial',
        notes:
          'Dosage recommendations on save shipped. Partial until: recommendation → purchasable product / Add to cart from recs (Part 1); not blocked by dosage rule row count in DB.',
      },
      {
        feature: 'Seasonal maintenance timeline',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'shipped',
        notes:
          'Care schedule, snooze/reschedule, activity/history, dedupe, cron, home widget. UTC calendar v1 shipped; tenant-aware TZ = v1.1 enhancement.',
      },
      {
        feature: 'Multi-spa support (basic)',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'shipped',
        notes:
          'Multiple profiles; Shop persisted active spa selector; Home shows primary spa. Optional Home active switcher = UX polish.',
      },
      {
        feature: 'Multi-spa support (refined UX)',
        base: '—',
        core: '—',
        adv: '✓',
        phase: '6',
        status: 'not_yet',
        notes: 'Household polish.',
      },
      {
        feature: 'New owner onboarding / spa transfer',
        base: '—',
        core: '—',
        adv: '✓',
        phase: '6',
        status: 'not_yet',
      },
    ],
  },
  {
    title: 'Commerce',
    rows: [
      {
        feature: 'Product catalog (Shopify POS sync)',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '1 / 2',
        status: 'shipped',
        notes:
          'Sync + admin + webhooks functional; retailer catalog size is data. Ongoing ops hardening (Milestone 6 / scale) is not “partial feature.”',
      },
      {
        feature: 'In-app Shopify checkout (native sheet)',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'shipped',
        notes: 'Checkout Kit + Storefront cart. Verified Apr 2026 (test checkout in app).',
      },
      {
        feature: 'Product filtering by spa compatibility',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'shipped',
        notes: 'Shop compatible + browse-all + filters shipped.',
      },
      {
        feature: 'Subscription management & auto-delivery',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'partial',
        notes:
          'Apr 2026: Connect + webhooks + handoff checkout + retailer bundle builder + admin RBAC. In-app manage, per-cycle fulfillment, OOS — still open (PHASE-3-ENGAGEMENT.md Part 4).',
      },
      {
        feature: 'Subscription discount engine',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '5',
        status: 'not_yet',
      },
      {
        feature: 'Recommended product bundles',
        base: '—',
        core: '—',
        adv: '✓',
        phase: '3 / 5',
        status: 'partial',
        notes:
          'Apr 2026: Retailer-defined subscription bundles (admin) + default discount; curated “recommended templates” still Phase 5.',
      },
      {
        feature: 'White-label fulfillment (optional add-on)',
        base: '8%',
        core: '12%',
        adv: '15%',
        phase: '6',
        status: 'not_yet',
        notes: 'Royalty + routing; after TAB self-fulfill.',
      },
    ],
  },
  {
    title: 'Service management',
    rows: [
      {
        feature: 'Service request system',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '4',
        status: 'not_yet',
      },
      {
        feature: 'Custom service types (retailer-defined)',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '4',
        status: 'not_yet',
      },
      {
        feature: 'Service status tracking',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '4',
        status: 'not_yet',
      },
      {
        feature: 'Customer service history view',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '4',
        status: 'not_yet',
        notes: 'Explicit marketing line — add detail in Phase 4 doc if missing.',
      },
      {
        feature: 'Service request analytics',
        base: '—',
        core: '—',
        adv: '✓',
        phase: '5 / 6',
        status: 'not_yet',
      },
    ],
  },
  {
    title: 'Communication & notifications',
    rows: [
      {
        feature: 'Basic push notifications (manual)',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '2',
        status: 'shipped',
        notes: 'Admin compose + Expo/FCM.',
      },
      {
        feature: 'Scheduled push campaigns',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '4',
        status: 'partial',
        notes: 'User-local scheduling exists; campaign product Phase 4.',
      },
      {
        feature: 'Urgent banner system',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '4',
        status: 'not_yet',
      },
      {
        feature: 'TimpCreative ↔ Retailer messaging inbox',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '4',
        status: 'not_yet',
      },
      {
        feature: 'Automated push campaigns (trigger-based)',
        base: '—',
        core: '—',
        adv: '✓',
        phase: '6',
        status: 'not_yet',
      },
      {
        feature: 'Customer segmentation & targeted push',
        base: '—',
        core: '—',
        adv: '✓',
        phase: '6',
        status: 'not_yet',
      },
      {
        feature: 'In-app live chat / messaging',
        base: '—',
        core: '—',
        adv: '✓',
        phase: '6',
        status: 'not_yet',
        notes: 'Customer ↔ retailer; not Timp inbox.',
      },
      {
        feature: 'White-label email notifications',
        base: '—',
        core: '—',
        adv: '✓',
        phase: '6',
        status: 'not_yet',
        notes: 'Customer-facing branded email.',
      },
    ],
  },
  {
    title: 'Content',
    rows: [
      {
        feature: 'Universal content library',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'shipped',
        notes: 'Super Admin Content Library is live.',
      },
      {
        feature: 'Content filtered by spa model & system',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'shipped',
        notes:
          'Targeted delivery shipped. Search/ranking refinement is product polish, not missing content rows.',
      },
      {
        feature: 'Retailer-authored custom content',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'shipped',
        notes: 'Retailer content create/edit flows are live.',
      },
      {
        feature: 'Content priority (retailer overrides universal)',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'shipped',
        notes: 'Universal suppression and priority logic are implemented.',
      },
    ],
  },
  {
    title: 'Growth & loyalty',
    rows: [
      {
        feature: 'Referral program with customer codes',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'not_yet',
        notes: 'After checkout; Phase 3 Part 6.',
      },
      {
        feature: 'Loyalty / rewards program',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '5',
        status: 'not_yet',
      },
      {
        feature: 'Points redemption at checkout',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '5',
        status: 'not_yet',
      },
    ],
  },
  {
    title: 'Retailer dashboard',
    rows: [
      {
        feature: 'Admin dashboard (branded subdomain)',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '0 / 2',
        status: 'shipped',
        notes: 'Retailer admin live per tenant; provisioning automation is build-out line item.',
      },
      {
        feature: 'Customer list & spa profiles',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '2+',
        status: 'shipped',
      },
      {
        feature: 'Product visibility controls',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '1 / 2',
        status: 'shipped',
      },
      {
        feature: 'UHTD product mapping tool',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '1 / 2',
        status: 'shipped',
        notes: 'Mapping UX shipped; how many SKUs are mapped is retailer operations, not tool completeness.',
      },
      {
        feature: 'Service request management',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '4',
        status: 'not_yet',
      },
      {
        feature: 'Push notification scheduling',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '4',
        status: 'partial',
        notes: 'Manual send shipped; scheduling UX Phase 4.',
      },
      {
        feature: 'Content management (create/edit)',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'shipped',
        notes: 'Retailer and Super Admin content workflows are live.',
      },
      {
        feature: 'Basic analytics (users, orders, top products)',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '5',
        status: 'not_yet',
        notes: 'Needs order webhooks / references.',
      },
      {
        feature: 'Advanced analytics (segmentation, retention, …)',
        base: '—',
        core: '—',
        adv: '✓',
        phase: '5 / 6',
        status: 'not_yet',
      },
      {
        feature: 'Data export / import',
        base: '—',
        core: '—',
        adv: '✓',
        phase: '6',
        status: 'not_yet',
      },
      {
        feature: 'Branded customer reports',
        base: '—',
        core: '—',
        adv: '✓',
        phase: '6',
        status: 'not_yet',
      },
      {
        feature: 'Retailer API access',
        base: '—',
        core: '—',
        adv: '✓',
        phase: '6',
        status: 'not_yet',
      },
      {
        feature: 'Multi-location support',
        base: '—',
        core: '—',
        adv: '✓',
        phase: '6',
        status: 'not_yet',
      },
    ],
  },
  {
    title: 'Support',
    rows: [
      {
        feature: 'Email support',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '—',
        status: 'ops',
        notes: 'Business process.',
      },
      {
        feature: 'Priority support',
        base: '—',
        core: '✓',
        adv: '✓',
        phase: '—',
        status: 'ops',
        notes: 'Contract / SLA.',
      },
      {
        feature: 'Dedicated onboarding manager',
        base: '—',
        core: '—',
        adv: '✓',
        phase: '—',
        status: 'ops',
        notes: 'People process.',
      },
    ],
  },
];

export interface BuildOutRow {
  item: string;
  phase: string;
  status: BuildStatus;
  notes?: string;
}

export const BUILD_OUT_ITEMS: BuildOutRow[] = [
  {
    item: 'Branded app build (iOS + Android)',
    phase: '2 / 3',
    status: 'shipped',
    notes: 'EAS multi-tenant pipeline shipped; per-build store submission cycles are ops.',
  },
  {
    item: 'App store submission & approval',
    phase: '0 / 2',
    status: 'partial',
    notes: 'Inherently per retailer / per release; never a one-time checkbox.',
  },
  {
    item: 'POS / Shopify connection',
    phase: '1 / 2',
    status: 'shipped',
    notes: 'Super Admin POS + credential exchange + sync path functional.',
  },
  {
    item: 'Product catalog sync',
    phase: '1 / 2',
    status: 'shipped',
    notes: 'Sync mechanism shipped; catalog row count is tenant data.',
  },
  {
    item: 'UHTD product mapping',
    phase: '1 / 2',
    status: 'shipped',
    notes: 'Mapping workflows shipped; coverage is continuous retailer work, not incomplete tooling.',
  },
  { item: 'Branding & white-label config', phase: '2', status: 'shipped' },
  {
    item: 'Admin dashboard provisioning',
    phase: '0 / 2',
    status: 'shipped',
    notes: 'Tenant subdomain + attach path automated; edge DNS/deploy steps may continue per tenant.',
  },
  {
    item: 'QA & soft launch',
    phase: '2 / 3',
    status: 'partial',
    notes: 'Checklist-driven; formal pilot sign-off is ongoing until Milestone 6 evidence.',
  },
];

export const ENTITLEMENTS_EXTRA: BuildOutRow[] = [
  {
    item: 'Water care Super Admin (metrics, profiles, mappings, test kits)',
    phase: '3',
    status: 'shipped',
    notes:
      'Platform for metrics, profiles, kits, and mappings shipped (Apr 2026). Breadth of configured metrics/kits is operational data entry, not partial platform.',
  },
  {
    item: 'saas_plan + preset feature flags (Super Admin entitlements API)',
    phase: 'Infra',
    status: 'shipped',
    notes: 'GET/PUT …/tenants/:id/entitlements; SAAS-PLANS-AND-FEATURES.md',
  },
  {
    item: 'Lightspeed POS (marketing: all plans)',
    phase: '1 / 2',
    status: 'partial',
    notes: 'Shopify path primary for TAB.',
  },
  {
    item: 'Retailer admin: Stripe Connect + subscription bundles + subscription RBAC',
    phase: '3',
    status: 'partial',
    notes: 'Apr 2026: PHASE-3-ENGAGEMENT.md Part 4 §4.15; customer self-service + fulfillment automation still open.',
  },
];
