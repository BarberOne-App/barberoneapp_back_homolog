import { Router } from "express";
import express from "express";
import Stripe from "stripe";
import { Prisma, payment_method, payment_status, subscription_status } from "@prisma/client";
import prisma from "../database/database.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { getMyActiveSubscription } from "../controllers/stripeController.js";

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2026-02-25.clover',
});

function mapStripeSubscriptionStatusToLocal(status: Stripe.Subscription.Status): subscription_status {
    switch (status) {
        case "active":
            return "active";
        case "paused":
            return "paused";
        case "canceled":
            return "cancelled";
        case "incomplete_expired":
            return "expired";
        case "incomplete":
        case "past_due":
        case "trialing":
        case "unpaid":
        default:
            return "active";
    }
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
    const parentSubscription = (invoice as any)?.parent?.subscription_details?.subscription;
    if (typeof parentSubscription === "string") return parentSubscription;
    if (parentSubscription && typeof parentSubscription === "object" && "id" in parentSubscription) {
        return (parentSubscription as { id: string }).id;
    }

    const legacySubscription = (invoice as any)?.subscription;
    if (typeof legacySubscription === "string") return legacySubscription;
    if (legacySubscription && typeof legacySubscription === "object" && "id" in legacySubscription) {
        return (legacySubscription as { id: string }).id;
    }

    return null;
}

async function syncSubscriptionFromStripe(stripeSubscriptionId: string, userIdFromSession?: string | null) {
    const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ["items.data.price.product", "customer"],
    });

    const price = stripeSub.items.data[0]?.price;
    const priceId = price?.id ?? null;
    const productName =
        typeof price?.product === "object" && price.product
            ? (price.product as Stripe.Product).name
            : null;

    const existing = await prisma.subscriptions.findFirst({
        where: { legacy_id: stripeSub.id },
        include: {
            subscription_plans: true,
        },
    });

    const userId = userIdFromSession ?? existing?.user_id ?? null;
    if (!userId) return null;

    const user = await prisma.users.findFirst({
        where: { id: userId },
        select: {
            id: true,
            name: true,
            barbershop_links: {
                select: {
                    barbershop_id: true,
                },
            },
        },
    });

    if (!user) return null;

    const barbershopId = user.barbershop_links[0]?.barbershop_id ?? existing?.barbershop_id ?? null;
    if (!barbershopId) return null;

    const planWhere: Prisma.subscription_plansWhereInput = {};
    if (productName) {
        planWhere.name = productName;
        planWhere.barbershop_id = barbershopId;
    }

    const localPlan = productName
        ? await prisma.subscription_plans.findFirst({ where: planWhere })
        : null;

    const nextBillingDate =
        stripeSub.items.data[0]?.current_period_end
            ? new Date(stripeSub.items.data[0].current_period_end * 1000)
            : null;

    const status = mapStripeSubscriptionStatusToLocal(stripeSub.status);
    const resolvedPlanId =
        localPlan?.id ??
        existing?.plan_id ??
        existing?.subscription_plans?.id ??
        null;

    const payload: Prisma.subscriptionsUncheckedUpdateInput = {
        barbershop_id: barbershopId,
        legacy_id: stripeSub.id,
        user_id: user.id,
        amount: localPlan?.price ?? existing?.amount ?? null,
        status,
        started_at: new Date((stripeSub.start_date ?? stripeSub.created) * 1000),
        next_billing_at: nextBillingDate,
        last_billing_at: status === "active" ? new Date() : existing?.last_billing_at ?? null,
        is_recurring: true,
        payment_method: "subscription",
        auto_renewal: !stripeSub.cancel_at_period_end,
        days_overdue: stripeSub.status === "past_due" ? 1 : 0,
        updated_at: new Date(),
    };

    if (existing) {
        if (resolvedPlanId) {
            payload.plan_id = resolvedPlanId;
        }

        return prisma.subscriptions.update({
            where: { id: existing.id },
            data: payload,
        });
    }

    if (!resolvedPlanId) {
        console.warn("Webhook Stripe: assinatura sem plan_id resolvido", {
            stripeSubscriptionId: stripeSub.id,
            stripePriceId: priceId,
        });
        return null;
    }

    const createData: Prisma.subscriptionsUncheckedCreateInput = {
        barbershop_id: barbershopId,
        legacy_id: stripeSub.id,
        user_id: user.id,
        plan_id: resolvedPlanId,
        amount: localPlan?.price ?? null,
        status,
        started_at: new Date((stripeSub.start_date ?? stripeSub.created) * 1000),
        next_billing_at: nextBillingDate,
        last_billing_at: status === "active" ? new Date() : null,
        is_recurring: true,
        payment_method: "subscription",
        auto_renewal: !stripeSub.cancel_at_period_end,
        days_overdue: stripeSub.status === "past_due" ? 1 : 0,
        created_at: new Date(),
        updated_at: new Date(),
    };

    return prisma.subscriptions.create({
        data: createData,
    });
}

async function registerPaymentTransactionFromInvoice(invoice: Stripe.Invoice) {
    const stripeSubscriptionId = getInvoiceSubscriptionId(invoice);

    if (!stripeSubscriptionId) return;

    const localSub = await prisma.subscriptions.findFirst({
        where: { legacy_id: stripeSubscriptionId },
    });

    if (!localSub) return;

    const amountPaid = typeof invoice.amount_paid === "number" ? invoice.amount_paid / 100 : 0;
    const paidAtUnix = (invoice as any)?.status_transitions?.paid_at as number | null | undefined;
    const isPaid = invoice.status === "paid" || Boolean(paidAtUnix);
    const status: payment_status = isPaid ? "paid" : "pending";

    const alreadyExists = await prisma.payment_transactions.findFirst({
        where: {
            stripe_invoice_id: invoice.id,
        },
    });

    const updateData: Prisma.payment_transactionsUncheckedUpdateInput = {
        barbershop_id: localSub.barbershop_id,
        user_id: localSub.user_id,
        subscription_id: localSub.id,
        amount: amountPaid,
        method: "subscription" as payment_method,
        status,
        status_raw: invoice.status ?? null,
        paid_at: isPaid ? new Date((paidAtUnix ?? Math.floor(Date.now() / 1000)) * 1000) : null,
        stripe_invoice_id: invoice.id,
        updated_at: new Date(),
    };

    if (alreadyExists) {
        return prisma.payment_transactions.update({
            where: { id: alreadyExists.id },
            data: updateData,
        });
    }

    const createData: Prisma.payment_transactionsUncheckedCreateInput = {
        barbershop_id: localSub.barbershop_id,
        user_id: localSub.user_id,
        subscription_id: localSub.id,
        amount: amountPaid,
        method: "subscription",
        status,
        status_raw: invoice.status ?? null,
        paid_at: isPaid ? new Date((paidAtUnix ?? Math.floor(Date.now() / 1000)) * 1000) : null,
        stripe_invoice_id: invoice.id,
        created_at: new Date(),
        updated_at: new Date(),
    };

    return prisma.payment_transactions.create({
        data: createData,
    });
}

async function syncConnectAccountStatus(account: Stripe.Account) {
    const barbershopId = String(account.metadata?.barbershopId || '').trim();
    if (!barbershopId) return;

    await prisma.barbershops.updateMany({
        where: {
            id: barbershopId,
            stripe_connect_account_id: account.id,
        },
        data: {
            stripe_connect_charges_enabled: account.charges_enabled,
            stripe_connect_payouts_enabled: account.payouts_enabled,
            stripe_connect_details_submitted: account.details_submitted,
            stripe_connect_onboarding_completed_at:
                account.charges_enabled && account.payouts_enabled ? new Date() : null,
            updated_at: new Date(),
        },
    });
}

async function upsertAppointmentPaymentFromIntent(intent: Stripe.PaymentIntent, status: payment_status) {
    const metadata = intent.metadata || {};
    const appointmentId = String(metadata.appointmentId || '').trim();
    const userId = String(metadata.userId || '').trim();
    const barbershopId = String(metadata.barbershopId || '').trim();

    if (!appointmentId || !barbershopId) return;

    const amount = typeof intent.amount_received === 'number' && intent.amount_received > 0
        ? intent.amount_received / 100
        : intent.amount / 100;

    const methodType = intent.payment_method_types?.includes('pix') ? 'pix' : 'credito';
    const chargeId = typeof intent.latest_charge === 'string' ? intent.latest_charge : null;
    const destinationAccountId = String(metadata.destinationAccountId || '').trim() || null;
    const applicationFeeAmount = intent.application_fee_amount ?? null;

    const existing = await prisma.payment_transactions.findFirst({
        where: {
            OR: [
                { appointment_id: appointmentId, barbershop_id: barbershopId },
                { stripe_payment_intent_id: intent.id },
            ],
        },
    });

    const data: Prisma.payment_transactionsUncheckedUpdateInput = {
        appointment_id: appointmentId,
        user_id: userId || null,
        barbershop_id: barbershopId,
        amount,
        method: methodType as payment_method,
        status,
        status_raw: intent.status,
        paid_at: status === 'paid' ? new Date() : null,
        stripe_payment_intent_id: intent.id,
        stripe_charge_id: chargeId,
        stripe_destination_account_id: destinationAccountId,
        stripe_application_fee_amount: applicationFeeAmount,
        updated_at: new Date(),
    };

    if (existing) {
        await prisma.payment_transactions.update({
            where: { id: existing.id },
            data,
        });
        return;
    }

    const createData: Prisma.payment_transactionsUncheckedCreateInput = {
        appointment_id: appointmentId,
        user_id: userId || null,
        barbershop_id: barbershopId,
        amount,
        method: methodType as payment_method,
        status,
        status_raw: intent.status,
        paid_at: status === 'paid' ? new Date() : null,
        stripe_payment_intent_id: intent.id,
        stripe_charge_id: chargeId,
        stripe_destination_account_id: destinationAccountId,
        stripe_application_fee_amount: applicationFeeAmount,
        created_at: new Date(),
        updated_at: new Date(),
    };

    await prisma.payment_transactions.create({ data: createData });
}

router.post(
    "/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
        const signature = req.headers["stripe-signature"] as string;

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(
                req.body,
                signature,
                process.env.STRIPE_WEBHOOK_SECRET as string
            );
        } catch (error: any) {
            console.error("Erro ao validar webhook Stripe:", error.message);
            return res.status(400).send(`Webhook Error: ${error.message}`);
        }

        try {
            switch (event.type) {
                case "checkout.session.completed": {
                    const session = event.data.object as Stripe.Checkout.Session;

                    if (session.mode === "subscription" && session.subscription) {
                        await syncSubscriptionFromStripe(
                            String(session.subscription),
                            session.client_reference_id ? String(session.client_reference_id) : null
                        );
                    }
                    break;
                }

                case "customer.subscription.created":
                case "customer.subscription.updated":
                case "customer.subscription.deleted": {
                    const subscription = event.data.object as Stripe.Subscription;
                    await syncSubscriptionFromStripe(subscription.id);
                    break;
                }

                case "invoice.paid":
                case "invoice.payment_failed": {
                    const invoice = event.data.object as Stripe.Invoice;
                    const stripeSubscriptionId = getInvoiceSubscriptionId(invoice);

                    if (stripeSubscriptionId) {
                        await syncSubscriptionFromStripe(stripeSubscriptionId);
                        await registerPaymentTransactionFromInvoice(invoice);
                    }
                    break;
                }

                case "payment_intent.succeeded": {
                    const intent = event.data.object as Stripe.PaymentIntent;
                    await upsertAppointmentPaymentFromIntent(intent, 'paid');
                    break;
                }

                case "payment_intent.payment_failed": {
                    const intent = event.data.object as Stripe.PaymentIntent;
                    await upsertAppointmentPaymentFromIntent(intent, 'failed');
                    break;
                }

                case "account.updated": {
                    const account = event.data.object as Stripe.Account;
                    await syncConnectAccountStatus(account);
                    break;
                }

                default:
                    break;
            }

            return res.json({ received: true });
        } catch (error) {
            console.error("Erro processando webhook Stripe:", error);
            return res.status(500).json({ message: "Erro ao processar webhook Stripe." });
        }
    }
);

router.get("/subscriptions/active/me", asyncHandler(getMyActiveSubscription));

export default router;