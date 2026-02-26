import { Pool } from 'pg';

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export async function getTenantApiKeyBySlug(slug: string): Promise<string | null> {
  if (!pool) return null;
  const result = await pool.query<{ api_key: string }>(
    'SELECT api_key FROM tenants WHERE slug = $1 AND status = $2',
    [slug, 'active']
  );
  return result.rows[0]?.api_key ?? null;
}
