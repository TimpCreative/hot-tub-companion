/**
 * Maps public plans (hottubcompanion.com/plans) to internal phases + build status.
 * Keep in sync with plans-phase-matrix.html when marketing table changes.
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
        status: 'partial',
        notes: 'Shell + EAS; Android QA in Phase 3.',
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
        status: 'partial',
        notes: 'API ready; Shop UI Phase 3.',
      },
      {
        feature: 'Water test logging & history',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'partial',
        notes:
          'Log tests from profile-driven metrics; list/history in Maintenance log. Super Admin metrics/profiles/kits. Trends/charts and full spec polish still Phase 3.',
      },
      {
        feature: 'Water care assistant (dosage guidance)',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'partial',
        notes:
          'Post-save recommendations (oz / capful hints). Shop product links from recs still open. See PHASE-3-ENGAGEMENT.md Part 1.',
      },
      {
        feature: 'Seasonal maintenance timeline',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'partial',
        notes:
          'Apr 2026+: Care schedule, snooze/reschedule, activity/history, dedupe, cron, home widget. UTC calendar v1; tenant TZ — v1.1.',
      },
      {
        feature: 'Multi-spa support (basic)',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '3',
        status: 'partial',
        notes:
          'Multiple profiles; Shop: persisted active spa selector. Home: primary spa display (active switcher on Home — polish).',
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
        status: 'partial',
        notes: 'Sync + admin; prod hardening Phase 6 ops.',
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
        status: 'partial',
        notes: 'Backend ready; Shop UI Phase 3.',
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
        status: 'partial',
        notes: 'Targeted delivery is live; contextual search/ranking still needs refinement.',
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
        status: 'partial',
      },
      {
        feature: 'Customer list & spa profiles',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '2+',
        status: 'partial',
      },
      {
        feature: 'Product visibility controls',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '1 / 2',
        status: 'partial',
      },
      {
        feature: 'UHTD product mapping tool',
        base: '✓',
        core: '✓',
        adv: '✓',
        phase: '1 / 2',
        status: 'partial',
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
    status: 'partial',
    notes: 'EAS multi-tenant; Android QA Phase 3.',
  },
  {
    item: 'App store submission & approval',
    phase: '0 / 2',
    status: 'partial',
    notes: 'Ongoing per retailer.',
  },
  {
    item: 'POS / Shopify connection',
    phase: '1 / 2',
    status: 'partial',
    notes: 'Super Admin POS + sync.',
  },
  { item: 'Product catalog sync', phase: '1 / 2', status: 'partial' },
  {
    item: 'UHTD product mapping',
    phase: '1 / 2',
    status: 'partial',
    notes: 'Data coverage is continuous.',
  },
  { item: 'Branding & white-label config', phase: '2', status: 'shipped' },
  {
    item: 'Admin dashboard provisioning',
    phase: '0 / 2',
    status: 'partial',
    notes: 'Tenant subdomain + Vercel attach.',
  },
  {
    item: 'QA & soft launch',
    phase: '2 / 3',
    status: 'partial',
    notes: 'See phase verification checklists.',
  },
];

export const ENTITLEMENTS_EXTRA: BuildOutRow[] = [
  {
    item: 'Water care Super Admin (metrics, profiles, mappings, test kits)',
    phase: '3',
    status: 'partial',
    notes:
      'Apr 2026: scale bounds, default ideals, mapping priority UX, kit color scale points; mobile log + recs shipped — PHASE-3-ENGAGEMENT.md.',
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
