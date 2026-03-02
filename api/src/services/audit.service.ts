/**
 * Audit Service
 * Handles audit logging for all UHTD modifications
 */

import { db } from '../config/database';
import { AuditLogEntry, AuditAction, PaginationParams } from '../types/uhtd.types';

export async function logAudit(
  tableName: string,
  recordId: string,
  action: AuditAction,
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null,
  changedBy?: string,
  changeReason?: string
): Promise<void> {
  try {
    await db('audit_log').insert({
      table_name: tableName,
      record_id: recordId,
      action,
      old_values: oldValues ? JSON.stringify(oldValues) : null,
      new_values: newValues ? JSON.stringify(newValues) : null,
      changed_by: changedBy,
      change_reason: changeReason,
    });
  } catch (error) {
    console.error('Failed to write audit log:', error);
  }
}

export async function getAuditLogs(
  filters: {
    tableName?: string;
    recordId?: string;
    action?: AuditAction;
    changedBy?: string;
    startDate?: Date;
    endDate?: Date;
  } = {},
  pagination?: PaginationParams
): Promise<{ logs: AuditLogEntry[]; total: number }> {
  const baseQuery = () => {
    let q = db('audit_log');
    if (filters.tableName) q = q.where('table_name', filters.tableName);
    if (filters.recordId) q = q.where('record_id', filters.recordId);
    if (filters.action) q = q.where('action', filters.action);
    if (filters.changedBy) q = q.where('changed_by', filters.changedBy);
    if (filters.startDate) q = q.where('changed_at', '>=', filters.startDate);
    if (filters.endDate) q = q.where('changed_at', '<=', filters.endDate);
    return q;
  };
  const countResult = await baseQuery().count('* as count').first();
  const total = parseInt((countResult?.count as string) ?? '0', 10);

  let query = baseQuery().select('*');
  const sortBy = pagination?.sortBy || 'changed_at';
  const sortOrder = pagination?.sortOrder || 'desc';
  query = query.orderBy(sortBy, sortOrder);

  if (pagination?.page && pagination?.pageSize) {
    const offset = (pagination.page - 1) * pagination.pageSize;
    query = query.offset(offset).limit(pagination.pageSize);
  }

  const rows = await query;
  const logs: AuditLogEntry[] = rows.map((row) => ({
    id: row.id,
    tableName: row.table_name,
    recordId: row.record_id,
    action: row.action,
    oldValues: row.old_values,
    newValues: row.new_values,
    changedBy: row.changed_by,
    changedAt: row.changed_at,
    changeReason: row.change_reason,
  }));

  return { logs, total };
}

export async function getAuditLogsForRecord(
  tableName: string,
  recordId: string
): Promise<AuditLogEntry[]> {
  const { logs } = await getAuditLogs(
    { tableName, recordId },
    { sortBy: 'changed_at', sortOrder: 'desc' }
  );
  return logs;
}
