import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
  createCheckout,
  createPix,
  processPaymentController,
  getTransactionStatus,
} from "../controllers/mercadoPagoController.js";

const router = Router();

/** Checkout Transparente — recebe dados do MercadoPago.js (cartão/pix/boleto) */
router.post("/mercadopago/process-payment", requireAuth, asyncHandler(processPaymentController));

/** Checkout Pro (Preferência) — retorna init_point para redirect */
router.post("/mercadopago/checkout", requireAuth, asyncHandler(createCheckout));

/** Criar pagamento PIX — retrocompatibilidade (usa process-payment internamente) */
router.post("/mercadopago/pix", requireAuth, asyncHandler(createPix));

/** Consultar status de uma transação */
router.get("/mercadopago/status/:id", requireAuth, asyncHandler(getTransactionStatus));

export default router;
