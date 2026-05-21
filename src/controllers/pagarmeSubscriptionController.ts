// controllers/pagarmeSubscriptionController.ts
import { Request, Response, NextFunction } from 'express';
import { createPagarmeClientSubscriptionService } from '../services/pagarmeSubscriptionService.js';

export async function createPagarmeClientSubscriptionController(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await createPagarmeClientSubscriptionService(req.body, req.user);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}