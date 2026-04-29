
import { Router } from "express";
import { login, logout, me, refresh, registerBarber, registerBarbershop, registerClient, registerClientGoogle, registerSuperAdmin, switchBarbershop } from "../controllers/authController.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

const router = Router();

router.post("/auth/login", asyncHandler(login));
router.post("/auth/register/barbershop", asyncHandler(registerBarbershop));
router.post("/barbershops/register", asyncHandler(registerBarbershop));
router.post("/auth/register/client", asyncHandler(registerClient));
router.post("/auth/register/client-google", asyncHandler(registerClientGoogle));
router.post("/auth/setup/super-admin", asyncHandler(registerSuperAdmin));
router.post("/auth/register/barber", requireAuth, requireAdmin, asyncHandler(registerBarber));

router.get("/auth/me", requireAuth, asyncHandler(me));
router.post("/auth/refresh", asyncHandler(refresh));
router.post("/auth/switch-barbershop", requireAuth, asyncHandler(switchBarbershop));
router.post("/auth/logout", asyncHandler(logout));

export default router;
