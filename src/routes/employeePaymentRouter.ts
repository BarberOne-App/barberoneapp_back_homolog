import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireAdmin } from "../middleware/authMiddleware.js";
import {
  createEmployeePayment,
  listEmployeePayments,
} from "../controllers/employeePaymentController.js";

const router = Router();

router.get("/employeePayments", requireAuth, asyncHandler(listEmployeePayments));
router.post("/employeePayments", requireAuth, requireAdmin, asyncHandler(createEmployeePayment));

export default router;
