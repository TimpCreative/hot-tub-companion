import { Router, type Request, type Response } from 'express';
import { env } from '../config/environment';

const router = Router();

function getDocsOrigin(): string {
  const raw = env.DOCS_SITE_ORIGIN.trim().replace(/\/+$/, '');
  return raw;
}

router.get('*', async (req: Request, res: Response) => {
  const origin = getDocsOrigin();
  if (!origin) {
    res.status(503).json({
      success: false,
      error: {
        code: 'DOCS_NOT_CONFIGURED',
        message: 'Public docs are unavailable. Set DOCS_SITE_ORIGIN to the docs app URL.',
      },
    });
    return;
  }

  const suffix = req.path === '/' ? '' : req.path;
  const target = `${origin}/docs${suffix}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;

  try {
    const upstream = await fetch(target, {
      method: 'GET',
      headers: {
        accept: req.headers.accept || '*/*',
        'user-agent': req.headers['user-agent'] || 'htc-docs-proxy',
      },
    });
    const body = await upstream.arrayBuffer();
    const contentType = upstream.headers.get('content-type') || 'text/html; charset=utf-8';
    res.status(upstream.status).setHeader('content-type', contentType).send(Buffer.from(body));
  } catch (err) {
    res.status(502).json({
      success: false,
      error: {
        code: 'DOCS_PROXY_ERROR',
        message: err instanceof Error ? err.message : 'Unable to load docs app',
      },
    });
  }
});

export default router;
