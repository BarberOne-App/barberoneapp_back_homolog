import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import {
    createProduct,
    deleteProduct,
    getProductById,
    listProducts,
    updateProduct,
} from "../controllers/productsController.js";

const router = Router();

// todos precisam estar autenticados (barbershop vem do token)
router.get("/products", requireAuth, asyncHandler(listProducts));
router.get("/products/:id", requireAuth, asyncHandler(getProductById));

// service já bloqueia se não for admin, mas pode deixar assim mesmo:
router.post("/products", requireAuth, asyncHandler(createProduct));
router.patch("/products/:id", requireAuth, asyncHandler(updateProduct));
router.put("/products/:id", requireAuth, asyncHandler(updateProduct));
router.delete("/products/:id", requireAuth, asyncHandler(deleteProduct));

export default router;

