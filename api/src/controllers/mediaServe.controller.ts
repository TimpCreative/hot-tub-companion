/**
 * Public media serve - streams files from GCS.
 * No auth required. Used for branding (logos, icons) that must load in customer app.
 */

import { Request, Response } from 'express';
import { getStorageBucket } from '../config/firebase';

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
  const path = (req.query.path as string) || '';
  if (!isPathAllowed(path)) {
    res.status(400).json({ error: 'Invalid path' });
    return;
  }

  try {
    const bucket = getStorageBucket();
    const file = bucket.file(path);

    const [exists] = await file.exists();
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
