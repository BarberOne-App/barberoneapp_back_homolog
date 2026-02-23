import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { optionalAuth } from "../middleware/authMiddleware.js";
import {
  createCheckout,
  createPix,
  processPaymentController,
  getTransactionStatus,
} from "../controllers/mercadoPagoController.js";

const router = Router();

/**
 * TODO: trocar optionalAuth → requireAuth quando o login estiver integrado no frontend.
 * Por enquanto aceita barbershopId / userId via body como fallback.
 */

/** Checkout Transparente — recebe dados do MercadoPago.js (cartão/pix/boleto) */
router.post("/mercadopago/process-payment", optionalAuth, asyncHandler(processPaymentController));

/** Checkout Pro (Preferência) — retorna init_point para redirect */
router.post("/mercadopago/checkout", optionalAuth, asyncHandler(createCheckout));

/** Criar pagamento PIX — retrocompatibilidade (usa process-payment internamente) */
router.post("/mercadopago/pix", optionalAuth, asyncHandler(createPix));

/** Consultar status de uma transação */
router.get("/mercadopago/status/:id", optionalAuth, asyncHandler(getTransactionStatus));

export default router;
