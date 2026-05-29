import crypto from 'crypto';
import prisma from '../database/database.js';
import { pagarmeRequest } from './pagarmeApi.js';

function onlyNumbers(value: any) {
    return String(value || '').replace(/\D/g, '');
}

function extractPhone(phone: any) {
    const digits = onlyNumbers(phone);

    if (digits.length < 10) {
        return {
            country_code: '55',
            area_code: '32',
            number: '999999999',
        };
    }

    const withoutCountry = digits.startsWith('55') && digits.length > 11
        ? digits.slice(2)
        : digits;

    return {
        country_code: '55',
        area_code: withoutCountry.slice(0, 2),
        number: withoutCountry.slice(2),
    };
}

function normalizeSubscriptionStatus(value: any) {
    const normalized = String(value || '').trim().toLowerCase();

    if (normalized === 'canceled') return 'cancelled';
    if (normalized === 'active') return 'active';
    if (normalized === 'paid') return 'active';
    if (normalized === 'pending_payment') return 'pending';
    if (normalized === 'past_due') return 'paused';

    return normalized || 'active';
}

function parseDate(value: any) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function resolveAmountInReais(value: any) {
    if (value === null || value === undefined || value === '') return null;

    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;

    return numeric > 1000 ? numeric / 100 : numeric;
}

function extractAmountFromSubscription(subscription: any) {
    const rawAmount =
        subscription?.plan?.items?.[0]?.pricing_scheme?.price ??
        subscription?.plan?.items?.[0]?.amount ??
        subscription?.items?.[0]?.pricing_scheme?.price ??
        subscription?.items?.[0]?.amount ??
        subscription?.amount ??
        null;

    return resolveAmountInReais(rawAmount);
}

export async function createPagarmeBarbershopPlatformSubscriptionService(params: any, currentUser: any) {
    const barbershopId = String(params.barbershopId || currentUser?.barbershopId || '').trim();
    if (!barbershopId) {
        throw new Error('Barbearia não identificada para criar a assinatura da plataforma.');
    }

    const platformPlanId = String(params.platformPlanId || '').trim();
    if (!platformPlanId) {
        throw new Error('ID do plano da plataforma é obrigatório.');
    }

    // Busca o plano da plataforma no banco para obter o pagarme_plan_id
    const platformPlan = await prisma.platform_plans.findUnique({
        where: { id: platformPlanId },
        select: {
            id: true,
            name: true,
            pagarme_plan_id: true,
            active: true,
            price: true,
        },
    });

    if (!platformPlan) {
        throw new Error('Plano da plataforma não encontrado.');
    }

    if (!platformPlan.active) {
        throw new Error('Este plano da plataforma não está mais disponível.');
    }

    if (!platformPlan.pagarme_plan_id) {
        throw new Error(`Plano "${platformPlan.name}" não possui ID do Pagar.me configurado.`);
    }

    const pagarmePlanId = platformPlan.pagarme_plan_id;

    const shop = await prisma.barbershops.findUnique({
        where: { id: barbershopId },
        select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            cnpj: true,
            selected_plan: true,
            platform_subscription_status: true,
        },
    });

    if (!shop) {
        throw new Error('Barbearia não encontrada.');
    }

    const existingActiveSubscription = await prisma.barbershop_platform_subscriptions.findFirst({
        where: {
            barbershop_id: barbershopId,
            status: 'active',
            canceled_at: null,
        },
    });

    const isUpgrade = Boolean(params.isUpgrade);

    if (existingActiveSubscription && !isUpgrade) {
        throw new Error('A barbearia já possui uma assinatura ativa da plataforma.');
    }

    // Upgrade: cancela a assinatura atual no Pagar.me antes de criar a nova
    if (existingActiveSubscription && isUpgrade) {
        if (existingActiveSubscription.pagarme_subscription_id) {
            try {
                await pagarmeRequest(`/subscriptions/${existingActiveSubscription.pagarme_subscription_id}/cancel`, {
                    method: 'DELETE',
                });
            } catch (err: any) {
                console.error('[createPlatformSub] Erro ao cancelar assinatura anterior no Pagar.me:', err?.message);
            }
        }
        await prisma.barbershop_platform_subscriptions.update({
            where: { barbershop_id: barbershopId },
            data: { status: 'cancelled', canceled_at: new Date(), updated_at: new Date() },
        });
    }

    if (!params.cardToken) {
        throw new Error('cardToken é obrigatório para assinatura da plataforma.');
    }

    const customerPhone = extractPhone(params.customer?.phone || currentUser?.phone || shop.phone);
    const customerDocument = onlyNumbers(params.customer?.document || currentUser?.cpf || currentUser?.document || shop.cnpj);

    const payload: any = {
        code: `barbershop_${barbershopId}`,
        plan_id: pagarmePlanId,
        payment_method: 'credit_card',
        installments: 1,
        customer: {
            name: params.customer?.name || currentUser?.name || shop.name || 'Barbearia',
            email: params.customer?.email || currentUser?.email || shop.email,
            type: 'individual',
            document: customerDocument,
            phones: {
                mobile_phone: customerPhone,
            },
        },
        card_token: params.cardToken,
        metadata: {
            type: 'barbershop_platform_subscription',
            barbershopId,
            platformPlanId,
            planName: platformPlan.name,
        },
    };

    console.log('[pagarmePlatformSubscription] Criando assinatura da plataforma', {
        barbershopId,
        platformPlanId,
        pagarmePlanId,
    });

    const pagarmeSubscription = await pagarmeRequest('/subscriptions', {
        method: 'POST',
        headers: {
            'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
    });

    const status = normalizeSubscriptionStatus(pagarmeSubscription?.status || 'active');
    const now = new Date();
    const nextBillingDate = parseDate(pagarmeSubscription?.next_billing_at);
    const planPrice = platformPlan.price ? Number(platformPlan.price) : null;
    const amount = resolveAmountInReais(params.amount) ?? extractAmountFromSubscription(pagarmeSubscription) ?? planPrice;

    const subscription = await prisma.barbershop_platform_subscriptions.upsert({
        where: { barbershop_id: barbershopId },
        update: {
            selected_plan: platformPlan.name,
            platform_plan_id: platformPlanId,
            pagarme_subscription_id: pagarmeSubscription?.id || null,
            pagarme_plan_id: pagarmePlanId,
            pagarme_customer_id: pagarmeSubscription?.customer?.id || pagarmeSubscription?.customer_id || null,
            status,
            payment_method: 'credit_card',
            amount: amount ?? null,
            start_date: parseDate(pagarmeSubscription?.start_date) || now,
            next_billing_date: nextBillingDate,
            canceled_at: status === 'cancelled' ? now : null,
            updated_at: now,
        },
        create: {
            barbershop_id: barbershopId,
            selected_plan: platformPlan.name,
            platform_plan_id: platformPlanId,
            pagarme_subscription_id: pagarmeSubscription?.id || null,
            pagarme_plan_id: pagarmePlanId,
            pagarme_customer_id: pagarmeSubscription?.customer?.id || pagarmeSubscription?.customer_id || null,
            status,
            payment_method: 'credit_card',
            amount: amount ?? null,
            start_date: parseDate(pagarmeSubscription?.start_date) || now,
            next_billing_date: nextBillingDate,
            canceled_at: status === 'cancelled' ? now : null,
        },
    });

    await prisma.barbershops.update({
        where: { id: barbershopId },
        data: {
            selected_plan: platformPlan.name,
            platform_subscription_status: status,
        },
    });

    console.log('[pagarmePlatformSubscription] Assinatura criada', {
        barbershopId,
        subscriptionId: subscription.id,
        pagarmeSubscriptionId: subscription.pagarme_subscription_id,
        status: subscription.status,
        platformPlanId,
    });

    return {
        id: subscription.id,
        status: subscription.status,
        pagarmeSubscriptionId: subscription.pagarme_subscription_id,
        pagarmePlanId: subscription.pagarme_plan_id,
        pagarmeCustomerId: subscription.pagarme_customer_id,
        platformPlanId,
        planName: platformPlan.name,
        amount: subscription.amount ? Number(subscription.amount) : null,
        barbershopId,
        raw: pagarmeSubscription,
    };
}

export async function getBarbershopPlatformSubscriptionService(barbershopId: string) {
    const subscription = await prisma.barbershop_platform_subscriptions.findUnique({
        where: { barbershop_id: barbershopId },
    });

    if (!subscription) return { subscription: null };

    let plan = null;
    if (subscription.platform_plan_id) {
        const planRecord = await prisma.platform_plans.findUnique({
            where: { id: subscription.platform_plan_id },
            include: { features: { orderBy: { sort_order: 'asc' } } },
        });
        if (planRecord) {
            plan = {
                id: planRecord.id,
                name: planRecord.name,
                price: planRecord.price ? Number(planRecord.price) : null,
                interval: planRecord.interval,
                intervalCount: planRecord.interval_count,
                trialPeriodDays: planRecord.trial_period_days,
                isRecommended: planRecord.is_recommended,
                features: (planRecord.features as any[]).map(f => f.feature),
            };
        }
    }

    return {
        subscription: {
            id: subscription.id,
            status: subscription.status,
            selectedPlan: subscription.selected_plan,
            amount: subscription.amount ? Number(subscription.amount) : null,
            nextBillingDate: subscription.next_billing_date,
            startDate: subscription.start_date,
            canceledAt: subscription.canceled_at,
            pagarmeSubscriptionId: subscription.pagarme_subscription_id,
            plan,
        },
    };
}

export async function cancelBarbershopPlatformSubscriptionService(barbershopId: string) {
    const subscription = await prisma.barbershop_platform_subscriptions.findUnique({
        where: { barbershop_id: barbershopId },
    });

    if (!subscription) {
        throw new Error('Nenhuma assinatura encontrada para esta barbearia.');
    }

    if (subscription.status === 'cancelled') {
        throw new Error('A assinatura já está cancelada.');
    }

    if (subscription.pagarme_subscription_id) {
        try {
            await pagarmeRequest(`/subscriptions/${subscription.pagarme_subscription_id}/cancel`, {
                method: 'DELETE',
            });
        } catch (err: any) {
            console.error('[cancelBarbershopPlatformSub] Erro ao cancelar no Pagar.me:', err?.message);
        }
    }

    const now = new Date();
    await prisma.barbershop_platform_subscriptions.update({
        where: { barbershop_id: barbershopId },
        data: { status: 'cancelled', canceled_at: now, updated_at: now },
    });

    await prisma.barbershops.update({
        where: { id: barbershopId },
        data: { platform_subscription_status: 'cancelled' },
    });

    return { message: 'Assinatura cancelada com sucesso.' };
}

export async function syncPagarmeSubscriptionWebhook(eventType: string, subscriptionData: any, metadata: any) {
    const metadataType = String(metadata?.type || '').trim();
    const barbershopId = String(metadata?.barbershopId || subscriptionData?.metadata?.barbershopId || '').trim();
    const subscriptionId = String(subscriptionData?.id || metadata?.pagarmeSubscriptionId || '').trim();
    const status = normalizeSubscriptionStatus(subscriptionData?.status || eventType);
    const nextBillingDate = parseDate(subscriptionData?.next_billing_at);
    const amount = extractAmountFromSubscription(subscriptionData);
    const paymentMethod = String(subscriptionData?.payment_method || subscriptionData?.charges?.[0]?.payment_method || '').trim() || null;

    if (metadataType === 'barbershop_platform_subscription') {
        if (!barbershopId && !subscriptionId) {
            throw new Error('Webhook da assinatura da plataforma sem barbershopId ou subscriptionId.');
        }

        const existing = await prisma.barbershop_platform_subscriptions.findFirst({
            where: {
                OR: [
                    subscriptionId ? { pagarme_subscription_id: subscriptionId } : undefined,
                    barbershopId ? { barbershop_id: barbershopId } : undefined,
                ].filter(Boolean) as any,
            },
        });

        const targetBarbershopId = barbershopId || existing?.barbershop_id || null;
        if (!targetBarbershopId) {
            throw new Error('Não foi possível identificar a barbearia da assinatura da plataforma no webhook.');
        }

        // Resolve platform_plan_id: usa o existente ou tenta encontrar pelo pagarme_plan_id do webhook
        let platformPlanId = metadata?.platformPlanId || existing?.platform_plan_id || null;
        const pagarmePlanIdFromWebhook = String(subscriptionData?.plan?.id || '').trim();
        if (!platformPlanId && pagarmePlanIdFromWebhook) {
            const found = await prisma.platform_plans.findFirst({
                where: { pagarme_plan_id: pagarmePlanIdFromWebhook },
                select: { id: true, name: true },
            });
            if (found) platformPlanId = found.id;
        }

        const planName = metadata?.planName || existing?.selected_plan || '';

        await prisma.barbershop_platform_subscriptions.upsert({
            where: { barbershop_id: targetBarbershopId },
            update: {
                selected_plan: planName,
                platform_plan_id: platformPlanId,
                pagarme_subscription_id: subscriptionId || existing?.pagarme_subscription_id || null,
                pagarme_plan_id: pagarmePlanIdFromWebhook || existing?.pagarme_plan_id || null,
                pagarme_customer_id: subscriptionData?.customer?.id || existing?.pagarme_customer_id || null,
                status,
                payment_method: paymentMethod,
                amount: amount ?? existing?.amount ?? null,
                start_date: parseDate(subscriptionData?.start_date) || existing?.start_date || new Date(),
                next_billing_date: nextBillingDate,
                canceled_at: status === 'cancelled' ? new Date() : null,
                updated_at: new Date(),
            },
            create: {
                barbershop_id: targetBarbershopId,
                selected_plan: planName,
                platform_plan_id: platformPlanId,
                pagarme_subscription_id: subscriptionId || null,
                pagarme_plan_id: pagarmePlanIdFromWebhook || null,
                pagarme_customer_id: subscriptionData?.customer?.id || null,
                status,
                payment_method: paymentMethod,
                amount: amount ?? null,
                start_date: parseDate(subscriptionData?.start_date) || new Date(),
                next_billing_date: nextBillingDate,
                canceled_at: status === 'cancelled' ? new Date() : null,
            },
        });

        await prisma.barbershops.update({
            where: { id: targetBarbershopId },
            data: {
                ...(planName ? { selected_plan: planName } : {}),
                platform_subscription_status: status,
            },
        });

        return { handled: true, scope: 'platform_subscription', status, barbershopId: targetBarbershopId };
    }

    if (metadataType === 'client_barbershop_subscription') {
        const userId = String(metadata?.userId || subscriptionData?.customer?.id || '').trim();
        if (!barbershopId || !userId) {
            throw new Error('Webhook da assinatura do cliente sem barbershopId ou userId.');
        }

        const existing = await prisma.subscriptions.findFirst({
            where: {
                OR: [
                    subscriptionId ? { pagarme_subscription_id: subscriptionId } : undefined,
                    { barbershop_id: barbershopId, user_id: userId },
                ].filter(Boolean) as any,
            },
        });

        const paymentMethodLabel = paymentMethod === 'pix'
            ? 'pix'
            : paymentMethod === 'credit_card'
                ? 'credito'
                : paymentMethod || null;

        const amountValue = amount ?? existing?.amount ?? null;

        if (existing) {
            await prisma.subscriptions.update({
                where: { id: existing.id },
                data: {
                    status: status as any,
                    payment_method: paymentMethodLabel as any,
                    amount: amountValue,
                    pagarme_subscription_id: subscriptionId || existing.pagarme_subscription_id || null,
                    pagarme_plan_id: String(subscriptionData?.plan?.id || existing.pagarme_plan_id || metadata?.planId || '').trim() || null,
                    pagarme_customer_id: subscriptionData?.customer?.id || existing.pagarme_customer_id || null,
                    pagarme_recipient_id: subscriptionData?.split?.rules?.[0]?.recipient_id || existing.pagarme_recipient_id || null,
                    started_at: parseDate(subscriptionData?.start_date) || existing.started_at,
                    next_billing_at: nextBillingDate,
                    ended_at: status === 'cancelled' || status === 'expired' ? new Date() : null,
                    last_billing_at: status === 'active' ? new Date() : existing.last_billing_at,
                    updated_at: new Date(),
                },
            });
        } else {
            await prisma.subscriptions.create({
                data: {
                    barbershop_id: barbershopId,
                    user_id: userId,
                    plan_id: String(metadata?.planId || subscriptionData?.plan?.id || '').trim(),
                    status: status as any,
                    payment_method: paymentMethodLabel as any,
                    amount: amountValue,
                    started_at: parseDate(subscriptionData?.start_date) || new Date(),
                    next_billing_at: nextBillingDate,
                    ended_at: status === 'cancelled' || status === 'expired' ? new Date() : null,
                    auto_renewal: true,
                    is_recurring: true,
                    days_overdue: 0,
                    overdue_notification_sent: false,
                    pagarme_subscription_id: subscriptionId || null,
                    pagarme_plan_id: String(subscriptionData?.plan?.id || metadata?.planId || '').trim() || null,
                    pagarme_customer_id: subscriptionData?.customer?.id || null,
                    pagarme_recipient_id: subscriptionData?.split?.rules?.[0]?.recipient_id || null,
                    last_billing_at: new Date(),
                },
            });
        }

        return { handled: true, scope: 'client_barbershop_subscription', status, barbershopId };
    }

    return { handled: false, scope: null };
}
