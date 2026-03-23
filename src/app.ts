import express from "express";
import cors from "cors";
import crypto from "crypto";
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
import dependentRouter from "./routes/dependentRouter.js";
import savedCardRouter from "./routes/savedCardRouter.js";
import employeeValeRouter from "./routes/employeeValeRouter.js";
import employeePaymentRouter from "./routes/employeePaymentRouter.js";
import { waitPaymentFinal, isFinalForYourFront, mapToFrontStatus, resolveWaiter } from "./middleware/waiters.js";
import open from "open";
import path from "path";
import hbs from "hbs";
import { fileURLToPath } from "url";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { PrismaClient } from "@prisma/client";
import axios from "axios";



dotenv.config();

const app = express();
const prisma = new PrismaClient();
const MP_TOKEN = process.env.MP_ACCESS_TOKEN ?? "";
const MP_NOTIFICATION_URL = process.env.MERCADO_PAGO_NOTIFICATION_URL ?? "";


app.use(cors({ origin: true }));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => res.send({ ok: true }));


const mercadoPagoPublicKey = process.env.MERCADO_PAGO_PUBLIC_KEY_PROD ?? "";
// if (!mercadoPagoPublicKey) {
//     console.log("Error: public key not defined");
//     process.exit(1);
// }

const mercadoPagoAccessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN_PROD ?? "";
// if (!mercadoPagoAccessToken) {
//     console.log("Error: access token not defined");
//     process.exit(1);
// }

const client = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN_PROD ?? "" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.set("view engine", "html");
app.engine("html", hbs.__express);
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: false }));
app.use(express.static("./static"));
app.use(express.json({ limit: "10mb" }));

app.get("/", function (req, res) {
    res.status(200).render("app", { mercadoPagoPublicKey });
});

// app.post("/process_payment", async (req, res) => {

//     console.log("Processando pagamento com dados:", req.body);
//     try {

//         const body = req.body;

//         const payment = new Payment(client);

//         const externalReference = `pay_${Date.now()}_${crypto.randomUUID()}`;

//         const paymentData: Record<string, any> = {
//             transaction_amount: Number(body.transaction_amount),
//             token: body.token,
//             description: body.description,
//             installments: Number(body.installments),
//             payment_method_id: body.payment_method_id,
//             issuer_id: body.issuer_id || undefined,
//             external_reference: externalReference,
//             statement_descriptor: "BarberShop",
//             ...(MP_NOTIFICATION_URL ? { notification_url: MP_NOTIFICATION_URL } : {}),
//             payer: {
//                 email: body.payer?.email,
//                 identification: {
//                     type: body.payer?.identification?.type,
//                     number: body.payer?.identification?.number,
//                 },
//             },
//             additional_info: {
//                 items: [
//                     {
//                         id: body.id,
//                         title: body.title,
//                         description: body.description,
//                         category_id: body.category_id || "others",
//                         quantity: body.quantity || 1,
//                         unit_price: Number(body.unit_price) || Number(body.transaction_amount),
//                     },
//                 ],
//             },
//         };

//         const idempotencyKey = req.get("X-Idempotency-Key") || undefined;

//         const result = await payment.create({
//             body: paymentData,
//             requestOptions: idempotencyKey ? { idempotencyKey } : undefined,
//         });

//         console.log("IDEMPOTENCY:", idempotencyKey);
//         console.log("EXTERNAL_REFERENCE:", externalReference);

//         console.log("Pagamento criado:", result);

//         // Se o status já é definitivo, retorna direto
//         if (isFinalForYourFront(result.status ?? "")) {
//             return res.status(201).json({
//                 id: result.id,
//                 status: result.status,
//                 status_detail: result.status_detail,
//                 payment_method_id: result.payment_method_id,
//                 external_reference: externalReference,
//                 card: { last_four_digits: result.card?.last_four_digits },
//             });
//         }

//         // Status pendente (in_process) — aguardar webhook com status final
//         console.log(`Pagamento ${result.id} em análise (${result.status}), aguardando webhook...`);
//         try {
//             const final: any = await waitPaymentFinal(String(result.id), { timeoutMs: 120_000 });

//             return res.status(201).json({
//                 id: final.id ?? result.id,
//                 status: mapToFrontStatus(final.status ?? "rejected"),
//                 status_detail: final.status_detail ?? result.status_detail,
//                 payment_method_id: final.payment_method_id ?? result.payment_method_id,
//                 external_reference: externalReference,
//                 card: { last_four_digits: final.card?.last_four_digits ?? result.card?.last_four_digits },
//             });
//         } catch {
//             // Timeout — o webhook não chegou a tempo
//             console.warn(`Timeout aguardando status final do pagamento ${result.id}`);
//             // return res.status(201).json({
//             //     id: result.id,
//             //     status: "rejected",
//             //     status_detail: "timeout_waiting_for_final_status",
//             //     payment_method_id: result.payment_method_id,
//             //     external_reference: externalReference,
//             //     card: { last_four_digits: result.card?.last_four_digits },
//             // });
//             return res.status(201).json({
//                 id: result.id,
//                 status: "pending",
//                 status_detail: "waiting_for_final_status",
//                 external_reference: externalReference,
//             });
//         }
//     } catch (error) {
//         console.log(error);
//         const { errorMessage, errorStatus } = validateError(error);
//         return res.status(errorStatus).json({ error_message: errorMessage });
//     }
// });

app.post("/process_payment", async (req, res) => {

    console.log("Processando pagamento com dados:", req.body);
    try {

        const body = req.body;

        const preference = new Preference(client)

        const externalReference = `pay_${Date.now()}_${crypto.randomUUID()}`;

        console.log("ITEMS:", req.body.items);

        const items: any[] = [];

        for (let i = 0; i < body.items.length; i++) {
            const it = body.items[i];

            items.push({
                id: it.id,
                title: it.title,
                description: it.title,
                picture_url: it.picture_url,
                category_id: it.category_id,
                quantity: it.quantity,
                currency_id: it.currency_id || "BRL",
                unit_price: 2,
            });
        }
        const paymentData: any = {
            items,
            back_urls: {
                success: 'https://barberoneapp.com/agendamentos',
                failure: 'https://barberoneapp.com/home',
                pending: 'https://barberoneapp.com/agendamentos',
            },
            auto_return: 'approved',
            external_reference: externalReference,
            ...(MP_NOTIFICATION_URL ? { notification_url: MP_NOTIFICATION_URL } : {}),
        };

        const idempotencyKey = req.get("X-Idempotency-Key") || undefined;

        const result = await preference.create({ body: paymentData, requestOptions: idempotencyKey ? { idempotencyKey } : undefined });

        console.log("Preferência criada:", result);

        return res.status(201).json({
            status: result.auto_return,
            url_sucess: result.back_urls?.success,
            url_failure: result.back_urls?.failure,
            url_pending: result.back_urls?.pending,
            init_point: result.init_point,
            collector_id: result.collector_id,
            id: result.id
        })
    } catch (error) {
        console.log(error);
        const { errorMessage, errorStatus } = validateError(error);
        return res.status(errorStatus).json({ error_message: errorMessage });
    }
});

// mapeia status do MP -> teu enum
function mapMpStatusToLocal(mpStatus: string) {
    if (!mpStatus) return "active";
    const s = String(mpStatus).toLowerCase();
    if (s === "paused") return "paused";
    if (s === "cancelled" || s === "canceled") return "cancelled";
    return "active";
}

app.post("/webhooks/mercadopago", async (req, res) => {
    res.sendStatus(200);

    try {
        const notificationType = req.body?.type;
        const dataId = req.body?.data?.id || req.body?.id;
        if (!dataId) return;

        /* ─── Notificação de PAGAMENTO ─── */
        if (notificationType === "payment") {
            try {
                const paymentClient = new Payment(client);
                const mpPay = await paymentClient.get({ id: String(dataId) });
                const mpStatus = mpPay.status ?? "";

                console.log(`[Webhook] Pagamento ${dataId} → status: ${mpStatus}`);

                // Se status é final, resolver o waiter (destravar o /process_payment)
                if (isFinalForYourFront(mpStatus)) {
                    resolveWaiter(String(dataId), mpPay);
                }
            } catch (err: any) {
                console.error("[Webhook] Erro ao consultar pagamento:", err.message);
            }
            return;
        }

        /* ─── Notificação de ASSINATURA (preapproval) ─── */
        const preapprovalId = dataId;

        const { data: mpSub } = await axios.get(
            `https://api.mercadopago.com/preapproval/${preapprovalId}`,
            { headers: { Authorization: `Bearer ${MP_TOKEN}` } }
        );

        const payerEmail = (mpSub?.payer_email || "").toLowerCase().trim();
        const mpPlanId = mpSub?.preapproval_plan_id;
        const mpStatus = mpSub?.status;

        if (!payerEmail || !mpPlanId) return;

        const plan = await prisma.subscription_plans.findFirst({
            where: { mp_preapproval_plan_id: String(mpPlanId) },
            select: { id: true, barbershop_id: true },
        });
        if (!plan) return;

        const user = await prisma.users.findFirst({
            where: { email: payerEmail },
            select: { id: true },
        });
        if (!user) return;

        await prisma.subscriptions.upsert({
            where: {
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

app.get('/assinatura/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const response = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN_PROD ?? ""}`,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        return res.status(response.status).json(data);
    } catch (error) {
        console.error('Erro ao consultar assinatura:', error);
        return res.status(500).json({ error: 'Erro ao consultar assinatura' });
    }
});

app.post("/criar_pix", async (req, res) => {
    try {
        const clientPix = new MercadoPagoConfig({ accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN_PROD ?? "" });
        const payment = new Payment(clientPix);

        const externalReference = `pix_${Date.now()}_${crypto.randomUUID()}`;

        const body: Record<string, any> = {
            transaction_amount: Number(req.body.transaction_amount),
            description: req.body.description,
            payment_method_id: req.body.payment_method_id,
            external_reference: externalReference,
            ...(MP_NOTIFICATION_URL ? { notification_url: MP_NOTIFICATION_URL } : {}),
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
            external_reference: externalReference,
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
    console.error("Erro MP completo:", error);

    const errorMessage =
        error?.cause?.[0]?.description ||
        error?.message ||
        "Erro ao processar pagamento";

    const errorStatus =
        error?.status ||
        500;

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
app.use(dependentRouter);
app.use(savedCardRouter);
app.use(employeeValeRouter);
app.use(employeePaymentRouter);
app.use(errorHandler);


const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API rodando na porta ${port}`));