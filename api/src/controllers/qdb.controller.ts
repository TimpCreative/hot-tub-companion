import { Request, Response } from 'express';
import * as qdbService from '../services/qdb.service';
import { success, error } from '../utils/response';

// Qualifier CRUD
export async function listQualifiers(req: Request, res: Response) {
  try {
    const qualifiers = await qdbService.getAllQualifiers();
    success(res, qualifiers);
  } catch (err) {
    console.error('Error listing qualifiers:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to list qualifiers', 500);
  }
}

export async function getQualifier(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const qualifier = await qdbService.getQualifierById(id);
    if (!qualifier) {
      return error(res, 'NOT_FOUND', 'Qualifier not found', 404);
    }
    success(res, qualifier);
  } catch (err) {
    console.error('Error getting qualifier:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to get qualifier', 500);
  }
}

export async function createQualifier(req: Request, res: Response) {
  try {
    const userId = (req as any).superAdminEmail;
    const { name, displayName, description, dataType, allowedValues, appliesTo } = req.body;

    if (!name || !displayName || !dataType || !appliesTo) {
      return error(res, 'VALIDATION_ERROR', 'Name, displayName, dataType, and appliesTo are required', 400);
    }

    const qualifier = await qdbService.createQualifier(
      { name, displayName, description, dataType, allowedValues, appliesTo },
      userId
    );

    success(res, qualifier, 'Qualifier created successfully');
  } catch (err: any) {
    console.error('Error creating qualifier:', err);
    if (err.code === '23505') {
      return error(res, 'CONFLICT', 'Qualifier with this name already exists', 409);
    }
    error(res, 'INTERNAL_ERROR', 'Failed to create qualifier', 500);
  }
}

export async function updateQualifier(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).superAdminEmail;
    const { displayName, description, dataType, allowedValues, appliesTo } = req.body;

    const qualifier = await qdbService.updateQualifier(
      id,
      { displayName, description, dataType, allowedValues, appliesTo },
      userId
    );

    if (!qualifier) {
      return error(res, 'NOT_FOUND', 'Qualifier not found', 404);
    }

    success(res, qualifier, 'Qualifier updated successfully');
  } catch (err) {
    console.error('Error updating qualifier:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to update qualifier', 500);
  }
}

export async function deleteQualifier(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = (req as any).superAdminEmail;

    const deleted = await qdbService.deleteQualifier(id, userId);
    if (!deleted) {
      return error(res, 'NOT_FOUND', 'Qualifier not found', 404);
    }

    success(res, { id }, 'Qualifier deleted successfully');
  } catch (err) {
    console.error('Error deleting qualifier:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to delete qualifier', 500);
  }
}

// Spa Qualifiers
export async function getSpaQualifiers(req: Request, res: Response) {
  try {
    const { spaModelId } = req.params;
    const qualifiers = await qdbService.getSpaQualifiers(spaModelId);
    success(res, qualifiers);
  } catch (err) {
    console.error('Error getting spa qualifiers:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to get spa qualifiers', 500);
  }
}

export async function setSpaQualifier(req: Request, res: Response) {
  try {
    const { spaModelId, qualifierId } = req.params;
    const { value } = req.body;
    const userId = (req as any).superAdminEmail;

    if (value === undefined) {
      return error(res, 'VALIDATION_ERROR', 'Value is required', 400);
    }

    const result = await qdbService.setSpaQualifier(spaModelId, qualifierId, value, userId);
    success(res, result, 'Spa qualifier set successfully');
  } catch (err) {
    console.error('Error setting spa qualifier:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to set spa qualifier', 500);
  }
}

export async function removeSpaQualifier(req: Request, res: Response) {
  try {
    const { spaModelId, qualifierId } = req.params;
    const userId = (req as any).superAdminEmail;

    const removed = await qdbService.removeSpaQualifier(spaModelId, qualifierId, userId);
    if (!removed) {
      return error(res, 'NOT_FOUND', 'Spa qualifier not found', 404);
    }

    success(res, null, 'Spa qualifier removed successfully');
  } catch (err) {
    console.error('Error removing spa qualifier:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to remove spa qualifier', 500);
  }
}

// Part Qualifiers
export async function getPartQualifiers(req: Request, res: Response) {
  try {
    const { partId } = req.params;
    const qualifiers = await qdbService.getPartQualifiers(partId);
    success(res, qualifiers);
  } catch (err) {
    console.error('Error getting part qualifiers:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to get part qualifiers', 500);
  }
}

export async function setPartQualifier(req: Request, res: Response) {
  try {
    const { partId, qualifierId } = req.params;
    const { value, isRequired } = req.body;
    const userId = (req as any).superAdminEmail;

    if (value === undefined) {
      return error(res, 'VALIDATION_ERROR', 'Value is required', 400);
    }

    const result = await qdbService.setPartQualifier(
      partId,
      qualifierId,
      value,
      isRequired ?? false,
      userId
    );
    success(res, result, 'Part qualifier set successfully');
  } catch (err) {
    console.error('Error setting part qualifier:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to set part qualifier', 500);
  }
}

export async function removePartQualifier(req: Request, res: Response) {
  try {
    const { partId, qualifierId } = req.params;
    const userId = (req as any).superAdminEmail;

    const removed = await qdbService.removePartQualifier(partId, qualifierId, userId);
    if (!removed) {
      return error(res, 'NOT_FOUND', 'Part qualifier not found', 404);
    }

    success(res, null, 'Part qualifier removed successfully');
  } catch (err) {
    console.error('Error removing part qualifier:', err);
    error(res, 'INTERNAL_ERROR', 'Failed to remove part qualifier', 500);
  }
}
