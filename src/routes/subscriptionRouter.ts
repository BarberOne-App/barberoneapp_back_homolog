import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import {
  cancelSubscription,
  checkOverdue,
  createSubscription,
  getSubscriptionById,
  listSubscriptions,
  renewSubscription,
  toggleRecurring,
  updateSubscription,
} from "../controllers/subscriptionController.js";

const router = Router();

// Listar — qualquer logado (clientes veem só as suas no service)
router.get("/subscriptions", requireAuth, asyncHandler(listSubscriptions));
router.get("/subscriptions/:id", requireAuth, asyncHandler(getSubscriptionById));

// Criar — admin / recepcionista
router.post("/subscription", requireAuth, asyncHandler(createSubscription));

// Atualizar (status, barbeiro mensal, etc.) — admin
router.patch("/subscriptions/:id", requireAuth, requireAdmin, asyncHandler(updateSubscription));

// Ações de assinatura — admin
router.patch("/subscriptions/:id/cancel", requireAuth, requireAdmin, asyncHandler(cancelSubscription));
router.patch("/subscriptions/:id/renew", requireAuth, requireAdmin, asyncHandler(renewSubscription));
router.patch("/subscriptions/:id/toggle-recurring", requireAuth, requireAdmin, asyncHandler(toggleRecurring));

// Job endpoint — admin
router.post("/subscriptions/check-overdue", requireAuth, requireAdmin, asyncHandler(checkOverdue));

export default router;
