import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import { logAudit } from '../services/audit.service';
import { AuditAction } from '../types/uhtd.types';

export async function getPendingCompatibilities(req: Request, res: Response) {
  try {
    const { page = '1', pageSize = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);

    const countResult = await db('part_spa_compatibility')
      .where('status', 'pending')
      .count('* as count')
      .first();
    const totalCount = parseInt((countResult?.count as string) ?? '0', 10);

    const rows = await db('part_spa_compatibility as psc')
      .select(
        'psc.*',
        'p.name as part_name',
        'p.part_number',
        'sm.model_name',
        'sm.model_year',
        'b.name as brand_name',
        'ml.name as model_line_name'
      )
      .leftJoin('pcdb_parts as p', 'psc.part_id', 'p.id')
      .leftJoin('scdb_spa_models as sm', 'psc.spa_model_id', 'sm.id')
      .leftJoin('scdb_model_lines as ml', 'sm.model_line_id', 'ml.id')
      .leftJoin('scdb_brands as b', 'ml.brand_id', 'b.id')
      .where('psc.status', 'pending')
      .orderBy('psc.created_at', 'desc')
      .limit(parseInt(pageSize as string))
      .offset(offset);

    success(
      res,
      rows.map((row: Record<string, unknown>) => ({
        id: row.id,
        partId: row.part_id,
        spaModelId: row.spa_model_id,
        status: row.status,
        fitNotes: row.fit_notes,
        dataSource: row.data_source,
        createdAt: row.created_at,
        part: {
          name: row.part_name,
          partNumber: row.part_number,
        },
        spaModel: {
          modelName: row.model_name,
          modelYear: row.model_year,
          brandName: row.brand_name,
          modelLineName: row.model_line_name,
        },
      })),
      undefined,
      {
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string),
        total: totalCount,
        totalPages: Math.ceil(totalCount / parseInt(pageSize as string)),
      }
    );
  } catch (err) {
    console.error('Error fetching pending compatibilities:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to fetch pending compatibilities', 500);
  }
}

export async function bulkConfirmCompatibilities(req: Request, res: Response) {
  try {
    const { ids } = req.body;
    const userId = (req as any).superAdminEmail;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return error(res, 'VALIDATION_ERROR', 'IDs array is required', 400);
    }

    const updated = await db('part_spa_compatibility')
      .whereIn('id', ids)
      .where('status', 'pending')
      .update({ status: 'confirmed', updated_at: db.fn.now() });

    for (const id of ids) {
      await logAudit(
        'part_spa_compatibility',
        id,
        'UPDATE' as AuditAction,
        { status: 'pending' },
        { status: 'confirmed' },
        userId
      );
    }

    success(res, { confirmed: updated }, `${updated} compatibilities confirmed`);
  } catch (err) {
    console.error('Error confirming compatibilities:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to confirm compatibilities', 500);
  }
}

export async function bulkRejectCompatibilities(req: Request, res: Response) {
  try {
    const { ids } = req.body;
    const userId = (req as any).superAdminEmail;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return error(res, 'VALIDATION_ERROR', 'IDs array is required', 400);
    }

    const existing = await db('part_spa_compatibility').whereIn('id', ids);

    await db('part_spa_compatibility').whereIn('id', ids).del();

    for (const record of existing) {
      await logAudit(
        'part_spa_compatibility',
        record.id,
        'DELETE' as AuditAction,
        record,
        null,
        userId
      );
    }

    success(res, { rejected: ids.length }, `${ids.length} compatibilities rejected`);
  } catch (err) {
    console.error('Error rejecting compatibilities:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to reject compatibilities', 500);
  }
}

export async function getReviewStats(req: Request, res: Response) {
  try {
    const [pendingCount] = await db('part_spa_compatibility')
      .where('status', 'pending')
      .count('* as count');

    const [confirmedCount] = await db('part_spa_compatibility')
      .where('status', 'confirmed')
      .count('* as count');

    const recentPending = await db('part_spa_compatibility as psc')
      .select('p.name as part_name', db.raw('COUNT(*) as pending_count'))
      .leftJoin('pcdb_parts as p', 'psc.part_id', 'p.id')
      .where('psc.status', 'pending')
      .groupBy('psc.part_id', 'p.name')
      .orderBy('pending_count', 'desc')
      .limit(5);

    success(res, {
      pending: parseInt(pendingCount.count as string),
      confirmed: parseInt(confirmedCount.count as string),
      topPendingParts: recentPending.map((r: Record<string, unknown>) => ({
        partName: r.part_name,
        pendingCount: parseInt(r.pending_count as string),
      })),
    });
  } catch (err) {
    console.error('Error fetching review stats:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to fetch review stats', 500);
  }
}
