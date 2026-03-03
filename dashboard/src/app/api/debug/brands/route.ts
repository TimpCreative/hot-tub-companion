/**
 * Temporary debug route to see raw brands from DB.
 * DELETE THIS FILE after debugging.
 * GET /api/debug/brands
 */
import { NextResponse } from 'next/server';
import { Pool } from 'pg';

export async function GET() {
  const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL })
    : null;
  if (!pool) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 });
  }
  try {
    const result = await pool.query(
      'SELECT * FROM scdb_brands WHERE deleted_at IS NULL ORDER BY name'
    );
    const rows = result.rows;
    return NextResponse.json({
      rawRows: rows,
      count: rows.length,
      sampleApiResponse: {
        success: true,
        data: rows.map((r: Record<string, unknown>) => ({
          id: r.id,
          name: r.name,
          logoUrl: r.logo_url,
          websiteUrl: r.website_url,
          isActive: r.is_active,
          createdAt: r.created_at,
        })),
        pagination: { page: 1, pageSize: 25, total: rows.length, totalPages: 1 },
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
