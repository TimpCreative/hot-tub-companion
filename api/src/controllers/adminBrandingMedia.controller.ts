import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import * as mediaService from '../services/media.service';

const MIN_FILE_SIZE_BYTES = 1024; // 1KB
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB (matches existing media limits)

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

function requireManageSettings(req: Request, res: Response): boolean {
  const role = (req as any).adminRole as Record<string, unknown> | undefined;
  const allowed = !!role && role.can_manage_settings === true;
  if (!allowed) {
    error(res, 'FORBIDDEN', 'Missing permission: can_manage_settings', 403);
    return false;
  }
  return true;
}

function getUploadedById(req: Request): string | null {
  // authMiddleware attaches req.user from the `users` row. uploaded_by expects users.id (UUID).
  // Whitelisted admins have synthetic id like 'admin_xxx' — pass null for them.
  const user = (req as any).user;
  if (!user?.id || typeof user.id !== 'string') return null;
  const id = user.id as string;
  // users.id is UUID; whitelisted admins use 'admin_xxx' and must not be stored in FK column
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  return id;
}

function dbg(payload: Record<string, unknown>) {
  // #region agent log
  fetch('http://127.0.0.1:7244/ingest/a47da7ba-8944-40d5-a7b1-3ca8dd181a2c', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '97b103' },
    body: JSON.stringify({ sessionId: '97b103', ...payload, timestamp: Date.now() }),
  }).catch(() => {});
  // #endregion
}

export async function uploadBrandingMedia(req: Request, res: Response): Promise<void> {
  if (!requireManageSettings(req, res)) return;

  const tenantId = (req as any).tenant?.id as string | undefined;
  dbg({
    location: 'adminBrandingMedia.controller.ts:entry',
    message: 'uploadBrandingMedia reached',
    data: { tenantId, hasFile: !!(req as any).file, fieldName: (req.body?.fieldName as string) ?? '' },
    hypothesisId: 'H5',
  });
  if (!tenantId) {
    error(res, 'UNAUTHORIZED', 'Tenant context required', 401);
    return;
  }

  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) {
    error(res, 'VALIDATION_ERROR', 'No file provided', 400);
    return;
  }

  if (file.size < MIN_FILE_SIZE_BYTES) {
    error(res, 'VALIDATION_ERROR', `File too small. Minimum is ${MIN_FILE_SIZE_BYTES} bytes.`, 400);
    return;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    error(res, 'VALIDATION_ERROR', `File too large. Maximum is ${MAX_FILE_SIZE_BYTES} bytes.`, 400);
    return;
  }

  const mimetype = file.mimetype;
  if (!ALLOWED_MIME_TYPES.has(mimetype)) {
    error(res, 'VALIDATION_ERROR', `File type not allowed: ${mimetype}`, 400);
    return;
  }

  const fieldName = (req.body?.fieldName as string | undefined) ?? '';
  // Only allow updating the branding logo fields.
  const column =
    fieldName === 'logo_url' ? 'logo_url' : fieldName === 'icon_url' ? 'icon_url' : null;

  if (!column) {
    error(res, 'VALIDATION_ERROR', 'Invalid fieldName. Use logo_url or icon_url.', 400);
    return;
  }

  try {
    // Multer memoryStorage provides `buffer`.
    dbg({
      location: 'adminBrandingMedia.controller.ts:pre-upload',
      message: 'before mediaService.uploadFile',
      data: { tenantId, column, fileSize: file.buffer?.length },
      hypothesisId: 'H1,H2,H3',
    });
    const publicFile = await mediaService.uploadFile(file.buffer, file.originalname, mimetype, {
      entityType: 'tenant',
      entityId: tenantId,
      fieldName: column,
      uploadedBy: getUploadedById(req) || undefined,
    });
    dbg({
      location: 'adminBrandingMedia.controller.ts:post-upload',
      message: 'after uploadFile, before tenants update',
      data: { publicUrl: publicFile?.publicUrl },
      hypothesisId: 'H4',
    });
    await db('tenants').where({ id: tenantId }).update({ [column]: publicFile.publicUrl });

    success(res, { publicUrl: publicFile.publicUrl }, 'Branding media uploaded');
  } catch (err: unknown) {
    const ex = err as Error & { code?: string };
    dbg({
      location: 'adminBrandingMedia.controller.ts:catch',
      message: 'upload error',
      data: {
        errName: ex?.name,
        errMessage: ex?.message,
        errCode: ex?.code,
        errStack: ex?.stack?.slice(0, 300),
      },
      hypothesisId: 'H1,H2,H3,H4',
    });
    console.error('Error uploading branding media:', err);
    const msg = ex?.message ?? String(err);
    error(res, 'INTERNAL_ERROR', 'Failed to upload branding media', 500, {
      hint: msg.slice(0, 200),
    });
  }
}

