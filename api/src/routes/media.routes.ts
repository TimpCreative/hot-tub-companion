import { Router } from 'express';
import multer from 'multer';
import * as mediaController from '../controllers/media.controller';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

router.post('/upload', upload.single('file'), mediaController.uploadFile);
router.get('/', mediaController.listFiles);
router.get('/data-sources', mediaController.getDataSources);
router.get('/:id', mediaController.getFile);
router.delete('/:id', mediaController.deleteFile);

export default router;
