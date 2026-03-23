import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import * as consumerUhtdSuggestionsController from '../controllers/consumerUhtdSuggestions.controller';

const router = Router();

router.use(authMiddleware);

router.post('/consumer-uhtd-suggestions', consumerUhtdSuggestionsController.submitConsumerSuggestion);

export default router;
