/**
 * Media Controller
 * Handles file upload, listing, and deletion endpoints
 */

import { Request, Response } from 'express';
import * as mediaService from '../services/media.service';
import * as dataSourceService from '../services/dataSource.service';
import { success, error } from '../utils/response';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MIN_FILE_SIZE = 1024; // 1KB

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

export async function uploadFile(req: Request, res: Response) {
  try {
    if (!req.file) {
      return error(res, 'VALIDATION_ERROR', 'No file provided', 400);
    }

    const { originalname, mimetype, buffer, size } = req.file;

    if (size < MIN_FILE_SIZE) {
      return error(res, 'VALIDATION_ERROR', `File too small. Minimum is ${MIN_FILE_SIZE} bytes.`, 400);
    }

    if (size > MAX_FILE_SIZE) {
      return error(res, 'VALIDATION_ERROR', 'File too large. Maximum size is 10MB', 400);
    }

    if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
      return error(res, 'VALIDATION_ERROR', `File type not allowed: ${mimetype}`, 400);
    }

    const { entityType, entityId, fieldName } = req.body;
    // uploaded_by is a UUID FK to users.id. Super admins don't have users rows; pass null.
    const uploadedBy = null;

    const mediaFile = await mediaService.uploadFile(buffer, originalname, mimetype, {
      entityType,
      entityId,
      fieldName,
      uploadedBy,
    });

    res.status(201);
    return success(res, mediaFile, 'File uploaded successfully');
  } catch (err) {
    console.error('Error uploading file:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to upload file', 500);
  }
}

export async function listFiles(req: Request, res: Response) {
  try {
    const { entityType, mimeType, search, page, pageSize } = req.query;

    const filters: mediaService.ListFilters = {
      entityType: entityType as string,
      mimeTypePrefix: mimeType as string,
      search: search as string,
      page: page ? parseInt(page as string, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize as string, 10) : 50,
    };

    const { files, total } = await mediaService.listFiles(filters);

    const pagination = {
      page: filters.page!,
      pageSize: filters.pageSize!,
      total,
      totalPages: Math.ceil(total / filters.pageSize!),
    };

    return success(res, files, undefined, pagination);
  } catch (err) {
    console.error('Error listing files:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to list files', 500);
  }
}

export async function getFile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const file = await mediaService.getFileById(id);

    if (!file) {
      return error(res, 'NOT_FOUND', 'File not found', 404);
    }

    return success(res, file);
  } catch (err) {
    console.error('Error getting file:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get file', 500);
  }
}

export async function deleteFile(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const deleted = await mediaService.deleteFile(id);

    if (!deleted) {
      return error(res, 'NOT_FOUND', 'File not found', 404);
    }

    return success(res, null, 'File deleted successfully');
  } catch (err) {
    console.error('Error deleting file:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to delete file', 500);
  }
}

export async function getDataSources(req: Request, res: Response) {
  try {
    const { search } = req.query;
    const dataSources = await dataSourceService.getDataSources(search as string);
    return success(res, dataSources);
  } catch (err) {
    console.error('Error getting data sources:', err);
    return error(res, 'INTERNAL_ERROR', 'Failed to get data sources', 500);
  }
}
