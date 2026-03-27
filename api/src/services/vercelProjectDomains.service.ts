import { env, isVercelDomainAttachConfigured } from '../config/environment';

const VERCEL_API = 'https://api.vercel.com';

export type AddProjectDomainResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

/**
 * POST /v10/projects/{idOrName}/domains — add hostname to Vercel project.
 * 200: added. 400: often "already exists on this project" (idempotent). 409: conflict with another project (fail).
 */
export async function addProjectDomain(fullDomain: string): Promise<AddProjectDomainResult> {
  if (!isVercelDomainAttachConfigured()) {
    return { ok: false, status: 0, message: 'Vercel not configured' };
  }

  const projectId = encodeURIComponent(env.VERCEL_PROJECT_ID);
  const qs = new URLSearchParams();
  if (env.VERCEL_TEAM_ID) qs.set('teamId', env.VERCEL_TEAM_ID);

  const url = `${VERCEL_API}/v10/projects/${projectId}/domains${qs.toString() ? `?${qs}` : ''}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.VERCEL_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: fullDomain }),
    });

    if (res.ok) {
      return { ok: true };
    }

    const text = await res.text();
    let message = text.slice(0, 500);
    try {
      const j = JSON.parse(text) as { error?: { message?: string }; message?: string };
      message = j.error?.message || j.message || message;
    } catch {
      /* use text */
    }

    if (res.status === 400) {
      const lower = message.toLowerCase();
      if (
        lower.includes('already') ||
        lower.includes('exists') ||
        lower.includes('duplicate')
      ) {
        return { ok: true };
      }
    }

    return { ok: false, status: res.status, message: message || `HTTP ${res.status}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[vercelProjectDomains] addProjectDomain failed:', fullDomain, message);
    return { ok: false, status: 0, message };
  }
}
