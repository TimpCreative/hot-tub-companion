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

function getUploadedBy(req: Request): string | null {
  // authMiddleware attaches req.user from the `users` row
  return ((req as any).user?.email as string | undefined) ?? null;
}

export async function uploadBrandingMedia(req: Request, res: Response): Promise<void> {
  if (!requireManageSettings(req, res)) return;

  const tenantId = (req as any).tenant?.id as string | undefined;
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
    const publicFile = await mediaService.uploadFile(file.buffer, file.originalname, mimetype, {
      entityType: 'tenant',
      entityId: tenantId,
      fieldName: column,
      uploadedBy: getUploadedBy(req) || undefined,
    });

    await db('tenants').where({ id: tenantId }).update({ [column]: publicFile.publicUrl });

    success(res, { publicUrl: publicFile.publicUrl }, 'Branding media uploaded');
  } catch (err) {
    console.error('Error uploading branding media:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to upload branding media', 500);
  }
}

