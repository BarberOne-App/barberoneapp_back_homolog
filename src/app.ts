import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoute.js";
import productsRouter from "./routes/productsRouter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import serviceRouter from "./routes/serviceRouter.js";

dotenv.config();

const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) => res.send({ ok: true }));

app.use(authRoutes);
app.use(productsRouter);
app.use(serviceRouter);
app.use(errorHandler);


const port = Number(process.env.PORT || 4000);
console.log(process.env.DATABASE_URL?.split('@')[1]);
app.listen(port, () => console.log(`API rodando na porta ${port}`));