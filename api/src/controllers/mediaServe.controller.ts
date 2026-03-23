/**
 * Public media serve - streams files from GCS.
 * No auth required. Used for branding (logos, icons) that must load in customer app.
 */

import { Request, Response } from 'express';
import { getStorageBucket } from '../config/firebase';
import * as mediaService from '../services/media.service';

const DEBUG_MEDIA = process.env.DEBUG_MEDIA_SERVE === 'true';

function setMediaHeaders(res: Response): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}

/** Paths must be under uhtd/ or tenants/, no traversal */
function isPathAllowed(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  const trimmed = path.trim();
  if (trimmed.includes('..')) return false;
  if (!trimmed.startsWith('uhtd/') && !trimmed.startsWith('tenants/')) return false;
  if (trimmed.length > 500) return false;
  return true;
}

export async function serveMedia(req: Request, res: Response): Promise<void> {
  setMediaHeaders(res);
  const path = (req.query.path as string) || '';
  if (!isPathAllowed(path)) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  try {
    const bucket = getStorageBucket();
    let file = bucket.file(path);

    let [exists] = await file.exists();
    if (!exists) {
      const altBucketName = bucket.name.endsWith('.firebasestorage.app')
        ? bucket.name.replace('.firebasestorage.app', '.appspot.com')
        : bucket.name.replace('.appspot.com', '.firebasestorage.app');
      const altBucket = (await import('../config/firebase')).getFirebaseStorage().bucket(altBucketName);
      const altFile = altBucket.file(path);
      const [altExists] = await altFile.exists();
      if (altExists) file = altFile;
      exists = altExists ?? false;
    }

    if (!exists) {
      console.warn('Media serve 404:', { path, bucket: bucket.name });
      res.status(404).json({ error: 'Not found' });
      return;
    }

    const [metadata] = await file.getMetadata();
    const contentType = metadata?.contentType || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h
    file.createReadStream().pipe(res);
  } catch (err) {
    console.error('Media serve error:', err);
    res.status(500).json({ error: 'Failed to serve file' });
  }
}

/** Serve by media file ID - looks up storage_path from DB (more reliable than path) */
export async function serveMediaById(req: Request, res: Response): Promise<void> {
  setMediaHeaders(res);
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: 'Missing id' });
    return;
  }

  const mediaFile = await mediaService.getFileById(id);
  // #region agent log
  console.log('[MEDIA_DEBUG] DB lookup', { id, found: !!mediaFile, storagePath: mediaFile?.storagePath });
  fetch('http://127.0.0.1:7244/ingest/a47da7ba-8944-40d5-a7b1-3ca8dd181a2c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'97b103'},body:JSON.stringify({sessionId:'97b103',location:'mediaServe.controller:serveMediaById:afterLookup',message:'DB lookup result',data:{id,found:!!mediaFile,storagePath:mediaFile?.storagePath},hypothesisId:'H2,H3,H5',timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!mediaFile) {
    const body: Record<string, unknown> = { error: 'Not found' };
    if (DEBUG_MEDIA) body.debug = { phase: 'db_lookup', id, found: false, hint: 'No media_files row for this id' };
    res.status(404).json(body);
    return;
  }

  const path = mediaFile.storagePath;
  const allowed = path?.startsWith('uhtd/') || path?.startsWith('tenants/');
  if (!path || !allowed || path.includes('..')) {
    // #region agent log
    fetch('http://127.0.0.1:7244/ingest/a47da7ba-8944-40d5-a7b1-3ca8dd181a2c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'97b103'},body:JSON.stringify({sessionId:'97b103',location:'mediaServe.controller:serveMediaById:pathRejected',message:'Path validation failed',data:{path,allowed},hypothesisId:'H5',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  try {
    const bucket = getStorageBucket();
    const file = bucket.file(path);

    let fileToServe = file;
    let [exists] = await file.exists();

    if (!exists) {
      const altBucketName = bucket.name.endsWith('.firebasestorage.app')
        ? bucket.name.replace('.firebasestorage.app', '.appspot.com')
        : bucket.name.replace('.appspot.com', '.firebasestorage.app');
      const altBucket = (await import('../config/firebase')).getFirebaseStorage().bucket(altBucketName);
      const altFile = altBucket.file(path);
      const [altExists] = await altFile.exists();
      if (altExists) {
        fileToServe = altFile;
        exists = true;
      }
    }

    // #region agent log
    console.log('[MEDIA_DEBUG] GCS check', { id, path, bucket: bucket.name, exists });
    fetch('http://127.0.0.1:7244/ingest/a47da7ba-8944-40d5-a7b1-3ca8dd181a2c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'97b103'},body:JSON.stringify({sessionId:'97b103',location:'mediaServe.controller:serveMediaById:gcsCheck',message:'GCS file existence',data:{id,path,bucket:bucket.name,exists},hypothesisId:'H3',timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!exists) {
      console.warn('Media serve 404 (by id):', { id, path, bucket: bucket.name });
      const body: Record<string, unknown> = { error: 'Not found' };
      if (DEBUG_MEDIA) body.debug = { phase: 'gcs_check', id, storagePath: path, bucket: bucket.name, exists: false, hint: 'File not in GCS at this path. Check Firebase Storage location vs DB storage_path.' };
      res.status(404).json(body);
      return;
    }

    const [metadata] = await fileToServe.getMetadata();
    const contentType = metadata?.contentType || mediaFile.mimeType || 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24h
    fileToServe.createReadStream().pipe(res);
  } catch (err) {
    console.error('Media serve error:', err);
    res.status(500).json({ error: 'Failed to serve file' });
  }
}

/**
 * Debug endpoint: GET /api/v1/media/debug/:id
 * Returns diagnostics for a media file ID. Only active when DEBUG_MEDIA_SERVE=true.
 * Use: set env var in Railway, deploy, then open https://your-api/api/v1/media/debug/{id} in browser.
 */
export async function debugMediaById(req: Request, res: Response): Promise<void> {
  setMediaHeaders(res);
  if (!DEBUG_MEDIA) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: 'Missing id' });
    return;
  }

  const mediaFile = await mediaService.getFileById(id);
  const result: Record<string, unknown> = {
    id,
    dbRecord: mediaFile ? { storagePath: mediaFile.storagePath, mimeType: mediaFile.mimeType } : null,
  };

  if (mediaFile) {
    const path = mediaFile.storagePath;
    const allowed = path?.startsWith('uhtd/') || path?.startsWith('tenants/');
    result.pathValidation = { path, allowed: !!allowed };

    try {
      const bucket = getStorageBucket();
      const file = bucket.file(path);
      let [exists] = await file.exists();
      let altExists = false;
      if (!exists) {
        const altBucketName = bucket.name.endsWith('.firebasestorage.app')
          ? bucket.name.replace('.firebasestorage.app', '.appspot.com')
          : bucket.name.replace('.appspot.com', '.firebasestorage.app');
        const altBucket = (await import('../config/firebase')).getFirebaseStorage().bucket(altBucketName);
        const [alt] = await altBucket.file(path).exists();
        altExists = alt;
        exists = alt;
      }
      result.gcsCheck = { bucket: bucket.name, exists, altBucketTried: !exists, altExists };
    } catch (err) {
      result.gcsCheck = { error: (err as Error).message };
    }
  }

  res.json(result);
}
