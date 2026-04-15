import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAdmin, requireAuth } from "../middleware/authMiddleware.js";
import {
  createProduct,
  deleteProduct,
  getProductById,
  importProducts,
  listProducts,
  reactivateProduct,
  updateProduct,
} from "../controllers/productsController.js";

const router = Router();

// todos precisam estar autenticados (barbershop vem do token)
// router.get("/products", requireAuth, asyncHandler(listProducts));
// router.get("/products/:id", requireAuth, asyncHandler(getProductById));

router.get("/products", requireAuth, asyncHandler(listProducts));
router.get("/products/:id", requireAuth, asyncHandler(getProductById));

// service já bloqueia se não for admin, mas pode deixar assim mesmo:
router.post("/products", requireAuth, asyncHandler(createProduct));
router.post(
  "/products/import",
  requireAuth,
  requireAdmin,
  asyncHandler(importProducts)
);
router.patch("/products/:id", requireAuth, asyncHandler(updateProduct));
router.put("/products/:id", requireAuth, asyncHandler(updateProduct));
router.patch(
  "/products/:id/reactivate",
  requireAuth,
  asyncHandler(reactivateProduct)
);
router.delete("/products/:id", requireAuth, asyncHandler(deleteProduct));

export default router;