import { getFirebaseAuth } from '../config/firebase';
import { db } from '../config/database';
import { env } from '../config/environment';
import { ValidationError, NotFoundError } from '../utils/errors';

interface RegisterBody {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export async function register(tenantId: string, body: RegisterBody) {
  const { email, password, firstName, lastName, phone } = body;
  if (!email || !password) {
    throw new ValidationError('Email and password are required');
  }
  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Invalid email format');
  }

  const existing = await db('users')
    .where({ tenant_id: tenantId, email })
    .whereNull('deleted_at')
    .first();
  if (existing) {
    throw new ValidationError('Email already registered for this tenant');
  }

  const auth = getFirebaseAuth();
  const firebaseUser = await auth.createUser({
    email,
    password,
    displayName: [firstName, lastName].filter(Boolean).join(' ').trim() || undefined,
  });

  const [user] = await db('users')
    .insert({
      tenant_id: tenantId,
      firebase_uid: firebaseUser.uid,
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
      role: 'customer',
    })
    .returning('*');

  const customToken = await auth.createCustomToken(firebaseUser.uid);

  return {
    user: formatUser(user),
    token: customToken,
  };
}

export async function verifyToken(token: string, tenantId?: string) {
  const auth = getFirebaseAuth();
  const decoded = await auth.verifyIdToken(token);
  const tenantIdToUse = tenantId;
  if (!tenantIdToUse) {
    throw new NotFoundError('Tenant context required');
  }

  const user = await db('users')
    .where({ firebase_uid: decoded.uid, tenant_id: tenantIdToUse })
    .whereNull('deleted_at')
    .first();

  if (user) {
    const dbEmail = (user.email as string) || '';
    const firebaseEmail = (decoded.email as string) || '';
    if (dbEmail !== firebaseEmail) {
      await db('users')
        .where({ id: user.id })
        .update({ email: firebaseEmail, updated_at: db.fn.now() });
    }
    return formatUser({ ...user, email: firebaseEmail || user.email });
  }

  // Whitelist override: same rules as authMiddleware (no users row for this tenant)
  const email = ((decoded.email as string) || '').toLowerCase();
  const canOverride =
    (email && env.TENANT_ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email)) ||
    (email && env.SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email));

  if (canOverride) {
    const displayEmail = (decoded.email as string) || email;
    const nameParts = ((decoded.name as string) || '').split(' ').filter(Boolean);
    return {
      id: `admin_${decoded.uid}`,
      email: displayEmail,
      firstName: nameParts[0] || displayEmail.split('@')[0],
      lastName: nameParts.slice(1).join(' ') || undefined,
      phone: undefined,
      role: 'admin',
    };
  }

  throw new NotFoundError('User not found for this tenant');
}

export async function updateFcmToken(userId: string, fcmToken: string | null, timezone?: string | null) {
  const update: Record<string, unknown> = {
    fcm_token: fcmToken,
    fcm_token_updated_at: fcmToken ? new Date() : null,
  };
  if (timezone !== undefined) {
    const tz = typeof timezone === 'string' && timezone.trim().length > 0 && timezone.length <= 64
      ? timezone.trim()
      : null;
    update.timezone = tz;
  }
  await db('users').where({ id: userId }).update(update);
}

function formatUser(row: Record<string, unknown>) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    role: row.role,
  };
}
