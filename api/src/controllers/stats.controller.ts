import { Request, Response } from 'express';
import db from '../db';
import { success, error } from '../utils/response';

export async function getUhtdStats(req: Request, res: Response) {
  try {
    const [brandsCount] = await db('scdb_brands').whereNull('deleted_at').count('* as count');
    const [modelLinesCount] = await db('scdb_model_lines').whereNull('deleted_at').count('* as count');
    const [spaModelsCount] = await db('scdb_spa_models').whereNull('deleted_at').count('* as count');
    const [partsCount] = await db('pcdb_parts').whereNull('deleted_at').count('* as count');
    const [categoriesCount] = await db('pcdb_categories').whereNull('deleted_at').count('* as count');
    const [compsCount] = await db('compatibility_groups').count('* as count');
    const [pendingCount] = await db('part_spa_compatibility').where('status', 'pending').count('* as count');
    const [confirmedCount] = await db('part_spa_compatibility').where('status', 'confirmed').count('* as count');

    const recentBrands = await db('scdb_brands')
      .whereNull('deleted_at')
      .orderBy('created_at', 'desc')
      .limit(5)
      .select('id', 'name', 'created_at');

    const recentParts = await db('pcdb_parts')
      .whereNull('deleted_at')
      .orderBy('created_at', 'desc')
      .limit(5)
      .select('id', 'name', 'created_at');

    success(res, {
      scdb: {
        brands: parseInt(brandsCount.count as string),
        modelLines: parseInt(modelLinesCount.count as string),
        spaModels: parseInt(spaModelsCount.count as string),
      },
      pcdb: {
        parts: parseInt(partsCount.count as string),
        categories: parseInt(categoriesCount.count as string),
      },
      compatibility: {
        comps: parseInt(compsCount.count as string),
        pending: parseInt(pendingCount.count as string),
        confirmed: parseInt(confirmedCount.count as string),
      },
      recent: {
        brands: recentBrands.map((b) => ({ id: b.id, name: b.name, createdAt: b.created_at })),
        parts: recentParts.map((p) => ({ id: p.id, name: p.name, createdAt: p.created_at })),
      },
    });
  } catch (err) {
    console.error('Error fetching UHTD stats:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to fetch UHTD stats', 500);
  }
}

export async function searchUhtd(req: Request, res: Response) {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.length < 2) {
      return success(res, { brands: [], parts: [], spas: [], comps: [] });
    }

    const searchTerm = `%${q}%`;

    const brands = await db('scdb_brands')
      .whereNull('deleted_at')
      .where('name', 'ilike', searchTerm)
      .limit(5)
      .select('id', 'name');

    const parts = await db('pcdb_parts')
      .whereNull('deleted_at')
      .where((qb) => {
        qb.where('name', 'ilike', searchTerm).orWhere('part_number', 'ilike', searchTerm);
      })
      .limit(5)
      .select('id', 'name', 'part_number');

    const spas = await db('scdb_spa_models as sm')
      .select('sm.id', 'sm.model_name', 'sm.model_year', 'b.name as brand_name')
      .leftJoin('scdb_model_lines as ml', 'sm.model_line_id', 'ml.id')
      .leftJoin('scdb_brands as b', 'ml.brand_id', 'b.id')
      .whereNull('sm.deleted_at')
      .where((qb) => {
        qb.where('sm.model_name', 'ilike', searchTerm).orWhere('b.name', 'ilike', searchTerm);
      })
      .limit(5);

    const comps = await db('compatibility_groups')
      .where((qb) => {
        qb.where('id', 'ilike', searchTerm).orWhere('name', 'ilike', searchTerm);
      })
      .limit(5)
      .select('id', 'name');

    success(res, {
      brands: brands.map((b) => ({ id: b.id, name: b.name, type: 'brand' })),
      parts: parts.map((p) => ({
        id: p.id,
        name: p.name,
        partNumber: p.part_number,
        type: 'part',
      })),
      spas: spas.map((s) => ({
        id: s.id,
        name: `${s.brand_name} ${s.model_name} ${s.model_year}`,
        type: 'spa',
      })),
      comps: comps.map((c) => ({ id: c.id, name: c.name, type: 'comp' })),
    });
  } catch (err) {
    console.error('Error searching UHTD:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to search', 500);
  }
}
