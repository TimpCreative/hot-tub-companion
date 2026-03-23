/**
 * Media Service
 * Handles file storage in Firebase Storage and metadata in PostgreSQL
 */

import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { getStorageBucket } from '../config/firebase';

export interface MediaFile {
  id: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  publicUrl: string;
  entityType: string | null;
  entityId: string | null;
  fieldName: string | null;
  uploadedBy: string | null;
  createdAt: Date;
}

export interface UploadOptions {
  entityType?: string;
  entityId?: string;
  fieldName?: string;
  uploadedBy?: string;
}

export interface ListFilters {
  entityType?: string;
  mimeTypePrefix?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

function getContentTypeCategory(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'images';
  if (mimeType === 'application/pdf') return 'documents';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType === 'text/csv') return 'spreadsheets';
  if (mimeType.includes('document') || mimeType.includes('word')) return 'documents';
  return 'other';
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

export async function uploadFile(
  fileBuffer: Buffer,
  originalFilename: string,
  mimeType: string,
  options: UploadOptions = {}
): Promise<MediaFile> {
  dbg({ location: 'media.service.ts:pre-bucket', message: 'before getStorageBucket', hypothesisId: 'H1' });
  const bucket = getStorageBucket();
  dbg({ location: 'media.service.ts:post-bucket', message: 'after getStorageBucket', data: { bucketName: bucket?.name }, hypothesisId: 'H2' });
  const extension = originalFilename.split('.').pop() || '';
  const uniqueFilename = `${uuidv4()}.${extension}`;
  const category = getContentTypeCategory(mimeType);
  const storagePath = `uhtd/${category}/${uniqueFilename}`;
  
  const file = bucket.file(storagePath);
  
  await file.save(fileBuffer, {
    metadata: {
      contentType: mimeType,
      metadata: {
        originalFilename,
        entityType: options.entityType || '',
        entityId: options.entityId || '',
        fieldName: options.fieldName || '',
      },
    },
  });
  dbg({ location: 'media.service.ts:post-save', message: 'after file.save', hypothesisId: 'H2' });
  // Skip makePublic() — with uniform bucket-level access, per-object ACLs are disabled.
  // Configure the bucket for public read via IAM: add allUsers with Storage Object Viewer.
  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
  dbg({ location: 'media.service.ts:pre-db', message: 'before media_files insert', hypothesisId: 'H3' });
  const [mediaFile] = await db('media_files')
    .insert({
      filename: uniqueFilename,
      original_filename: originalFilename,
      mime_type: mimeType,
      file_size: fileBuffer.length,
      storage_path: storagePath,
      public_url: publicUrl,
      entity_type: options.entityType || null,
      entity_id: options.entityId || null,
      field_name: options.fieldName || null,
      uploaded_by: options.uploadedBy || null,
    })
    .returning('*');

  return mapToMediaFile(mediaFile);
}

export async function listFiles(filters: ListFilters = {}): Promise<{ files: MediaFile[]; total: number }> {
  const { entityType, mimeTypePrefix, search, page = 1, pageSize = 50 } = filters;

  let query = db('media_files');
  let countQuery = db('media_files');

  if (entityType) {
    query = query.where('entity_type', entityType);
    countQuery = countQuery.where('entity_type', entityType);
  }

  if (mimeTypePrefix) {
    query = query.where('mime_type', 'like', `${mimeTypePrefix}%`);
    countQuery = countQuery.where('mime_type', 'like', `${mimeTypePrefix}%`);
  }

  if (search) {
    query = query.where('original_filename', 'ilike', `%${search}%`);
    countQuery = countQuery.where('original_filename', 'ilike', `%${search}%`);
  }

  const [{ count }] = await countQuery.count('* as count');
  const total = parseInt(count as string, 10);

  const offset = (page - 1) * pageSize;
  const files = await query
    .orderBy('created_at', 'desc')
    .limit(pageSize)
    .offset(offset);

  return {
    files: files.map(mapToMediaFile),
    total,
  };
}

export async function getFileById(id: string): Promise<MediaFile | null> {
  const file = await db('media_files').where('id', id).first();
  return file ? mapToMediaFile(file) : null;
}

export async function deleteFile(id: string): Promise<boolean> {
  const file = await db('media_files').where('id', id).first();
  if (!file) return false;

  try {
    const bucket = getStorageBucket();
    await bucket.file(file.storage_path).delete();
  } catch (err) {
    console.warn('Failed to delete file from storage (may not exist):', err);
  }

  await db('media_files').where('id', id).delete();
  return true;
}

function mapToMediaFile(row: any): MediaFile {
  return {
    id: row.id,
    filename: row.filename,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    fileSize: row.file_size,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    entityType: row.entity_type,
    entityId: row.entity_id,
    fieldName: row.field_name,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}
