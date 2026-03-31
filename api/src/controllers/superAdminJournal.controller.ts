import { Request, Response } from 'express';
import { db } from '../config/database';
import { error, success } from '../utils/response';

const JOURNAL_BUCKETS = ['notes', 'ideas', 'archive'] as const;

type JournalBucket = (typeof JOURNAL_BUCKETS)[number];

type JournalEntryRow = {
  id: string;
  bucket: JournalBucket;
  sort_order: number;
  title: string;
  content: string;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

function isJournalBucket(value: unknown): value is JournalBucket {
  return typeof value === 'string' && JOURNAL_BUCKETS.includes(value as JournalBucket);
}

function formatEntry(row: JournalEntryRow) {
  return {
    id: row.id,
    bucket: row.bucket,
    sortOrder: row.sort_order,
    title: row.title,
    content: row.content,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getNextSortOrder(bucket: JournalBucket): Promise<number> {
  const row = await db('super_admin_journal_entries')
    .where({ bucket })
    .max<{ max?: string | number }>('sort_order as max')
    .first();

  if (!row?.max) {
    return 0;
  }

  return Number(row.max) + 1;
}

export async function listJournalEntries(_req: Request, res: Response): Promise<void> {
  const rows = await db('super_admin_journal_entries')
    .select('*')
    .orderBy([
      { column: 'bucket', order: 'asc' },
      { column: 'sort_order', order: 'asc' },
      { column: 'created_at', order: 'asc' },
    ]);

  success(res, { entries: rows.map((row) => formatEntry(row as JournalEntryRow)) });
}

export async function createJournalEntry(req: Request, res: Response): Promise<void> {
  const actor = (req as Request & { superAdminEmail?: string }).superAdminEmail ?? null;
  const body = (req.body || {}) as {
    bucket?: unknown;
    title?: unknown;
    content?: unknown;
  };

  const bucket = isJournalBucket(body.bucket) ? body.bucket : 'notes';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const content = typeof body.content === 'string' ? body.content.trim() : '';

  if (!title) {
    error(res, 'VALIDATION_ERROR', 'Title is required', 400);
    return;
  }

  const sortOrder = await getNextSortOrder(bucket);
  const [inserted] = await db('super_admin_journal_entries')
    .insert({
      bucket,
      sort_order: sortOrder,
      title,
      content,
      created_by: actor,
      updated_by: actor,
      updated_at: db.fn.now(),
    })
    .returning('*');

  res.status(201);
  success(res, { entry: formatEntry(inserted as JournalEntryRow) }, 'Journal entry created');
}

export async function updateJournalEntry(req: Request, res: Response): Promise<void> {
  const actor = (req as Request & { superAdminEmail?: string }).superAdminEmail ?? null;
  const { id } = req.params;
  const body = (req.body || {}) as {
    title?: unknown;
    content?: unknown;
    bucket?: unknown;
  };

  const existing = await db('super_admin_journal_entries').where({ id }).first();
  if (!existing) {
    error(res, 'NOT_FOUND', 'Journal entry not found', 404);
    return;
  }

  const updates: Record<string, unknown> = {
    updated_at: db.fn.now(),
    updated_by: actor,
  };

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || !body.title.trim()) {
      error(res, 'VALIDATION_ERROR', 'Title is required', 400);
      return;
    }
    updates.title = body.title.trim();
  }

  if (body.content !== undefined) {
    if (typeof body.content !== 'string') {
      error(res, 'VALIDATION_ERROR', 'Content must be a string', 400);
      return;
    }
    updates.content = body.content.trim();
  }

  if (body.bucket !== undefined) {
    if (!isJournalBucket(body.bucket)) {
      error(res, 'VALIDATION_ERROR', 'Bucket must be notes, ideas, or archive', 400);
      return;
    }

    if (body.bucket !== existing.bucket) {
      updates.bucket = body.bucket;
      updates.sort_order = await getNextSortOrder(body.bucket);
    }
  }

  const [updated] = await db('super_admin_journal_entries').where({ id }).update(updates).returning('*');
  success(res, { entry: formatEntry(updated as JournalEntryRow) }, 'Journal entry updated');
}

export async function deleteJournalEntry(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const deleted = await db('super_admin_journal_entries').where({ id }).delete();

  if (deleted === 0) {
    error(res, 'NOT_FOUND', 'Journal entry not found', 404);
    return;
  }

  success(res, { deleted: true }, 'Journal entry deleted');
}

export async function reorderJournalEntry(req: Request, res: Response): Promise<void> {
  const actor = (req as Request & { superAdminEmail?: string }).superAdminEmail ?? null;
  const { id } = req.params;
  const body = (req.body || {}) as {
    direction?: unknown;
  };

  const direction = body.direction;
  if (direction !== 'up' && direction !== 'down') {
    error(res, 'VALIDATION_ERROR', 'direction must be up or down', 400);
    return;
  }

  const entry = await db('super_admin_journal_entries').where({ id }).first();
  if (!entry) {
    error(res, 'NOT_FOUND', 'Journal entry not found', 404);
    return;
  }

  const comparison = direction === 'up' ? '<' : '>';
  const sortDirection = direction === 'up' ? 'desc' : 'asc';
  const neighbor = await db('super_admin_journal_entries')
    .where({ bucket: entry.bucket })
    .andWhere('sort_order', comparison, entry.sort_order)
    .orderBy('sort_order', sortDirection)
    .first();

  if (!neighbor) {
    success(res, { moved: false, entry: formatEntry(entry as JournalEntryRow) }, 'Journal entry already at boundary');
    return;
  }

  await db.transaction(async (trx) => {
    await trx('super_admin_journal_entries').where({ id: entry.id }).update({
      sort_order: neighbor.sort_order,
      updated_at: db.fn.now(),
      updated_by: actor,
    });
    await trx('super_admin_journal_entries').where({ id: neighbor.id }).update({
      sort_order: entry.sort_order,
      updated_at: db.fn.now(),
      updated_by: actor,
    });
  });

  const updated = await db('super_admin_journal_entries').where({ id }).first();
  success(res, { moved: true, entry: formatEntry(updated as JournalEntryRow) }, 'Journal entry reordered');
}
