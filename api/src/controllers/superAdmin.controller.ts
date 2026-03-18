import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { env } from '../config/environment';
import { getFirebaseAuth, isFirebaseInitialized, getFirebaseInitError, getFirebaseKeyDebugInfo } from '../config/firebase';
import sgMail from '@sendgrid/mail';

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
    createdAt: t.created_at,
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
    shopifyStorefrontToken?: string;
    shopifyAdminToken?: string;
  };

  if (!body.name || !body.slug) {
    error(res, 'VALIDATION_ERROR', 'Name and slug are required', 400);
    return;
  }

  const apiKey = body.apiKey || `tenant_${crypto.randomBytes(16).toString('hex')}`;
  const apiKeyHash = bcrypt.hashSync(apiKey, 10);

  const [tenant] = await db('tenants')
    .insert({
      name: body.name,
      slug: body.slug,
      api_key: apiKey,
      api_key_hash: apiKeyHash,
      primary_color: body.primaryColor || '#1B4D7A',
      secondary_color: body.secondaryColor || '#E8A832',
      status: body.status || 'onboarding',
      pos_type: body.posType || null,
      shopify_store_url: body.shopifyStoreUrl || null,
      shopify_storefront_token: body.shopifyStorefrontToken || null,
      shopify_admin_token: body.shopifyAdminToken || null,
    })
    .returning('*');

  res.status(201);
  success(res, {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      apiKey,
    },
  });
}

/**
 * Get POS configuration summary for a tenant (no secrets).
 */
export async function getTenantPosConfig(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const tenant = await db('tenants').where({ id }).first();
  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }

  success(res, {
    tenantId: tenant.id,
    posType: tenant.pos_type,
    shopifyStoreUrl: tenant.shopify_store_url,
    lastProductSyncAt: tenant.last_product_sync_at,
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
    shopifyStorefrontToken,
    shopifyAdminToken,
  } = req.body as {
    posType?: string | null;
    shopifyStoreUrl?: string;
    shopifyStorefrontToken?: string;
    shopifyAdminToken?: string;
  };

  const tenant = await db('tenants').where({ id }).first();
  if (!tenant) {
    error(res, 'NOT_FOUND', 'Tenant not found', 404);
    return;
  }

  const update: Record<string, unknown> = {};

  if (posType !== undefined) {
    if (posType !== null && posType !== 'shopify') {
      error(res, 'VALIDATION_ERROR', 'Unsupported POS type for this phase', 400);
      return;
    }
    update.pos_type = posType;
  }
  if (shopifyStoreUrl !== undefined) update.shopify_store_url = shopifyStoreUrl || null;
  if (shopifyStorefrontToken !== undefined) update.shopify_storefront_token = shopifyStorefrontToken || null;
  if (shopifyAdminToken !== undefined) update.shopify_admin_token = shopifyAdminToken || null;

  if (Object.keys(update).length === 0) {
    success(res, { message: 'No changes applied' });
    return;
  }

  const [updated] = await db('tenants').where({ id }).update(update).returning('*');

  success(res, {
    tenantId: updated.id,
    posType: updated.pos_type,
    shopifyStoreUrl: updated.shopify_store_url,
  });
}

/**
 * Test POS connection for a tenant using the registered adapter.
 */
export async function testTenantPosConnection(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
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

  const result = await adapter.testConnection(tenant.id);
  success(res, result);
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

  const since =
    !full && tenant.last_product_sync_at
      ? new Date(tenant.last_product_sync_at)
      : undefined;

  const summary = await adapter.syncCatalog(tenant.id, {
    full: !!full,
    since,
  });

  await db('tenants')
    .where({ id: tenant.id })
    .update({ last_product_sync_at: new Date() });

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
