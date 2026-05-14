// src/routes/efiRoutes.ts

import { Router } from 'express';
import { createEfiCardPaymentController } from '../controllers/efiPaymentController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/card-payment', requireAuth, createEfiCardPaymentController);

export default router;