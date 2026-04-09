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
import stripeWebhookRoutes from "./routes/stripeWebhookRoutes.js";
import employeePaymentRouter from "./routes/employeePaymentRouter.js";
import { waitPaymentFinal, isFinalForYourFront, mapToFrontStatus, resolveWaiter } from "./middleware/waiters.js";
import open from "open";
import path from "path";
import hbs from "hbs";
import { fileURLToPath } from "url";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";
import { PrismaClient } from "@prisma/client";
import axios from "axios";
import Stripe from "stripe";
import { optionalAuth } from "./middleware/authMiddleware.js";


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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-02-25.clover',
});

app.post('/payment-intents', async (req, res) => {
    try {
        const {
            amount,
            currency = 'brl',
            customerEmail,
            paymentMethodTypes,
            metadata = {},
        } = req.body;

        const numericAmount = Number(amount);

        if (!numericAmount || numericAmount <= 0) {
            return res.status(400).json({ message: 'Valor inválido.' });
        }

        const pixEnabled = String(process.env.STRIPE_PIX_ENABLED || '').toLowerCase() === 'true';
        const allowedPaymentMethods = pixEnabled ? ['card', 'pix'] : ['card'];
        const normalizedRequestedMethods = Array.isArray(paymentMethodTypes)
            ? paymentMethodTypes
                .map((m: any) => String(m).toLowerCase().trim())
                .filter((m: string) => allowedPaymentMethods.includes(m))
            : [];

        const finalPaymentMethodTypes = normalizedRequestedMethods.length
            ? Array.from(new Set(normalizedRequestedMethods))
            : allowedPaymentMethods;

        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(numericAmount * 100), // Stripe usa menor unidade da moeda
            currency,
            payment_method_types: finalPaymentMethodTypes,
            receipt_email: customerEmail || undefined,
            metadata: {
                ...metadata,
            },
        });

        return res.status(200).json({
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        });
    } catch (error) {
        if (error instanceof Error) {
            console.error('Erro ao criar PaymentIntent Stripe:', error.message);
            return res.status(500).json({
                message: error.message || 'Erro ao criar pagamento na Stripe.',
            });
        }

        console.error('Erro desconhecido:', error);
        return res.status(500).json({
            message: 'Erro ao criar pagamento na Stripe.',
        });
    }
});


app.post('/stripe/subscriptions', async (req, res) => {
    try {
        const { customerId, email, stripePriceId, userId, planId } = req.body;

        let finalCustomerId = customerId;

        if (!finalCustomerId) {
            const customer = await stripe.customers.create({ email });
            finalCustomerId = customer.id;
        }

        const subscription = await stripe.subscriptions.create({
            customer: finalCustomerId,
            items: [{ price: stripePriceId }],
            payment_behavior: 'default_incomplete',
            payment_settings: {
                save_default_payment_method: 'on_subscription',
            },
            expand: ['latest_invoice.payment_intent'],
            metadata: {
                userId: String(userId || ''),
                planId: String(planId || ''),
            },
        });

        res.json({
            subscriptionId: subscription.id,
            customerId: finalCustomerId,
            clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret || '',
        });
    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message);
            return res.status(500).json({ message: error.message });
        }
        console.error('Erro desconhecido:', error);
        return res.status(500).json({ message: 'Erro ao criar subscription.' });
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

app.get('/stripe/subscriptions/by-email', async (req, res) => {
    console.log('STRIPE SECRET KEY:', process.env.STRIPE_SECRET_KEY);
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({ error: 'Email é obrigatório.' });
        }

        const customers = await stripe.customers.list({
            email: String(email).trim(),
            limit: 100,
        });

        if (!customers.data.length) {
            return res.json({
                found: false,
                subscriptions: [],
            });
        }

        const allSubscriptions = [];

        for (const customer of customers.data) {
            const subs = await stripe.subscriptions.list({
                customer: customer.id,
                status: 'all',
                limit: 100,
            });

            for (const sub of subs.data) {
                const subscriptionAny = sub as any;
                const firstItem = sub.items?.data?.[0] || null;
                const productId = firstItem?.price?.product || null;
                const priceId = firstItem?.price?.id || null;

                allSubscriptions.push({
                    customerId: customer.id,
                    customerEmail: customer.email,
                    customerName: customer.name,
                    subscriptionId: sub.id,
                    status: sub.status,
                    created: sub.created, // timestamp Stripe
                    currentPeriodStart: subscriptionAny.current_period_start ?? null,
                    currentPeriodEnd: subscriptionAny.current_period_end ?? null,
                    cancelAtPeriodEnd: sub.cancel_at_period_end,
                    priceId,
                    productId,
                    items: (sub.items?.data || []).map((item) => ({
                        subscriptionItemId: item.id,
                        priceId: item.price?.id || null,
                        productId: item.price?.product || null,
                        quantity: item.quantity ?? null,
                        interval: item.price?.recurring?.interval || null,
                        intervalCount: item.price?.recurring?.interval_count || null,
                    })),
                });
            }
        }

        // Mantém apenas a assinatura mais recente por productId
        const latestByProductId = new Map();

        for (const sub of allSubscriptions) {
            if (!sub.productId) continue;

            const current = latestByProductId.get(sub.productId);

            if (!current || sub.created > current.created) {
                latestByProductId.set(sub.productId, sub);
            }
        }

        const subscriptions = Array.from(latestByProductId.values())
            .sort((a, b) => b.created - a.created);

        const productIds = subscriptions
            .map((s) => s.productId)
            .filter((id): id is string => Boolean(id));

        let planByMpId = new Map<string, any>();

        if (productIds.length > 0) {
            const plans = await prisma.subscription_plans.findMany({
                where: {
                    mp_preapproval_plan_id: {
                        in: productIds,
                    },
                },
                include: {
                    subscription_plan_features: {
                        orderBy: { sort_order: "asc" },
                    },
                },
            });

            planByMpId = new Map(
                plans
                    .filter((p) => p.mp_preapproval_plan_id)
                    .map((p) => [String(p.mp_preapproval_plan_id), p])
            );
        }

        const subscriptionsWithPlan = subscriptions.map((sub) => {
            const matchedPlan = sub.productId
                ? planByMpId.get(String(sub.productId))
                : null;

            return {
                ...sub,
                plan: matchedPlan
                    ? {
                        id: matchedPlan.id,
                        name: matchedPlan.name,
                        price: Number(matchedPlan.price),
                        mpPreapprovalPlanId: matchedPlan.mp_preapproval_plan_id,
                        features: (matchedPlan.subscription_plan_features ?? []).map((f: any) => f.feature),
                    }
                    : null,
            };
        });

        return res.json({
            found: subscriptionsWithPlan.length > 0,
            total: subscriptionsWithPlan.length,
            subscriptions: subscriptionsWithPlan,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Erro ao buscar subscriptions na Stripe.',
            //   details: error.message,
        });
    }
});

app.get('/stripe/subscriptions', optionalAuth, async (req, res) => {
    console.log('STRIPE SECRET KEY:', process.env.STRIPE_SECRET_KEY);

    try {
        const email = String(req.query.email || '').trim();
        const listAll = String(req.query.all || '').toLowerCase() === 'true';

        if (listAll && !(req.user?.role === 'admin' || req.user?.isAdmin)) {
            return res.status(403).json({ error: 'Apenas administradores podem listar todas as assinaturas.' });
        }

        const collectAllCustomers = async () => {
            const customers: Stripe.Customer[] = [];
            let startingAfter: string | undefined;

            do {
                const page = await stripe.customers.list({
                    limit: 100,
                    ...(startingAfter ? { starting_after: startingAfter } : {}),
                });

                customers.push(...page.data);
                startingAfter = page.has_more ? page.data[page.data.length - 1]?.id : undefined;
            } while (startingAfter);

            return customers;
        };

        const customers = listAll
            ? await collectAllCustomers()
            : email
                ? (await stripe.customers.list({
                    email,
                    limit: 100,
                })).data
                : req.user?.email
                    ? (await stripe.customers.list({
                        email: String(req.user.email).trim(),
                        limit: 100,
                    })).data
                    : [];

        if (!customers.length) {
            return res.json({
                found: false,
                total: 0,
                items: [],
                subscriptions: [],
            });
        }

        const rawSubscriptions: Array<any> = [];

        for (const customer of customers) {
            const subs = await stripe.subscriptions.list({
                customer: customer.id,
                status: 'all',
                limit: 100,
            });

            const activeSubscriptions = subs.data.filter((sub) => {
                const status = String(sub.status || '').toLowerCase();
                return ['active', 'trialing', 'past_due', 'unpaid'].includes(status);
            });

            const chosenSubscription = activeSubscriptions
                .sort((a, b) => (b.created || 0) - (a.created || 0))[0];

            if (!chosenSubscription) continue;

            const subscriptionAny = chosenSubscription as any;
            const firstItem = chosenSubscription.items?.data?.[0] || null;
            const periodStart =
                subscriptionAny.current_period_start ??
                firstItem?.current_period_start ??
                null;
            const periodEnd =
                subscriptionAny.current_period_end ??
                firstItem?.current_period_end ??
                null;
            const productId = firstItem?.price?.product || null;
            const priceId = firstItem?.price?.id || null;

            rawSubscriptions.push({
                customerId: customer.id,
                customerEmail: customer.email,
                customerName: customer.name,
                subscriptionId: chosenSubscription.id,
                status: chosenSubscription.cancel_at_period_end ? 'cancel_pending' : 'active',
                created: chosenSubscription.created,
                currentPeriodStart: periodStart,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: chosenSubscription.cancel_at_period_end,
                priceId,
                productId,
                items: (chosenSubscription.items?.data || []).map((item) => ({
                    subscriptionItemId: item.id,
                    priceId: item.price?.id || null,
                    productId: item.price?.product || null,
                    quantity: item.quantity ?? null,
                    interval: item.price?.recurring?.interval || null,
                    intervalCount: item.price?.recurring?.interval_count || null,
                })),
            });
        }

        const subscriptions = rawSubscriptions.sort((a, b) => b.created - a.created);

        const uniqueEmails = Array.from(
            new Set(
                subscriptions
                    .map((s) => String(s.customerEmail || '').trim().toLowerCase())
                    .filter(Boolean),
            ),
        );

        const localUsers = uniqueEmails.length
            ? await prisma.users.findMany({
                where: { email: { in: uniqueEmails } },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    cpf: true,
                },
            })
            : [];

        const localUserByEmail = new Map(
            localUsers.map((user) => [String(user.email || '').trim().toLowerCase(), user]),
        );

        const productIds = subscriptions
            .map((s) => s.productId)
            .filter((id): id is string => Boolean(id));

        let planByMpId = new Map<string, any>();

        if (productIds.length > 0) {
            const plans = await prisma.subscription_plans.findMany({
                where: {
                    mp_preapproval_plan_id: {
                        in: productIds,
                    },
                },
                include: {
                    subscription_plan_features: {
                        orderBy: { sort_order: 'asc' },
                    },
                },
            });

            planByMpId = new Map(
                plans
                    .filter((p) => p.mp_preapproval_plan_id)
                    .map((p) => [String(p.mp_preapproval_plan_id), p])
            );
        }

        const subscriptionsWithPlan = subscriptions.map((sub) => {
            const matchedPlan = sub.productId
                ? planByMpId.get(String(sub.productId))
                : null;
            const matchedUser = localUserByEmail.get(String(sub.customerEmail || '').trim().toLowerCase());

            return {
                ...sub,
                userId: matchedUser?.id ?? sub.customerId,
                userCpf: matchedUser?.cpf ?? '',
                user: {
                    id: matchedUser?.id ?? sub.customerId,
                    name: matchedUser?.name ?? sub.customerName ?? sub.customerEmail ?? 'N/A',
                    email: matchedUser?.email ?? sub.customerEmail ?? '',
                },
                planName: matchedPlan?.name ?? null,
                planPrice: matchedPlan?.price ?? null,
                paymentMethod: 'stripe',
                createdAt: new Date(sub.created * 1000).toISOString(),
                startDate: new Date(sub.created * 1000).toISOString(),
                nextBillingDate: sub.currentPeriodEnd
                    ? new Date(sub.currentPeriodEnd * 1000).toISOString()
                    : null,
                currentCycle: {
                    periodStart: sub.currentPeriodStart
                        ? new Date(sub.currentPeriodStart * 1000).toISOString()
                        : null,
                    periodEnd: sub.currentPeriodEnd
                        ? new Date(sub.currentPeriodEnd * 1000).toISOString()
                        : null,
                },
                plan: matchedPlan
                    ? {
                          id: matchedPlan.id,
                          name: matchedPlan.name,
                          price: Number(matchedPlan.price),
                          mpPreapprovalPlanId: matchedPlan.mp_preapproval_plan_id,
                          features: (matchedPlan.subscription_plan_features ?? []).map((f: any) => f.feature),
                      }
                    : null,
            };
        });

        if (listAll) {
            return res.json({
                found: subscriptionsWithPlan.length > 0,
                total: subscriptionsWithPlan.length,
                items: subscriptionsWithPlan,
                subscriptions: subscriptionsWithPlan,
            });
        }

        return res.json({
            found: subscriptionsWithPlan.length > 0,
            total: subscriptionsWithPlan.length,
            items: subscriptionsWithPlan,
            subscriptions: subscriptionsWithPlan,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            error: 'Erro ao buscar subscriptions na Stripe.',
        });
    }
});

app.patch('/stripe/subscriptions/:id/cancel', optionalAuth, async (req, res) => {
    try {
        if (!(req.user?.role === 'admin' || req.user?.isAdmin)) {
            return res.status(403).json({ error: 'Apenas administradores podem cancelar assinaturas.' });
        }

        const { id } = req.params;

        if (!id) {
            return res.status(400).json({ error: 'ID da assinatura é obrigatório.' });
        }

        const subscription = await stripe.subscriptions.update(id, {
            cancel_at_period_end: true,
        });

        return res.json({
            id: subscription.id,
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodEnd: subscription.items?.data?.[0]?.current_period_end ?? null,
        });
    } catch (error) {
        console.error('Erro ao cancelar assinatura Stripe:', error);
        return res.status(500).json({ error: 'Erro ao cancelar assinatura Stripe.' });
    }
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
app.use("/stripe", stripeWebhookRoutes);
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