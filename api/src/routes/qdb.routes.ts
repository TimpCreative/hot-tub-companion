import { Router } from 'express';
import * as qdbController from '../controllers/qdb.controller';

const router = Router();

// Sections
router.get('/sections', qdbController.listSections);
router.post('/sections', qdbController.createSection);
router.put('/sections/:id', qdbController.updateSection);
router.delete('/sections/:id', qdbController.deleteSection);

// Brand Qualifiers
router.get('/qualifiers/for-brand/:brandId', qdbController.getQualifiersForBrand);
router.get('/brand-qualifiers/:brandId', qdbController.getBrandQualifiers);
router.put('/brand-qualifiers/:brandId', qdbController.setBrandQualifiers);

// Qualifier CRUD
router.get('/qualifiers', qdbController.listQualifiers);
router.get('/qualifiers/:id', qdbController.getQualifier);
router.post('/qualifiers', qdbController.createQualifier);
router.put('/qualifiers/:id', qdbController.updateQualifier);
router.delete('/qualifiers/:id', qdbController.deleteQualifier);

// Spa Qualifiers
router.get('/spa-qualifiers/:spaModelId', qdbController.getSpaQualifiers);
router.put('/spa-qualifiers/:spaModelId/:qualifierId', qdbController.setSpaQualifier);
router.delete('/spa-qualifiers/:spaModelId/:qualifierId', qdbController.removeSpaQualifier);

// Part Qualifiers
router.get('/part-qualifiers/:partId', qdbController.getPartQualifiers);
router.put('/part-qualifiers/:partId/:qualifierId', qdbController.setPartQualifier);
router.delete('/part-qualifiers/:partId/:qualifierId', qdbController.removePartQualifier);

export default router;
