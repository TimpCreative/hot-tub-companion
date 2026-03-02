import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';

export async function getAuditLogs(req: Request, res: Response) {
  try {
    const {
      tableName,
      recordId,
      action,
      changedBy,
      page = '1',
      pageSize = '50',
    } = req.query;

    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);

    const baseQuery = () => {
      let q = db('audit_log');
      if (tableName) q = q.where('table_name', tableName);
      if (recordId) q = q.where('record_id', recordId);
      if (action) q = q.where('action', action);
      if (changedBy) q = q.where('changed_by', 'ilike', `%${changedBy}%`);
      return q;
    };

    const countResult = await baseQuery().count('* as count').first();
    const totalCount = parseInt((countResult?.count as string) ?? '0', 10);

    const logs = await baseQuery()
      .orderBy('created_at', 'desc')
      .limit(parseInt(pageSize as string))
      .offset(offset);

    success(
      res,
      logs.map((log: Record<string, unknown>) => ({
        id: log.id,
        tableName: log.table_name,
        recordId: log.record_id,
        action: log.action,
        oldValues: log.old_values,
        newValues: log.new_values,
        changedBy: log.changed_by,
        createdAt: log.created_at,
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
    console.error('Error fetching audit logs:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to fetch audit logs', 500);
  }
}

export async function getAuditStats(req: Request, res: Response) {
  try {
    const [totalCount] = await db('audit_log').count('* as count');
    const [todayCount] = await db('audit_log')
      .whereRaw("created_at >= NOW() - INTERVAL '24 hours'")
      .count('* as count');

    const byTable = await db('audit_log')
      .select('table_name')
      .count('* as count')
      .groupBy('table_name')
      .orderBy('count', 'desc')
      .limit(10);

    const byAction = await db('audit_log')
      .select('action')
      .count('* as count')
      .groupBy('action');

    const recentUsers = await db('audit_log')
      .select('changed_by')
      .count('* as count')
      .whereNotNull('changed_by')
      .groupBy('changed_by')
      .orderBy('count', 'desc')
      .limit(5);

    success(res, {
      total: parseInt(totalCount.count as string),
      last24Hours: parseInt(todayCount.count as string),
      byTable: byTable.map((r: Record<string, unknown>) => ({ table: r.table_name, count: parseInt(r.count as string) })),
      byAction: byAction.map((r: Record<string, unknown>) => ({ action: r.action, count: parseInt(r.count as string) })),
      topContributors: recentUsers.map((r: Record<string, unknown>) => ({
        user: r.changed_by,
        count: parseInt(r.count as string),
      })),
    });
  } catch (err) {
    console.error('Error fetching audit stats:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to fetch audit stats', 500);
  }
}
