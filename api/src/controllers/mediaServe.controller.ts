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

/** Paths must be under uhtd/, no traversal */
function isPathAllowed(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  const trimmed = path.trim();
  if (trimmed.includes('..')) return false;
  if (!trimmed.startsWith('uhtd/')) return false;
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
  if (!mediaFile) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const path = mediaFile.storagePath;
  if (!path?.startsWith('uhtd/') || path.includes('..')) {
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
