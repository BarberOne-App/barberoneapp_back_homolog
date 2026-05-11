import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import {
  createAppointmentPayment,
  createPayment,
  getPaymentById,
  listAppointmentPayments,
  listPayments,
  updatePayment,
} from "../controllers/paymentController.js";

const router = Router();

/* ═══════ Payments (assinaturas) ═══════ */

// Listar — admin vê todos, client vê os seus
router.get("/payments", requireAuth, asyncHandler(listPayments));
router.get("/payments/:id", requireAuth, asyncHandler(getPaymentById));

// Criar pagamento — admin
router.post("/payments", requireAuth, requireAdmin, asyncHandler(createPayment));

/* ═══════ Appointment Payments ═══════ */

// Listar — admin vê todos, client vê os seus
router.get("/appointmentPayments", requireAuth, asyncHandler(listAppointmentPayments));

// Criar pagamento de agendamento — admin / recepcionista
// router.post("/appointmentPayments", requireAuth, requireAdmin, asyncHandler(createAppointmentPayment));

router.post("/appointmentPayments", requireAuth, asyncHandler(createAppointmentPayment));

// Atualizar (marcar como pago, etc.) — admin
router.patch("/appointmentPayments/:id", requireAuth, asyncHandler(updatePayment));

// Também permite atualizar pagamento de assinatura
router.patch("/payments/:id", requireAuth, requireAdmin, asyncHandler(updatePayment));

export default router;
