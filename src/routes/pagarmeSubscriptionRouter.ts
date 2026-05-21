// routes/pagarmeSubscriptionRoutes.ts
import { Router } from 'express';
import { requireAuth } from '../middleware/authMiddleware.js';
import { createPagarmeClientSubscriptionController } from '../controllers/pagarmeSubscriptionController.js';

const router = Router();

router.post('/client-subscriptions', requireAuth, createPagarmeClientSubscriptionController);

export default router;