/**
 * Public media serve - streams files from GCS.
 * No auth required. Used for branding (logos, icons) that must load in customer app.
 */

import { Request, Response } from 'express';
import { getStorageBucket } from '../config/firebase';
import * as mediaService from '../services/media.service';

function setCors(res: Response): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
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
  setCors(res);
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
  setCors(res);
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
    res.status(404).json({ error: 'Not found' });
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
      res.status(404).json({ error: 'Not found' });
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
