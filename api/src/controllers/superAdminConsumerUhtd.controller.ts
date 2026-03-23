import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';

const ALLOWED_STATUS = ['pending', 'approved', 'rejected'] as const;

/**
 * GET /api/v1/super-admin/consumer-uhtd-suggestions
 */
export async function listConsumerSuggestions(req: Request, res: Response): Promise<void> {
  const status = (req.query.status as string) || 'pending';
  if (!ALLOWED_STATUS.includes(status as (typeof ALLOWED_STATUS)[number])) {
    error(res, 'VALIDATION_ERROR', `status must be one of: ${ALLOWED_STATUS.join(', ')}`, 400);
    return;
  }

  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || '25'), 10) || 25));
  const offset = (page - 1) * pageSize;

  const countRow = await db('consumer_uhtd_suggestions as c').where('c.status', status).count('* as c').first();
  const total = parseInt(String((countRow as any)?.c ?? '0'), 10);

  const rows = await db('consumer_uhtd_suggestions as c')
    .leftJoin('users as u', 'u.id', 'c.user_id')
    .leftJoin('tenants as t', 't.id', 'c.tenant_id')
    .where('c.status', status)
    .select(
      'c.id',
      'c.status',
      'c.payload',
      'c.created_at',
      'c.updated_at',
      'c.reviewed_at',
      'c.reviewed_by_email',
      'c.review_notes',
      'u.email as user_email',
      'u.first_name as user_first_name',
      'u.last_name as user_last_name',
      't.name as tenant_name'
    )
    .orderBy('c.created_at', 'desc')
    .limit(pageSize)
    .offset(offset);

  success(res, {
    suggestions: rows.map((r) => ({
      id: r.id,
      status: r.status,
      payload: r.payload,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      reviewedAt: r.reviewed_at,
      reviewedByEmail: r.reviewed_by_email,
      reviewNotes: r.review_notes,
      user: {
        email: r.user_email,
        firstName: r.user_first_name,
        lastName: r.user_last_name,
      },
      tenantName: r.tenant_name,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 0 },
  });
}

/**
 * PATCH /api/v1/super-admin/consumer-uhtd-suggestions/:id
 * Marks review outcome only — does not insert into SCdb.
 */
export async function updateConsumerSuggestion(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const body = req.body as { status?: string; reviewNotes?: string };
  const nextStatus = body.status;
  if (nextStatus !== 'approved' && nextStatus !== 'rejected') {
    error(res, 'VALIDATION_ERROR', 'status must be approved or rejected', 400);
    return;
  }

  const row = await db('consumer_uhtd_suggestions').where({ id }).first();
  if (!row) {
    error(res, 'NOT_FOUND', 'Suggestion not found', 404);
    return;
  }

  const email = (req as Request & { superAdminEmail?: string }).superAdminEmail || '';

  await db('consumer_uhtd_suggestions')
    .where({ id })
    .update({
      status: nextStatus,
      review_notes: typeof body.reviewNotes === 'string' ? body.reviewNotes.slice(0, 5000) : null,
      reviewed_at: db.fn.now(),
      reviewed_by_email: email,
      updated_at: db.fn.now(),
    });

  const updated = await db('consumer_uhtd_suggestions').where({ id }).first();
  success(res, { suggestion: updated });
}
