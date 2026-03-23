import { db } from '../config/database';
import { getFirebaseAuth } from '../config/firebase';
import { NotFoundError } from '../utils/errors';

export interface ProfileUpdateBody {
  firstName?: string;
  lastName?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  notificationPrefMaintenance?: boolean;
  notificationPrefOrders?: boolean;
  notificationPrefSubscriptions?: boolean;
  notificationPrefService?: boolean;
  notificationPrefPromotional?: boolean;
  shareWaterTestsWithRetailer?: boolean;
}

export function formatProfile(row: Record<string, unknown>) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    zipCode: row.zip_code,
    country: row.country,
    role: row.role,
    notificationPrefMaintenance: row.notification_pref_maintenance,
    notificationPrefOrders: row.notification_pref_orders,
    notificationPrefSubscriptions: row.notification_pref_subscriptions,
    notificationPrefService: row.notification_pref_service,
    notificationPrefPromotional: row.notification_pref_promotional,
    shareWaterTestsWithRetailer: row.share_water_tests_with_retailer,
  };
}

export async function getProfile(userId: string, tenantId: string) {
  const user = await db('users')
    .where({ id: userId, tenant_id: tenantId })
    .whereNull('deleted_at')
    .first();
  if (!user) throw new NotFoundError('User not found');
  return formatProfile(user);
}

export async function updateProfile(
  userId: string,
  tenantId: string,
  body: ProfileUpdateBody
) {
  const update: Record<string, unknown> = { updated_at: db.fn.now() };

  if (body.firstName !== undefined) update.first_name = body.firstName?.trim() || null;
  if (body.lastName !== undefined) update.last_name = body.lastName?.trim() || null;
  if (body.phone !== undefined) update.phone = body.phone?.trim() || null;
  if (body.addressLine1 !== undefined) update.address_line1 = body.addressLine1?.trim()?.slice(0, 255) || null;
  if (body.addressLine2 !== undefined) update.address_line2 = body.addressLine2?.trim()?.slice(0, 255) || null;
  if (body.city !== undefined) update.city = body.city?.trim()?.slice(0, 100) || null;
  if (body.state !== undefined) update.state = body.state?.trim()?.slice(0, 50) || null;
  if (body.zipCode !== undefined) update.zip_code = body.zipCode?.trim()?.slice(0, 20) || null;
  if (body.country !== undefined) update.country = body.country?.trim()?.slice(0, 50) || 'US';
  if (body.notificationPrefMaintenance !== undefined) update.notification_pref_maintenance = !!body.notificationPrefMaintenance;
  if (body.notificationPrefOrders !== undefined) update.notification_pref_orders = !!body.notificationPrefOrders;
  if (body.notificationPrefSubscriptions !== undefined) update.notification_pref_subscriptions = !!body.notificationPrefSubscriptions;
  if (body.notificationPrefService !== undefined) update.notification_pref_service = !!body.notificationPrefService;
  if (body.notificationPrefPromotional !== undefined) update.notification_pref_promotional = !!body.notificationPrefPromotional;
  if (body.shareWaterTestsWithRetailer !== undefined) update.share_water_tests_with_retailer = !!body.shareWaterTestsWithRetailer;

  const [updated] = await db('users')
    .where({ id: userId, tenant_id: tenantId })
    .whereNull('deleted_at')
    .update(update)
    .returning('*');

  if (!updated) throw new NotFoundError('User not found');
  return formatProfile(updated);
}

export async function deleteAccount(userId: string, tenantId: string, hardDelete: boolean) {
  const user = await db('users')
    .where({ id: userId, tenant_id: tenantId })
    .first();
  if (!user) throw new NotFoundError('User not found');

  const firebaseUid = user.firebase_uid as string;

  if (hardDelete) {
    await db('spa_profiles').where({ user_id: userId }).del();
    await db('users').where({ id: userId }).del();
    const auth = getFirebaseAuth();
    try {
      await auth.deleteUser(firebaseUid);
    } catch (err) {
      console.warn('[deleteAccount] Firebase deleteUser failed (user may already be gone):', err);
    }
  } else {
    await db('users')
      .where({ id: userId })
      .update({ deleted_at: db.fn.now(), updated_at: db.fn.now() });
  }
}
