import { Request, Response } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';
import * as notificationService from '../services/notification.service';

const VALID_TARGETS = ['all_customers', 'tenant_customers', 'all_admins'] as const;

export async function sendAnnouncement(req: Request, res: Response): Promise<void> {
  const email = (req as any).superAdminEmail as string;

  const body = req.body as {
    target?: string;
    targetTenantId?: string;
    title?: string;
    body?: string;
  };

  const target = body.target;
  if (!target || !VALID_TARGETS.includes(target as (typeof VALID_TARGETS)[number])) {
    error(res, 'VALIDATION_ERROR', 'target must be one of: all_customers, tenant_customers, all_admins', 400);
    return;
  }

  if (target === 'tenant_customers') {
    if (!body.targetTenantId || typeof body.targetTenantId !== 'string') {
      error(res, 'VALIDATION_ERROR', 'targetTenantId is required when target is tenant_customers', 400);
      return;
    }
    const tenant = await db('tenants').where({ id: body.targetTenantId }).first();
    if (!tenant) {
      error(res, 'NOT_FOUND', 'Tenant not found', 404);
      return;
    }
  }

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 255) : '';
  const bodyText = typeof body.body === 'string' ? body.body.trim().slice(0, 2000) : '';
  if (!title || !bodyText) {
    error(res, 'VALIDATION_ERROR', 'Title and body are required', 400);
    return;
  }

  let sent = 0;
  let failed = 0;

  if (target === 'all_customers') {
    const res2 = await notificationService.sendToAllCustomers(
      undefined,
      title,
      bodyText,
      undefined,
      'promotional',
      { type: 'global_announcement', createdByType: 'super_admin', createdById: email }
    );
    sent = res2.sent;
    failed = res2.failed;
  } else if (target === 'tenant_customers') {
    const res2 = await notificationService.sendToTenantCustomers(
      body.targetTenantId!,
      title,
      bodyText,
      undefined,
      'promotional',
      { type: 'global_announcement', createdByType: 'super_admin', createdById: email }
    );
    sent = res2.sent;
    failed = res2.failed;
  } else {
    error(res, 'VALIDATION_ERROR', 'all_admins target not yet implemented', 400);
    return;
  }

  await db('global_push_announcements').insert({
    created_by_email: email,
    target,
    target_tenant_id: target === 'tenant_customers' ? body.targetTenantId : null,
    title,
    body: bodyText,
  });

  success(res, { sent, failed }, 'Announcement sent');
}
