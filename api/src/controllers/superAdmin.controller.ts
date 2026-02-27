import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { env } from '../config/environment';
import { getFirebaseAuth } from '../config/firebase';

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

  const emailLower = email.toLowerCase().trim();
  const isAllowed = env.SUPER_ADMIN_EMAILS.some(
    (allowed) => allowed.toLowerCase() === emailLower
  );

  success(res, { allowed: isAllowed });
}

/**
 * Register a new super admin user
 * Only allows registration if email is in SUPER_ADMIN_EMAILS env var
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
  const isAllowed = env.SUPER_ADMIN_EMAILS.some(
    (allowed) => allowed.toLowerCase() === emailLower
  );

  if (!isAllowed) {
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
 * Get settings including super admin users list
 */
export async function getSettings(req: Request, res: Response): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    const users: Array<{
      email: string;
      displayName: string | null;
      lastSignIn: string | null;
      createdAt: string | null;
      status: 'active' | 'not_registered' | 'error';
      error?: string;
    }> = [];

    const diagnostics: {
      firebaseConfigured: boolean;
      envVarSet: boolean;
      emailCount: number;
      lookupErrors: string[];
    } = {
      firebaseConfigured: !!auth,
      envVarSet: env.SUPER_ADMIN_EMAILS.length > 0,
      emailCount: env.SUPER_ADMIN_EMAILS.length,
      lookupErrors: [],
    };

    // Get users from Firebase for the allowed emails
    for (const email of env.SUPER_ADMIN_EMAILS) {
      try {
        const user = await auth.getUserByEmail(email.toLowerCase());
        users.push({
          email: user.email || email,
          displayName: user.displayName || null,
          lastSignIn: user.metadata.lastSignInTime || null,
          createdAt: user.metadata.creationTime || null,
          status: 'active',
        });
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          users.push({
            email,
            displayName: null,
            lastSignIn: null,
            createdAt: null,
            status: 'not_registered',
          });
        } else {
          const errorMsg = `${email}: ${err.code || err.message || 'Unknown error'}`;
          diagnostics.lookupErrors.push(errorMsg);
          console.error(`Error fetching user ${email}:`, err);
          users.push({
            email,
            displayName: null,
            lastSignIn: null,
            createdAt: null,
            status: 'error',
            error: err.code || err.message,
          });
        }
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
      });
    }

    success(res, {
      users,
      allowedEmails: env.SUPER_ADMIN_EMAILS,
      diagnostics,
    });
  } catch (err: any) {
    console.error('Error getting settings:', err);
    error(res, 'INTERNAL_ERROR', `Failed to get settings: ${err.message}`, 500);
  }
}
