
import { Router } from "express";
import { login, registerBarber, registerBarbershop, registerClient } from "../controllers/authController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.post("/auth/login", asyncHandler(login));
router.post("/auth/register/barbershop", asyncHandler(registerBarbershop));
router.post("/auth/register/client", asyncHandler(registerClient));
router.post("/auth/register/barber", requireAuth, requireAdmin, asyncHandler(registerBarber));

export default router;
