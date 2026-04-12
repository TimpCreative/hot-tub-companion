import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { env, getDashboardHostname, isVercelDomainAttachConfigured } from '../config/environment';
import * as vercelProjectDomains from '../services/vercelProjectDomains.service';
import { getFirebaseAuth, isFirebaseInitialized, getFirebaseInitError, getFirebaseKeyDebugInfo } from '../config/firebase';
import { toProxyUrl } from '../utils/mediaUrl';
import sgMail from '@sendgrid/mail';
import {
  getPreset,
  isSaasPlanPreset,
  SAAS_PLAN_PRESETS,
  type SaasPlanPreset,
  type TenantFeatureRow,
} from '../services/saasPlanPresets.service';
import {
  buildPosSecretInsert,
  getTenantPosSummary,
  testTenantPosConnection as testTenantPosConnectionService,
  updateTenantPosConfig as updateTenantPosConfigService,
} from '../services/tenantPosConfig.service';
import { ensureCanonicalShopifyStoreDomain } from '../services/shopifyAuth.service';
import { reconcileShopifyCatalogWebhooks } from '../services/shopifyWebhooks.service';
import {
  listPosIntegrationActivity,
  logPosIntegrationActivity,
} from '../services/posIntegrationActivity.service';

// Initialize SendGrid if API key is available
if (env.SENDGRID_API_KEY) {
  sgMail.setApiKey(env.SENDGRID_API_KEY);
}

/**
 * Helper: Check if email is in whitelist (env var OR database)
 */
async function isEmailWhitelisted(email: string): Promise<{ allowed: boolean; source: 'env' | 'db' | null }> {
  const emailLower = email.toLowerCase().trim();
  
  // Check env var first
  const inEnv = env.SUPER_ADMIN_EMAILS.some(
    (allowed) => allowed.toLowerCase() === emailLower
  );
  if (inEnv) {
    return { allowed: true, source: 'env' };
  }
  
  // Check database whitelist
  try {
    const dbEntry = await db('super_admin_whitelist')
      .whereRaw('LOWER(email) = ?', [emailLower])
      .first();
    if (dbEntry) {
      return { allowed: true, source: 'db' };
    }
  } catch (err) {
    // Table might not exist yet during migration
    console.warn('Could not check super_admin_whitelist table:', err);
  }
  
  return { allowed: false, source: null };
}

/**
 * Helper: Get all whitelisted emails (env + database)
 */
async function getAllWhitelistedEmails(): Promise<Array<{ email: string; source: 'env' | 'db'; invitedAt?: string }>> {
  const emails: Array<{ email: string; source: 'env' | 'db'; invitedAt?: string }> = [];
  
  // Add env var emails
  for (const email of env.SUPER_ADMIN_EMAILS) {
    emails.push({ email: email.toLowerCase(), source: 'env' });
  }
  
  // Add database whitelist emails
  try {
    const dbEmails = await db('super_admin_whitelist').select('email', 'invited_at');
    for (const row of dbEmails) {
      const emailLower = row.email.toLowerCase();
      // Don't duplicate if already in env
      if (!emails.some(e => e.email === emailLower)) {
        emails.push({ email: emailLower, source: 'db', invitedAt: row.invited_at });
      }
    }
  } catch (err) {
    console.warn('Could not fetch super_admin_whitelist:', err);
  }
  
  return emails;
}

/**
 * Check if an email is allowed to sign up as a super admin
 * This endpoint is public (no auth required)
 */
export async function checkEmailAllowed(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email?: string };

  if (!email) {
    error(res, 'VALIDATION_ERROR', 'Email is required', 400);
    return;
  }

  const result = await isEmailWhitelisted(email);
  success(res, { allowed: result.allowed });
}

/**
 * Register a new super admin user
 * Only allows registration if email is in whitelist (env var or database)
 * This endpoint is public (no auth required)
 */
export async function registerSuperAdmin(req: Request, res: Response): Promise<void> {
  const { email, password, displayName } = req.body as {
    email?: string;
    password?: string;
    displayName?: string;
  };

  if (!email || !password) {
    error(res, 'VALIDATION_ERROR', 'Email and password are required', 400);
    return;
  }

  if (password.length < 8) {
    error(res, 'VALIDATION_ERROR', 'Password must be at least 8 characters', 400);
    return;
  }

  const emailLower = email.toLowerCase().trim();
  const whitelist = await isEmailWhitelisted(emailLower);

  if (!whitelist.allowed) {
    error(res, 'FORBIDDEN', 'This email is not authorized for super admin access. Contact your administrator.', 403);
    return;
  }

  try {
    const auth = getFirebaseAuth();

    // Check if user already exists in Firebase
    try {
      const existingUser = await auth.getUserByEmail(emailLower);
      if (existingUser) {
        error(res, 'CONFLICT', 'An account with this email already exists. Please sign in instead.', 409);
        return;
      }
    } catch (err: any) {
      // auth/user-not-found is expected when user doesn't exist
      if (err.code !== 'auth/user-not-found') {
        throw err;
      }
    }

    // Create the Firebase user
    const firebaseUser = await auth.createUser({
      email: emailLower,
      password,
      displayName: displayName || undefined,
    });

    success(res, {
      message: 'Super admin account created successfully. You can now sign in.',
      uid: firebaseUser.uid,
    });
  } catch (err: any) {
    console.error('Error creating super admin:', err);
    if (err.code === 'auth/email-already-exists') {
      error(res, 'CONFLICT', 'An account with this email already exists', 409);
    } else if (err.code === 'auth/invalid-email') {
      error(res, 'VALIDATION_ERROR', 'Invalid email format', 400);
    } else if (err.code === 'auth/weak-password') {
      error(res, 'VALIDATION_ERROR', 'Password is too weak', 400);
    } else {
      error(res, 'INTERNAL_ERROR', 'Failed to create account', 500);
    }
  }
}

const RESERVED_TENANT_SLUGS = new Set(['admin', 'www', 'hottubcompanion', 'api']);

function maskStripeConnectAccountId(id: unknown): string | null {
  if (id == null || typeof id !== 'string' || !id.trim()) return null;
  const s = id.trim();
  if (s.length <= 10) return '****';
  return `…${s.slice(-6)}`;
}

export async function listTenants(_req: Request, res: Response): Promise<void> {
  const tenants = await db('tenants').select('*').orderBy('name');
  const formatted = tenants.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    apiKey: t.api_key,
    primaryColor: t.primary_color,
    secondaryColor: t.secondary_color,
    accentColor: t.accent_color,
    fontFamily: t.font_family,
    logoUrl: toProxyUrl(t.logo_url) ?? t.logo_url,
    iconUrl: toProxyUrl(t.icon_url) ?? t.icon_url,
    createdAt: t.created_at,
    dashboardDomain: t.dashboard_domain ?? null,
    vercelDomainStatus: t.vercel_domain_status ?? null,
    vercelDomainError: t.vercel_domain_error ?? null,
    vercelDomainUpdatedAt: t.vercel_domain_updated_at ?? null,
    saasPlan: (t as { saas_plan?: string }).saas_plan ?? 'base',
    stripeConnectAccountMasked: maskStripeConnectAccountId(
      (t as { stripe_connect_account_id?: string | null }).stripe_connect_account_id
    ),
    stripeConnectChargesEnabled: Boolean((t as { stripe_connect_charges_enabled?: boolean }).stripe_connect_charges_enabled),
    stripeConnectPayoutsEnabled: Boolean((t as { stripe_connect_payouts_enabled?: boolean }).stripe_connect_payouts_enabled),
    stripeConnectDetailsSubmitted: Boolean(
      (t as { stripe_connect_details_submitted?: boolean }).stripe_connect_details_submitted
    ),
    stripeConnectUpdatedAt: (t as { stripe_connect_updated_at?: Date | string | null }).stripe_connect_updated_at ?? null,
    stripeOnboardedAt: (t as { stripe_onboarded_at?: Date | string | null }).stripe_onboarded_at ?? null,
    subscriptionApplicationFeeBps:
      (t as { subscription_application_fee_bps?: number | null }).subscription_application_fee_bps ?? null,
    subscriptionShopifyFulfillmentEnabled: Boolean(
      (t as { subscription_shopify_fulfillment_enabled?: boolean }).subscription_shopify_fulfillment_enabled
    ),
  }));
  success(res, { tenants: formatted });
}

export async function createTenant(req: Request, res: Response): Promise<void> {
  const body = req.body as {
    name: string;
    slug: string;
    apiKey?: string;
    primaryColor?: string;
    secondaryColor?: string;
    status?: string;
    posType?: string | null;
    shopifyStoreUrl?: string;
    shopifyClientId?: string;
    shopifyClientSecret?: string;
    shopifyStorefrontToken?: string;
    shopifyAdminToken?: string;
    shopifyWebhookSecret?: string;
  };

  if (!body.name || !body.slug) {
    error(res, 'VALIDATION_ERROR', 'Name and slug are required', 400);
    return;
  }

  const slug = body.slug.trim().toLowerCase();
  if (RESERVED_TENANT_SLUGS.has(slug)) {
    error(res, 'VALIDATION_ERROR', `Slug "${slug}" is reserved for platform routing`, 400);
    return;
  }

  const apiKey = body.apiKey || `tenant_${crypto.randomBytes(16).toString('hex')}`;
  const apiKeyHash = bcrypt.hashSync(apiKey, 10);

  const [tenant] = await db('tenants')
    .insert({
      name: body.name,
      slug,
      api_key: apiKey,
      api_key_hash: apiKeyHash,
      primary_color: body.primaryColor || '#1B4D7A',
      secondary_color: body.secondaryColor || '#E8A832',
      // Super Admin-created tenants should be immediately reachable on retailer subdomains.
      status: body.status || 'active',
      ...buildPosSecretInsert({
        posType: body.posType || null,
        shopifyStoreUrl: body.shopifyStoreUrl || null,
        shopifyClientId: body.shopifyClientId || null,
        shopifyClientSecret: body.shopifyClientSecret || null,
        shopifyStorefrontToken: body.shopifyStorefrontToken || null,
        shopifyAdminToken: body.shopifyAdminToken || null,
        shopifyWebhookSecret: body.shopifyWebhookSecret || null,
      }),
    })
    .returning('*');

  const dashboardHost = getDashboardHostname();
  const fullDomain = `${slug}.${dashboardHost}`;

  type VercelPayload = {
    status: 'attached' | 'failed' | 'skipped';
    domain: string;
    reason?: string;
    error?: string;
  };

  let vercelDomain: VercelPayload = {
    status: 'skipped',
    domain: fullDomain,
    reason: 'not_configured',
  };

  if (isVercelDomainAttachConfigured()) {
    const vercelRes = await vercelProjectDomains.addProjectDomain(fullDomain);
    if (vercelRes.ok) {
      vercelDomain = { status: 'attached', domain: fullDomain };
      await db('tenants').where({ id: tenant.id }).update({
        dashboard_domain: fullDomain,
        vercel_domain_status: 'attached',
        vercel_domain_error: null,
        vercel_domain_updated_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
    } else {
      vercelDomain = {
        status: 'failed',
        domain: fullDomain,
        error: vercelRes.message,
      };
      await db('tenants').where({ id: tenant.id }).update({
        dashboard_domain: fullDomain,
        vercel_domain_status: 'failed',
        vercel_domain_error: vercelRes.message.slice(0, 2000),
        vercel_domain_updated_at: db.fn.now(),
        updated_at: db.fn.now(),
      });
      console.warn('[createTenant] Vercel domain attach failed:', fullDomain, vercelRes.status, vercelRes.message);
    }
  } else {
    await db('tenants').where({ id: tenant.id }).update({
      dashboard_domain: fullDomain,
      vercel_domain_status: 'skipped',
      vercel_domain_error: null,
      vercel_domain_updated_at: db.fn.now(),
      updated_at: db.fn.now(),
    });
  }

  res.status(201);
  success(res, {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      apiKey,
    },
    vercelDomain,
  });
}

/**
 * Get POS configuration summary for a tenant (no secrets).
 */
export async function getTenantPosConfig(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const summary = await getTenantPosSummary(id);
  if (!summary) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }

  success(res, summary);
}

export async function getTenantPosIntegrationActivity(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const tenant = await db('tenants').where({ id }).select('id').first();
  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }

  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize ?? '20'), 10) || 20));

  const { items, total } = await listPosIntegrationActivity(id, page, pageSize);
  success(res, items, undefined, {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize) || 1,
  });
}

/**
 * Update POS configuration for a tenant (Shopify-only for Phase 1).
 */
export async function updateTenantPosConfig(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const {
    posType,
    shopifyStoreUrl,
    shopifyClientId,
    shopifyClientSecret,
    shopifyStorefrontToken,
    shopifyAdminToken,
    shopifyWebhookSecret,
    shopifyCatalogSyncEnabled,
    productSyncIntervalMinutes,
  } = req.body as {
    posType?: string | null;
    shopifyStoreUrl?: string;
    shopifyClientId?: string;
    shopifyClientSecret?: string;
    shopifyStorefrontToken?: string;
    shopifyAdminToken?: string;
    shopifyWebhookSecret?: string;
    shopifyCatalogSyncEnabled?: boolean;
    productSyncIntervalMinutes?: number | null;
  };

  const prev = await db('tenants')
    .where({ id })
    .select('pos_type', 'shopify_catalog_sync_enabled')
    .first();

  try {
    const summary = await updateTenantPosConfigService(id, {
      posType,
      shopifyStoreUrl,
      shopifyClientId,
      shopifyClientSecret,
      shopifyStorefrontToken,
      shopifyAdminToken,
      shopifyWebhookSecret,
      shopifyCatalogSyncEnabled,
      productSyncIntervalMinutes,
    });
    if (summary.posType === 'shopify') {
      await ensureCanonicalShopifyStoreDomain(id);
    }
    await reconcileShopifyCatalogWebhooks({
      tenantId: id,
      wasShopify: prev?.pos_type === 'shopify',
      wasCatalogSyncEnabled: !!prev?.shopify_catalog_sync_enabled,
      isShopify: summary.posType === 'shopify',
      isCatalogSyncEnabled: summary.shopifyCatalogSyncEnabled,
    });
    const saEmail = (req as Request & { superAdminEmail?: string }).superAdminEmail ?? null;
    await logPosIntegrationActivity(id, {
      eventType: 'pos_settings_saved',
      summary: 'POS settings saved (super admin)',
      metadata: {
        posType: summary.posType,
        catalogSyncEnabled: summary.shopifyCatalogSyncEnabled,
        productSyncIntervalMinutes: summary.productSyncIntervalMinutes,
      },
      source: 'super_admin',
      actorLabel: saEmail,
    });
    const fresh = await getTenantPosSummary(id);
    success(res, fresh ?? summary, 'POS configuration saved');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update POS configuration';
    if (message === 'Tenant not found') {
      error(res, 'NOT_FOUND', message, 404);
      return;
    }
    if (message === 'Unsupported POS type for this phase') {
      error(res, 'VALIDATION_ERROR', message, 400);
      return;
    }
    error(res, 'INTERNAL_ERROR', message, 500);
  }
}

/**
 * Test POS connection for a tenant using the registered adapter.
 */
export async function testTenantPosConnection(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  try {
    const result = await testTenantPosConnectionService(id);
    if (!result.ok) {
      const code = (result.details as { code?: string } | undefined)?.code;
      if (code === 'DOMAIN_MISMATCH') {
        error(res, 'DOMAIN_MISMATCH', result.message || 'Shop domain mismatch', 400);
        return;
      }
      if (code === 'AUTH_ERROR') {
        error(res, 'AUTH_ERROR', result.message || 'Shopify authentication failed', 400);
        return;
      }
      if (code === 'CONFIG_ERROR') {
        error(res, 'CONFIG_ERROR', result.message || 'Shopify configuration is incomplete', 400);
        return;
      }
      error(res, 'INTERNAL_ERROR', result.message || 'Shopify connection test failed', 500);
      return;
    }
    success(res, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to test POS connection';
    if (message === 'Tenant not found') {
      error(res, 'NOT_FOUND', message, 404);
      return;
    }
    if (message === 'No POS adapter configured for this tenant') {
      error(res, 'CONFIG_ERROR', message, 400);
      return;
    }
    error(res, 'INTERNAL_ERROR', message, 500);
  }
}

/**
 * Trigger a catalog sync for a tenant using the registered POS adapter.
 */
export async function syncTenantCatalog(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { full } = req.body as { full?: boolean };

  const tenant = await db('tenants').where({ id }).first();
  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }

  const { getPosAdapter } = await import('../services/posAdapterRegistry');
  const adapter = getPosAdapter(tenant.pos_type);
  if (!adapter) {
    error(res, 'CONFIG_ERROR', 'No POS adapter configured for this tenant', 400);
    return;
  }

  const existingPosProduct = await db('pos_products').where({ tenant_id: id }).select('id').first();
  const hasAnyPosProducts = !!existingPosProduct;

  const since =
    !full && hasAnyPosProducts && tenant.last_product_sync_at
      ? new Date(tenant.last_product_sync_at)
      : undefined;

  const summary = await adapter.syncCatalog(tenant.id, {
    full: !!full,
    since,
  });

  await db('tenants')
    .where({ id: tenant.id })
    .update({ last_product_sync_at: new Date() });

  const saEmail = (req as Request & { superAdminEmail?: string }).superAdminEmail ?? null;
  await logPosIntegrationActivity(id, {
    eventType: full ? 'sync_full_catalog_super_admin' : 'sync_incremental_super_admin',
    summary: `${full ? 'Full' : 'Incremental'} catalog sync: ${summary.created} created, ${summary.updated} updated${
      full && summary.deletedOrArchived ? `, ${summary.deletedOrArchived} removed` : ''
    }`,
    source: 'super_admin',
    actorLabel: saEmail,
    metadata: {
      full: !!full,
      created: summary.created,
      updated: summary.updated,
      deletedOrArchived: summary.deletedOrArchived,
      errorCount: summary.errors.length,
    },
  });

  success(res, summary);
}

/**
 * Get settings including super admin users list
 */
export async function getSettings(req: Request, res: Response): Promise<void> {
  const users: Array<{
    email: string;
    displayName: string | null;
    lastSignIn: string | null;
    createdAt: string | null;
    status: 'active' | 'not_registered' | 'error';
    source: 'env' | 'db';
    invitedAt?: string;
    error?: string;
  }> = [];

  const diagnostics: {
    firebaseConfigured: boolean;
    firebaseInitError: string | null;
    firebaseKeyDebug: Record<string, unknown>;
    envVarSet: boolean;
    emailCount: number;
    lookupErrors: string[];
  } = {
    firebaseConfigured: isFirebaseInitialized(),
    firebaseInitError: getFirebaseInitError(),
    firebaseKeyDebug: getFirebaseKeyDebugInfo(),
    envVarSet: env.SUPER_ADMIN_EMAILS.length > 0,
    emailCount: 0,
    lookupErrors: [],
  };

  // Get all whitelisted emails (env + db)
  const whitelistedEmails = await getAllWhitelistedEmails();
  diagnostics.emailCount = whitelistedEmails.length;

  // Try to initialize Firebase and get auth
  let auth: ReturnType<typeof getFirebaseAuth> | null = null;
  try {
    auth = getFirebaseAuth();
    diagnostics.firebaseConfigured = true;
  } catch (err: any) {
    diagnostics.firebaseConfigured = false;
    diagnostics.firebaseInitError = err.message;
    console.error('Firebase initialization error:', err.message);
  }

  // If Firebase is configured, try to look up users
  if (auth) {
    for (const entry of whitelistedEmails) {
      try {
        const user = await auth.getUserByEmail(entry.email);
        users.push({
          email: user.email || entry.email,
          displayName: user.displayName || null,
          lastSignIn: user.metadata.lastSignInTime || null,
          createdAt: user.metadata.creationTime || null,
          status: 'active',
          source: entry.source,
          invitedAt: entry.invitedAt,
        });
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          users.push({
            email: entry.email,
            displayName: null,
            lastSignIn: null,
            createdAt: null,
            status: 'not_registered',
            source: entry.source,
            invitedAt: entry.invitedAt,
          });
        } else {
          const errorMsg = `${entry.email}: ${err.code || err.message || 'Unknown error'}`;
          diagnostics.lookupErrors.push(errorMsg);
          console.error(`Error fetching user ${entry.email}:`, err);
          users.push({
            email: entry.email,
            displayName: null,
            lastSignIn: null,
            createdAt: null,
            status: 'error',
            source: entry.source,
            invitedAt: entry.invitedAt,
            error: err.code || err.message,
          });
        }
      }
    }
  } else {
    // Firebase not initialized - show all emails as unable to verify
    for (const entry of whitelistedEmails) {
      users.push({
        email: entry.email,
        displayName: null,
        lastSignIn: null,
        createdAt: null,
        status: 'error',
        source: entry.source,
        invitedAt: entry.invitedAt,
        error: 'Firebase not initialized',
      });
    }
  }

  // Also include the currently authenticated user if not already in the list
  const currentUserEmail = (req as any).superAdminEmail;
  if (currentUserEmail && !users.some(u => u.email.toLowerCase() === currentUserEmail.toLowerCase())) {
    users.unshift({
      email: currentUserEmail,
      displayName: null,
      lastSignIn: new Date().toISOString(),
      createdAt: null,
      status: 'active',
      source: 'env',
    });
  }

  success(res, {
    users,
    diagnostics,
  });
}

/**
 * Add an email to the super admin whitelist
 */
export async function addWhitelistEmail(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email?: string };
  const addedBy = (req as any).superAdminEmail;

  if (!email) {
    error(res, 'VALIDATION_ERROR', 'Email is required', 400);
    return;
  }

  const emailLower = email.toLowerCase().trim();

  // Check if already whitelisted
  const existing = await isEmailWhitelisted(emailLower);
  if (existing.allowed) {
    error(res, 'CONFLICT', 'This email is already whitelisted', 409);
    return;
  }

  // Add to database
  try {
    await db('super_admin_whitelist').insert({
      email: emailLower,
      added_by: addedBy,
    });
    success(res, { message: 'Email added to whitelist', email: emailLower });
  } catch (err: any) {
    console.error('Error adding email to whitelist:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to add email', 500);
  }
}

/**
 * Remove an email from the super admin whitelist (database only, can't remove env vars)
 */
export async function removeWhitelistEmail(req: Request, res: Response): Promise<void> {
  const { email } = req.params;

  if (!email) {
    error(res, 'VALIDATION_ERROR', 'Email is required', 400);
    return;
  }

  const emailLower = email.toLowerCase().trim();

  // Check if it's from env var (can't be removed)
  const inEnv = env.SUPER_ADMIN_EMAILS.some(
    (allowed) => allowed.toLowerCase() === emailLower
  );
  if (inEnv) {
    error(res, 'FORBIDDEN', 'Cannot remove emails from environment variable. Remove from Railway instead.', 403);
    return;
  }

  // Remove from database
  try {
    const deleted = await db('super_admin_whitelist')
      .whereRaw('LOWER(email) = ?', [emailLower])
      .delete();
    
    if (deleted === 0) {
      error(res, 'NOT_FOUND', 'Email not found in whitelist', 404);
      return;
    }
    
    success(res, { message: 'Email removed from whitelist', email: emailLower });
  } catch (err: any) {
    console.error('Error removing email from whitelist:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to remove email', 500);
  }
}

/**
 * Send an invite email to a whitelisted user
 */
export async function sendInviteEmail(req: Request, res: Response): Promise<void> {
  const { email } = req.body as { email?: string };

  if (!email) {
    error(res, 'VALIDATION_ERROR', 'Email is required', 400);
    return;
  }

  const emailLower = email.toLowerCase().trim();

  // Check if email is whitelisted
  const whitelist = await isEmailWhitelisted(emailLower);
  if (!whitelist.allowed) {
    error(res, 'FORBIDDEN', 'Email is not whitelisted. Add it first.', 403);
    return;
  }

  // Check if SendGrid is configured
  if (!env.SENDGRID_API_KEY) {
    error(res, 'CONFIG_ERROR', 'Email sending is not configured (SENDGRID_API_KEY missing)', 500);
    return;
  }

  const signupUrl = `${env.API_URL.replace('api.', 'admin.')}/super-admin/auth/register`;

  try {
    await sgMail.send({
      to: emailLower,
      from: {
        email: env.SENDGRID_FROM_EMAIL,
        name: env.SENDGRID_FROM_NAME,
      },
      subject: 'You\'re invited to Hot Tub Companion Admin',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1B4D7A;">Welcome to Hot Tub Companion! 🛁</h2>
          <p>You've been invited to join as a Super Admin.</p>
          <p>Click the button below to create your account:</p>
          <p style="margin: 30px 0;">
            <a href="${signupUrl}" 
               style="background-color: #1B4D7A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Create Your Account
            </a>
          </p>
          <p style="color: #666; font-size: 14px;">
            Or copy this link: <br>
            <a href="${signupUrl}" style="color: #1B4D7A;">${signupUrl}</a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            This invitation was sent from Hot Tub Companion Admin Dashboard.
          </p>
        </div>
      `,
    });

    // Update invited_at timestamp if it's a db whitelist entry
    if (whitelist.source === 'db') {
      await db('super_admin_whitelist')
        .whereRaw('LOWER(email) = ?', [emailLower])
        .update({ invited_at: db.fn.now() });
    }

    success(res, { message: 'Invite email sent', email: emailLower });
  } catch (err: any) {
    console.error('Error sending invite email:', err);
    error(res, 'EMAIL_ERROR', `Failed to send email: ${err.message}`, 500);
  }
}

function tenantFeatureColumns(row: Record<string, unknown>): TenantFeatureRow {
  return {
    feature_subscriptions: Boolean(row.feature_subscriptions),
    feature_loyalty: Boolean(row.feature_loyalty),
    feature_referrals: Boolean(row.feature_referrals),
    feature_water_care: Boolean(row.feature_water_care),
    feature_service_scheduling: Boolean(row.feature_service_scheduling),
    feature_seasonal_timeline: Boolean(row.feature_seasonal_timeline),
    feature_tab_inbox: row.feature_tab_inbox !== false,
    feature_tab_dealer: row.feature_tab_dealer !== false,
  };
}

/**
 * GET plan label + effective feature flags + preset snapshots for Super Admin UI.
 */
export async function getTenantEntitlements(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const tenant = await db('tenants').where({ id }).first();
  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }

  const saasPlan = String((tenant as { saas_plan?: string }).saas_plan ?? 'base');
  success(res, {
    tenantId: tenant.id,
    saasPlan,
    features: tenantFeatureColumns(tenant),
    presets: SAAS_PLAN_PRESETS,
  });
}

/**
 * Apply a preset and/or patch individual feature_* columns.
 * Body: { applyPreset?: 'base'|'core'|'advanced', saasPlan?: 'base'|'core'|'advanced'|'custom', features?: Partial<TenantFeatureRow> }
 */
export async function updateTenantEntitlements(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const body = req.body as {
    applyPreset?: SaasPlanPreset;
    saasPlan?: string;
    features?: Partial<TenantFeatureRow>;
  };

  const tenant = await db('tenants').where({ id }).first();
  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }

  const update: Record<string, unknown> = { updated_at: db.fn.now() };

  if (body.applyPreset != null) {
    if (!isSaasPlanPreset(body.applyPreset)) {
      error(res, 'VALIDATION_ERROR', 'applyPreset must be base, core, or advanced', 400);
      return;
    }
    const preset = getPreset(body.applyPreset);
    Object.assign(update, preset);
    update.saas_plan = body.applyPreset;
  }

  if (body.saasPlan !== undefined) {
    const p = body.saasPlan.trim().toLowerCase();
    if (!['base', 'core', 'advanced', 'custom'].includes(p)) {
      error(res, 'VALIDATION_ERROR', 'saasPlan must be base, core, advanced, or custom', 400);
      return;
    }
    update.saas_plan = p;
  }

  if (body.features && typeof body.features === 'object') {
    const allowed: (keyof TenantFeatureRow)[] = [
      'feature_subscriptions',
      'feature_loyalty',
      'feature_referrals',
      'feature_water_care',
      'feature_service_scheduling',
      'feature_seasonal_timeline',
      'feature_tab_inbox',
      'feature_tab_dealer',
    ];
    for (const key of allowed) {
      if (key in body.features && typeof (body.features as Record<string, boolean>)[key] === 'boolean') {
        update[key] = (body.features as Record<string, boolean>)[key];
      }
    }
  }

  if (Object.keys(update).length <= 1) {
    success(res, { message: 'No changes applied', tenantId: id });
    return;
  }

  const [updated] = await db('tenants').where({ id }).update(update).returning('*');
  success(res, {
    tenantId: updated.id,
    saasPlan: String((updated as { saas_plan?: string }).saas_plan ?? 'base'),
    features: tenantFeatureColumns(updated as Record<string, unknown>),
  });
}
