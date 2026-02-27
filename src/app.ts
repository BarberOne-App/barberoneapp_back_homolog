import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoute.js";
import productsRouter from "./routes/productsRouter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import serviceRouter from "./routes/serviceRouter.js";
import settingsRouter from "./routes/settingRouter.js";
import userRouter from "./routes/userRouter.js";
import barberRouter from "./routes/barberRouter.js";
import appointmentRouter from "./routes/appointmentRouter.js";
import blockedDateRouter from "./routes/blockedDateRouter.js";
import subscriptionPlanRouter from "./routes/subscriptionPlanRouter.js";
import subscriptionRouter from "./routes/subscriptionRouter.js";
import paymentRouter from "./routes/paymentRouter.js";
import paymentMethodRouter from "./routes/paymentMethodRouter.js";
import galleryRouter from "./routes/galleryRouter.js";
// import mercadoPagoRouter from "./routes/mercadoPagoRouter.js";
import webhookRouter from "./routes/webhookRouter.js";
import { waitPaymentFinal, isFinalForYourFront, mapToFrontStatus, resolveWaiter } from "./middleware/waiters.js";
import open from "open";
import path from "path";
import hbs from "hbs";
import { fileURLToPath } from "url";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { PrismaClient } from "@prisma/client";
import axios from "axios";



dotenv.config();

const app = express();
const prisma = new PrismaClient();
const MP_TOKEN = process.env.MP_ACCESS_TOKEN;


app.use(cors({ origin: true }));
app.use(express.json());

app.get("/health", (_req, res) => res.send({ ok: true }));


const mercadoPagoPublicKey = process.env.MERCADO_PAGO_PUBLIC_KEY_PROD;
if (!mercadoPagoPublicKey) {
    console.log("Error: public key not defined");
    process.exit(1);
}

const mercadoPagoAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN_PROD;
if (!mercadoPagoAccessToken) {
    console.log("Error: access token not defined");
    process.exit(1);
}

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN_PROD ?? "" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.set("view engine", "html");
app.engine("html", hbs.__express);
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static("./static"));
app.use(express.json());

app.get("/", function (req, res) {
    res.status(200).render("app", { mercadoPagoPublicKey });
});

app.post("/process_payment", async (req, res) => {

    console.log("Processando pagamento com dados:", req.body);
    try {
        const body = req.body;

        const payment = new Payment(client);

        const paymentData = {
            transaction_amount: Number(body.transaction_amount),
            token: body.token,
            description: body.description,
            installments: Number(body.installments),
            payment_method_id: body.payment_method_id,
            issuer_id: body.issuer_id,
            // statement_descriptor: "BARBER_ONE",
            payer: {
                email: body.payer?.email,
                identification: {
                    type: body.payer?.identification?.type,
                    number: body.payer?.identification?.number,
                },
            },
        };

        const idempotencyKey = req.get("X-Idempotency-Key") || undefined;

        const result = await payment.create({
            body: paymentData,
            requestOptions: idempotencyKey ? { idempotencyKey } : undefined,
        });

        console.log("Pagamento criado:", result);

        return res.status(201).json({
            id: result.id,
            status: result.status,
            status_detail: result.status_detail,
            payment_method_id: result.payment_method_id,
            card: { last_four_digits: result.card?.last_four_digits },
        });
    } catch (error) {
        console.log(error);
        const { errorMessage, errorStatus } = validateError(error);
        return res.status(errorStatus).json({ error_message: errorMessage });
    }
});

// app.post("/process_payment", async (req, res) => {
//     const paymentApi = new Payment(client);

//     console.log("Processando pagamento com dados:", req.body);
//     try {
//         const body = req.body;

//         const paymentData = {
//             transaction_amount: Number(body.transaction_amount),
//             token: body.token,
//             description: body.description,
//             installments: Number(body.installments),
//             payment_method_id: body.payment_method_id,
//             issuer_id: body.issuer_id,
//             payer: {
//                 email: body.payer?.email,
//                 identification: {
//                     type: body.payer?.identification?.type,
//                     number: body.payer?.identification?.number,
//                 },
//             },
//         };

//         const idempotencyKey = req.get("X-Idempotency-Key") || undefined;

//         const created = await paymentApi.create({
//             body: paymentData,
//             requestOptions: idempotencyKey ? { idempotencyKey } : undefined,
//         }) as any;

//         console.log("Pagamento criado:", created);

//         // Se já veio final, responde imediatamente
//         if (isFinalForYourFront(created.status)) {
//             return res.status(201).json({
//                 id: created.id,
//                 status: mapToFrontStatus(created.status),
//                 mp_status: created.status,
//                 status_detail: created.status_detail,
//             });
//         }
//         const finalPayment = await waitPaymentFinal(String(created.id), { timeoutMs: 120_000 }) as any;

//         console.log("Pagamento finalizado:", finalPayment);

//         return res.status(201).json({
//             id: finalPayment.id,
//             status: mapToFrontStatus(finalPayment.status),
//             mp_status: finalPayment.status,
//             status_detail: finalPayment.status_detail,
//         });
//     } catch (error) {
//         // if (error?.message === "PAYMENT_TIMEOUT") {
//         //     return res.status(504).json({ error_message: "Pagamento ainda em processamento (timeout no servidor)." });
//         // }

//         console.log(error);
//         const { errorMessage, errorStatus } = validateError(error);
//         return res.status(errorStatus).json({ error_message: errorMessage });
//     }
// });

// mapeia status do MP -> teu enum
function mapMpStatusToLocal(mpStatus: string) {
    // MP costuma usar valores como authorized/paused/cancelled/etc.
    // Ajuste conforme você observar na prática (salve o raw também se quiser).
    if (!mpStatus) return "active";
    const s = String(mpStatus).toLowerCase();
    if (s === "paused") return "paused";
    if (s === "cancelled" || s === "canceled") return "cancelled";
    return "active";
}

app.post("/webhooks/mercadopago", async (req, res) => {
    // responde rápido pro MP não re-tentar por timeout
    res.sendStatus(200);

    try {
        const preapprovalId = req.body?.data?.id || req.body?.id;
        if (!preapprovalId) return;

        // 1) Busca detalhes oficiais no MP
        const { data: mpSub } = await axios.get(
            `https://api.mercadopago.com/preapproval/${preapprovalId}`,
            { headers: { Authorization: `Bearer ${MP_TOKEN}` } }
        );

        const payerEmail = (mpSub?.payer_email || "").toLowerCase().trim();
        const mpPlanId = mpSub?.preapproval_plan_id;
        const mpStatus = mpSub?.status;

        if (!payerEmail || !mpPlanId) return;

        // 2) Acha seu plano (multi-tenant) pelo mp_preapproval_plan_id
        const plan = await prisma.subscription_plans.findFirst({
            where: { mp_preapproval_plan_id: String(mpPlanId) },
            select: { id: true, barbershop_id: true },
        });
        if (!plan) return;

        // 3) Acha o usuário pelo email
        const user = await prisma.users.findFirst({
            where: { email: payerEmail },
            select: { id: true },
        });
        if (!user) return;

        // 4) Upsert na assinatura 1 por usuário por barbearia
        await prisma.subscriptions.upsert({
            where: {
                // nome do where pode variar; em geral Prisma gera algo como user_id_barbershop_id
                user_id_barbershop_id: { user_id: user.id, barbershop_id: String(plan.barbershop_id) },
            },
            create: {
                user_id: user.id,
                barbershop_id: String(plan.barbershop_id),
                plan_id: plan.id,
                status: mapMpStatusToLocal(mpStatus),
                mp_preapproval_id: String(preapprovalId),
            },
            update: {
                plan_id: plan.id,
                status: mapMpStatusToLocal(mpStatus),
                mp_preapproval_id: String(preapprovalId),
                updated_at: new Date(),
            },
        });
    } catch (err) {
        if (err && typeof err === "object" && "response" in err && err.response && "data") {
            console.error("Webhook MP erro:", err.response);
        } else {
            console.error("Webhook MP erro:", err);
        }
    }
});

// app.post("/mp/webhook", async (req, res) => {
//     try {
//         const paymentId = req.body?.data?.id || req.query?.["data.id"] || req.query?.id;
//         if (!paymentId) return res.sendStatus(200);

//         const paymentApi = new Payment(client);
//         const p = await paymentApi.get({ id: String(paymentId) }) as any;

//         if (isFinalForYourFront(p.status)) {
//             resolveWaiter(String(paymentId), p);
//         }

//         return res.sendStatus(200);
//     } catch (e) {
//         return res.sendStatus(200);
//     }
// });

app.post("/criar_pix", async (req, res) => {
    try {
        const clientPix = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN_PROD ?? "" });
        const payment = new Payment(clientPix);

        const body = {
            transaction_amount: Number(req.body.transaction_amount),
            description: req.body.description,
            payment_method_id: req.body.payment_method_id,
            payer: {
                email: req.body.payer?.email,
                identification: {
                    type: req.body.payer?.identification?.type,
                    number: req.body.payer?.identification?.number,
                },
            },
        };

        const idempotencyKey = req.get("X-Idempotency-Key");
        const result = await payment.create({
            body,
            requestOptions: idempotencyKey ? { idempotencyKey } : undefined,
        });

        return res.status(201).json({
            id: result.id,
            ticket_url: result.point_of_interaction?.transaction_data?.ticket_url,
            qr_code: result.point_of_interaction?.transaction_data?.qr_code,
            qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64,
        });
    } catch (error) {
        console.log(error);
        const { errorMessage, errorStatus } = validateError(error);
        return res.status(errorStatus).json({ error_message: errorMessage });
    }
});

app.get("/pixstatus/:id", async (req, res) => {
    const clientPixStatus = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN_PROD ?? "" });
    const payment = new Payment(clientPixStatus);

    const result = await payment.get({
        id: req.params.id,
    });
    return res.status(200).json(result.status);
});

function validateError(error: any) {
    let errorMessage = "Unknown error cause";
    let errorStatus = 400;

    if (error.cause) {
        const sdkErrorMessage = error.cause[0].description;
        errorMessage = sdkErrorMessage || errorMessage;

        const sdkErrorStatus = error.status;
        errorStatus = sdkErrorStatus || errorStatus;
    }

    return { errorMessage, errorStatus };
}


app.use(authRoutes);
app.use(userRouter);
app.use(barberRouter);
app.use(appointmentRouter);
app.use(blockedDateRouter);
app.use(subscriptionPlanRouter);
app.use(subscriptionRouter);
app.use(paymentRouter);
app.use(paymentMethodRouter);
app.use(galleryRouter);
// app.use(mercadoPagoRouter);
app.use(webhookRouter);
app.use(productsRouter);
app.use(serviceRouter);
app.use(settingsRouter);
app.use(errorHandler);


const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API rodando na porta ${port}`));