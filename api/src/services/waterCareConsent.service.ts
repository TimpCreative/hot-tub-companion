import { db } from '../config/database';
import { getWaterCareLegalConfig } from './waterCareConfig.service';

export async function hasAcceptedCurrentPolicy(
  userId: string,
  tenantId: string,
  policyVersion: string
): Promise<boolean> {
  if (!policyVersion.trim()) return true;
  const row = await db('user_water_care_consents')
    .where({ user_id: userId, tenant_id: tenantId, policy_version: policyVersion })
    .first();
  return !!row;
}

export async function recordConsent(input: {
  userId: string;
  tenantId: string;
  policyVersion: string;
  spaProfileId?: string | null;
}): Promise<void> {
  await db('user_water_care_consents').insert({
    user_id: input.userId,
    tenant_id: input.tenantId,
    policy_version: input.policyVersion.trim().slice(0, 120),
    spa_profile_id: input.spaProfileId ?? null,
    accepted_at: db.fn.now(),
  });
}

export async function getConsentStatusForUser(userId: string, tenantId: string) {
  const tenant = await db('tenants').where({ id: tenantId }).first();
  const legal = getWaterCareLegalConfig((tenant as { water_care_config?: unknown } | undefined)?.water_care_config);
  const needsAcceptance = !!legal.policyVersion.trim() && !(await hasAcceptedCurrentPolicy(userId, tenantId, legal.policyVersion));
  return {
    policyVersion: legal.policyVersion,
    needsAcceptance,
    legal,
  };
}
