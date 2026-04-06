import { Pool } from 'pg';

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export type TenantKeyLookup = { apiKey: string | null; dbError: string | null };

/**
 * Resolves tenant API key by slug. Never throws — avoids empty-body 500s on Vercel when DB is down or misconfigured.
 */
export async function getTenantApiKeyBySlugSafe(slug: string): Promise<TenantKeyLookup> {
  if (!pool) {
    console.error('[db] DATABASE_URL is not set; tenant slug lookup skipped');
    return {
      apiKey: null,
      dbError: 'DATABASE_URL is not configured on this deployment',
    };
  }
  try {
    const result = await pool.query<{ api_key: string }>(
      'SELECT api_key FROM tenants WHERE slug = $1 AND status = $2',
      [slug, 'active']
    );
    return { apiKey: result.rows[0]?.api_key ?? null, dbError: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[db] getTenantApiKeyBySlug failed:', msg);
    return { apiKey: null, dbError: msg };
  }
}

export async function getTenantApiKeyBySlug(slug: string): Promise<string | null> {
  const { apiKey } = await getTenantApiKeyBySlugSafe(slug);
  return apiKey;
}
