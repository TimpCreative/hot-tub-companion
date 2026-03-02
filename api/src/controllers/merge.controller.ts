import { Request, Response } from 'express';
import { db } from '../config/database';
import { success, error } from '../utils/response';
import { logAudit } from '../services/audit.service';
import { AuditAction } from '../types/uhtd.types';

interface MergeRequest {
  targetId: string;
  sourceIds: string[];
}

interface MergePreviewResult {
  target: { id: string; name: string };
  sources: { id: string; name: string }[];
  affectedCounts: Record<string, number>;
}

/**
 * Preview what will be affected when merging brands
 */
export async function previewBrandMerge(req: Request, res: Response) {
  try {
    const { targetId, sourceIds } = req.body as MergeRequest;

    if (!targetId || !sourceIds || sourceIds.length === 0) {
      return error(res, 'VALIDATION_ERROR', 'targetId and sourceIds are required', 400);
    }

    const target = await db('scdb_brands').where('id', targetId).whereNull('deleted_at').first();
    if (!target) {
      return error(res, 'NOT_FOUND', 'Target brand not found', 404);
    }

    const sources = await db('scdb_brands').whereIn('id', sourceIds).whereNull('deleted_at');
    if (sources.length !== sourceIds.length) {
      return error(res, 'NOT_FOUND', 'One or more source brands not found', 404);
    }

    const modelLinesCount = await db('scdb_model_lines')
      .whereIn('brand_id', sourceIds)
      .whereNull('deleted_at')
      .count('id as count')
      .first();

    const spaModelsCount = await db('scdb_spa_models')
      .whereIn('brand_id', sourceIds)
      .whereNull('deleted_at')
      .count('id as count')
      .first();

    const visibilityCount = await db('tenant_brand_visibility')
      .whereIn('brand_id', sourceIds)
      .count('brand_id as count')
      .first();

    const result: MergePreviewResult = {
      target: { id: target.id, name: target.name },
      sources: sources.map((s: any) => ({ id: s.id, name: s.name })),
      affectedCounts: {
        modelLines: parseInt(modelLinesCount?.count as string) || 0,
        spaModels: parseInt(spaModelsCount?.count as string) || 0,
        visibilityRecords: parseInt(visibilityCount?.count as string) || 0,
      },
    };

    success(res, result, 'Brand merge preview');
  } catch (err) {
    console.error('Error previewing brand merge:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to preview brand merge', 500);
  }
}

/**
 * Merge multiple brands into a target brand
 */
export async function mergeBrands(req: Request, res: Response) {
  try {
    const { targetId, sourceIds } = req.body as MergeRequest;
    const userId = (req as any).superAdminEmail;

    if (!targetId || !sourceIds || sourceIds.length === 0) {
      return error(res, 'VALIDATION_ERROR', 'targetId and sourceIds are required', 400);
    }

    if (sourceIds.includes(targetId)) {
      return error(res, 'VALIDATION_ERROR', 'Target cannot be in source list', 400);
    }

    const target = await db('scdb_brands').where('id', targetId).whereNull('deleted_at').first();
    if (!target) {
      return error(res, 'NOT_FOUND', 'Target brand not found', 404);
    }

    const result = await db.transaction(async (trx) => {
      let modelLinesUpdated = 0;
      let spaModelsUpdated = 0;
      let visibilityUpdated = 0;

      // 1. Update model_lines to point to target brand
      modelLinesUpdated = await trx('scdb_model_lines')
        .whereIn('brand_id', sourceIds)
        .update({ brand_id: targetId, updated_at: new Date() });

      // 2. Update spa_models to point to target brand
      spaModelsUpdated = await trx('scdb_spa_models')
        .whereIn('brand_id', sourceIds)
        .update({ brand_id: targetId, updated_at: new Date() });

      // 3. Handle tenant_brand_visibility conflicts
      // Delete rows that would create duplicate (tenant_id, brand_id)
      await trx('tenant_brand_visibility')
        .whereIn('brand_id', sourceIds)
        .whereExists(
          trx('tenant_brand_visibility as tbv2')
            .select('*')
            .where('tbv2.brand_id', targetId)
            .whereRaw('tbv2.tenant_id = tenant_brand_visibility.tenant_id')
        )
        .delete();

      // Update remaining visibility rows
      visibilityUpdated = await trx('tenant_brand_visibility')
        .whereIn('brand_id', sourceIds)
        .update({ brand_id: targetId });

      // 4. Soft-delete source brands
      await trx('scdb_brands')
        .whereIn('id', sourceIds)
        .update({ deleted_at: new Date(), updated_at: new Date() });

      // 5. Log audit
      for (const sourceId of sourceIds) {
        await logAudit(
          'scdb_brands',
          sourceId,
          'DELETE' as AuditAction,
          { merged_into: targetId },
          null,
          userId
        );
      }

      return { modelLinesUpdated, spaModelsUpdated, visibilityUpdated, brandsDeleted: sourceIds.length };
    });

    success(res, result, `Merged ${sourceIds.length} brands into "${target.name}"`);
  } catch (err) {
    console.error('Error merging brands:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to merge brands', 500);
  }
}

/**
 * Preview what will be affected when merging model lines
 */
export async function previewModelLineMerge(req: Request, res: Response) {
  try {
    const { targetId, sourceIds } = req.body as MergeRequest;

    if (!targetId || !sourceIds || sourceIds.length === 0) {
      return error(res, 'VALIDATION_ERROR', 'targetId and sourceIds are required', 400);
    }

    const target = await db('scdb_model_lines').where('id', targetId).whereNull('deleted_at').first();
    if (!target) {
      return error(res, 'NOT_FOUND', 'Target model line not found', 404);
    }

    const sources = await db('scdb_model_lines').whereIn('id', sourceIds).whereNull('deleted_at');
    if (sources.length !== sourceIds.length) {
      return error(res, 'NOT_FOUND', 'One or more source model lines not found', 404);
    }

    const spaModelsCount = await db('scdb_spa_models')
      .whereIn('model_line_id', sourceIds)
      .whereNull('deleted_at')
      .count('id as count')
      .first();

    const result: MergePreviewResult = {
      target: { id: target.id, name: target.name },
      sources: sources.map((s: any) => ({ id: s.id, name: s.name })),
      affectedCounts: {
        spaModels: parseInt(spaModelsCount?.count as string) || 0,
      },
    };

    success(res, result, 'Model line merge preview');
  } catch (err) {
    console.error('Error previewing model line merge:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to preview model line merge', 500);
  }
}

/**
 * Merge multiple model lines into a target model line
 */
export async function mergeModelLines(req: Request, res: Response) {
  try {
    const { targetId, sourceIds } = req.body as MergeRequest;
    const userId = (req as any).superAdminEmail;

    if (!targetId || !sourceIds || sourceIds.length === 0) {
      return error(res, 'VALIDATION_ERROR', 'targetId and sourceIds are required', 400);
    }

    if (sourceIds.includes(targetId)) {
      return error(res, 'VALIDATION_ERROR', 'Target cannot be in source list', 400);
    }

    const target = await db('scdb_model_lines').where('id', targetId).whereNull('deleted_at').first();
    if (!target) {
      return error(res, 'NOT_FOUND', 'Target model line not found', 404);
    }

    const result = await db.transaction(async (trx) => {
      // 1. Update spa_models to point to target model line
      const spaModelsUpdated = await trx('scdb_spa_models')
        .whereIn('model_line_id', sourceIds)
        .update({ model_line_id: targetId, updated_at: new Date() });

      // 2. Soft-delete source model lines
      await trx('scdb_model_lines')
        .whereIn('id', sourceIds)
        .update({ deleted_at: new Date(), updated_at: new Date() });

      // 3. Log audit
      for (const sourceId of sourceIds) {
        await logAudit(
          'scdb_model_lines',
          sourceId,
          'DELETE' as AuditAction,
          { merged_into: targetId },
          null,
          userId
        );
      }

      return { spaModelsUpdated, modelLinesDeleted: sourceIds.length };
    });

    success(res, result, `Merged ${sourceIds.length} model lines into "${target.name}"`);
  } catch (err) {
    console.error('Error merging model lines:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to merge model lines', 500);
  }
}

/**
 * Preview what will be affected when merging spa models
 */
export async function previewSpaMerge(req: Request, res: Response) {
  try {
    const { targetId, sourceIds } = req.body as MergeRequest;

    if (!targetId || !sourceIds || sourceIds.length === 0) {
      return error(res, 'VALIDATION_ERROR', 'targetId and sourceIds are required', 400);
    }

    const target = await db('scdb_spa_models').where('id', targetId).whereNull('deleted_at').first();
    if (!target) {
      return error(res, 'NOT_FOUND', 'Target spa not found', 404);
    }

    const sources = await db('scdb_spa_models').whereIn('id', sourceIds).whereNull('deleted_at');
    if (sources.length !== sourceIds.length) {
      return error(res, 'NOT_FOUND', 'One or more source spas not found', 404);
    }

    const compatibilityCount = await db('part_spa_compatibility')
      .whereIn('spa_model_id', sourceIds)
      .count('spa_model_id as count')
      .first();

    const compSpasCount = await db('comp_spas')
      .whereIn('spa_model_id', sourceIds)
      .count('spa_model_id as count')
      .first();

    const qualifiersCount = await db('qdb_spa_qualifiers')
      .whereIn('spa_model_id', sourceIds)
      .count('spa_model_id as count')
      .first();

    const electricalCount = await db('scdb_spa_electrical_configs')
      .whereIn('spa_model_id', sourceIds)
      .count('spa_model_id as count')
      .first();

    const profilesCount = await db('spa_profiles')
      .whereIn('uhtd_spa_model_id', sourceIds)
      .count('uhtd_spa_model_id as count')
      .first();

    const result: MergePreviewResult = {
      target: { id: target.id, name: `${target.name} (${target.year})` },
      sources: sources.map((s: any) => ({ id: s.id, name: `${s.name} (${s.year})` })),
      affectedCounts: {
        partCompatibility: parseInt(compatibilityCount?.count as string) || 0,
        compSpas: parseInt(compSpasCount?.count as string) || 0,
        qualifiers: parseInt(qualifiersCount?.count as string) || 0,
        electricalConfigs: parseInt(electricalCount?.count as string) || 0,
        spaProfiles: parseInt(profilesCount?.count as string) || 0,
      },
    };

    success(res, result, 'Spa merge preview');
  } catch (err) {
    console.error('Error previewing spa merge:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to preview spa merge', 500);
  }
}

/**
 * Merge multiple spa models into a target spa model
 */
export async function mergeSpas(req: Request, res: Response) {
  try {
    const { targetId, sourceIds } = req.body as MergeRequest;
    const userId = (req as any).superAdminEmail;

    if (!targetId || !sourceIds || sourceIds.length === 0) {
      return error(res, 'VALIDATION_ERROR', 'targetId and sourceIds are required', 400);
    }

    if (sourceIds.includes(targetId)) {
      return error(res, 'VALIDATION_ERROR', 'Target cannot be in source list', 400);
    }

    const target = await db('scdb_spa_models').where('id', targetId).whereNull('deleted_at').first();
    if (!target) {
      return error(res, 'NOT_FOUND', 'Target spa not found', 404);
    }

    const result = await db.transaction(async (trx) => {
      let compatibilityUpdated = 0;
      let compSpasUpdated = 0;
      let qualifiersUpdated = 0;
      let electricalUpdated = 0;
      let profilesUpdated = 0;

      // 1. Handle part_spa_compatibility (composite PK - delete duplicates first)
      await trx('part_spa_compatibility')
        .whereIn('spa_model_id', sourceIds)
        .whereExists(
          trx('part_spa_compatibility as psc2')
            .select('*')
            .where('psc2.spa_model_id', targetId)
            .whereRaw('psc2.part_id = part_spa_compatibility.part_id')
        )
        .delete();

      compatibilityUpdated = await trx('part_spa_compatibility')
        .whereIn('spa_model_id', sourceIds)
        .update({ spa_model_id: targetId });

      // 2. Handle comp_spas (composite PK - delete duplicates first)
      await trx('comp_spas')
        .whereIn('spa_model_id', sourceIds)
        .whereExists(
          trx('comp_spas as cs2')
            .select('*')
            .where('cs2.spa_model_id', targetId)
            .whereRaw('cs2.comp_id = comp_spas.comp_id')
        )
        .delete();

      compSpasUpdated = await trx('comp_spas')
        .whereIn('spa_model_id', sourceIds)
        .update({ spa_model_id: targetId });

      // 3. Handle qdb_spa_qualifiers (composite PK - delete duplicates first)
      await trx('qdb_spa_qualifiers')
        .whereIn('spa_model_id', sourceIds)
        .whereExists(
          trx('qdb_spa_qualifiers as qsq2')
            .select('*')
            .where('qsq2.spa_model_id', targetId)
            .whereRaw('qsq2.qualifier_id = qdb_spa_qualifiers.qualifier_id')
        )
        .delete();

      qualifiersUpdated = await trx('qdb_spa_qualifiers')
        .whereIn('spa_model_id', sourceIds)
        .update({ spa_model_id: targetId });

      // 4. Update scdb_spa_electrical_configs directly
      electricalUpdated = await trx('scdb_spa_electrical_configs')
        .whereIn('spa_model_id', sourceIds)
        .update({ spa_model_id: targetId });

      // 5. Update spa_profiles directly
      profilesUpdated = await trx('spa_profiles')
        .whereIn('uhtd_spa_model_id', sourceIds)
        .update({ uhtd_spa_model_id: targetId });

      // 6. Soft-delete source spas
      await trx('scdb_spa_models')
        .whereIn('id', sourceIds)
        .update({ deleted_at: new Date(), updated_at: new Date() });

      // 7. Log audit
      for (const sourceId of sourceIds) {
        await logAudit(
          'scdb_spa_models',
          sourceId,
          'DELETE' as AuditAction,
          { merged_into: targetId },
          null,
          userId
        );
      }

      return {
        compatibilityUpdated,
        compSpasUpdated,
        qualifiersUpdated,
        electricalUpdated,
        profilesUpdated,
        spasDeleted: sourceIds.length,
      };
    });

    success(res, result, `Merged ${sourceIds.length} spas into "${target.name} (${target.year})"`);
  } catch (err) {
    console.error('Error merging spas:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to merge spas', 500);
  }
}
