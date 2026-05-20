import crypto from 'crypto';
import prisma from '../database/database.js';
import { pagarmeRequest } from './pagarmeApi.js';

interface PhoneData {
    country_code: string;
    area_code: string;
    number: string;
}

interface SplitOptions {
    liable: boolean;
    charge_processing_fee: boolean;
    charge_remainder_fee: boolean;
}

interface SplitItem {
    amount: number;
    recipient_id: string;
    type: 'flat';
    options: SplitOptions;
}

interface BuildSplitParams {
    amountInCents: number;
    barbershopRecipientId: string;
    platformFeeAmountInCents: number;
}

interface Card {
    brand?: string;
    last_four_digits?: string;
    last_digits?: string;
}

interface Transaction {
    card?: Card;
    qr_code?: string;
    qr_code_url?: string;
    qr_code_url_png?: string;
}

interface Charge {
    id?: string;
    status?: string;
    payment_method?: string;
    amount?: number;
    card?: Card;
    last_transaction?: Transaction;
}

interface PagarmeOrder {
    id?: string;
    code?: string;
    status?: string;
    amount?: number;
    charges?: Charge[];
}

interface NormalizedOrder {
    orderId?: string;
    orderCode?: string;
    status?: string;
    chargeId?: string;
    chargeStatus?: string;
    amount: number;
    paymentMethod?: string;
    pixQrCode: string;
    pixQrCodeUrl: string;
    cardBrand: string;
    cardLastDigits: string;
    raw: PagarmeOrder;
}

function onlyNumbers(value: string | number | undefined | null): string {
    return String(value || '').replace(/\D/g, '');
}

function toCents(value: string | number | undefined | null): number {
    return Math.round(Number(value || 0) * 100);
}

function extractPhone(phone: string | undefined | null): PhoneData | null {
    const digits = onlyNumbers(phone);

    if (digits.length < 10) return null;

    const withoutCountry = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits;

    return {
        country_code: '55',
        area_code: withoutCountry.slice(0, 2),
        number: withoutCountry.slice(2),
    };
}

function getPlatformFeeAmount(amountInCents: number, bodyFeeAmount: string | number | undefined | null): number {
    if (bodyFeeAmount !== undefined && bodyFeeAmount !== null && bodyFeeAmount !== '') {
        return Math.max(0, toCents(bodyFeeAmount));
    }

    const percent = Number(process.env.PAGARME_PLATFORM_FEE_PERCENT || 10);
    return Math.round(amountInCents * (percent / 100));
}

async function getBarbershopRecipientId(barbershopId: string | undefined | null): Promise<string | null> {
    if (!barbershopId) return null;

    // Ajuste o nome do model/campo se no seu schema estiver diferente.
    const shop = await prisma.barbershops.findUnique({
        where: { id: String(barbershopId) },
        select: { pagarme_recipient_id: true },
    });

    return shop?.pagarme_recipient_id || null;
}

function buildSplit({ amountInCents, barbershopRecipientId, platformFeeAmountInCents }: BuildSplitParams): SplitItem[] {
    const platformRecipientId = process.env.PAGARME_PLATFORM_RECIPIENT_ID;

    if (!barbershopRecipientId) {
        throw new Error('A barbearia ainda não possui pagarme_recipient_id cadastrado.');
    }

    if (!platformRecipientId || platformFeeAmountInCents <= 0) {
        return [
            {
                amount: amountInCents,
                recipient_id: barbershopRecipientId,
                type: 'flat',
                options: {
                    liable: true,
                    charge_processing_fee: true,
                    charge_remainder_fee: true,
                },
            },
        ];
    }

    const sellerAmount = Math.max(0, amountInCents - platformFeeAmountInCents);

    return [
        {
            amount: sellerAmount,
            recipient_id: barbershopRecipientId,
            type: 'flat',
            options: {
                liable: false,
                charge_processing_fee: false,
                charge_remainder_fee: false,
            },
        },
        {
            amount: platformFeeAmountInCents,
            recipient_id: platformRecipientId,
            type: 'flat',
            options: {
                liable: true,
                charge_processing_fee: true,
                charge_remainder_fee: true,
            },
        },
    ];
}

export function normalizePagarmeOrder(order: PagarmeOrder): NormalizedOrder {
    const charge = order?.charges?.[0] || {};
    const lastTransaction = charge?.last_transaction || {};
    const card = lastTransaction?.card || charge?.card || {};

    return {
        orderId: order?.id,
        orderCode: order?.code,
        status: order?.status,
        chargeId: charge?.id,
        chargeStatus: charge?.status,
        amount: Number(order?.amount || charge?.amount || 0) / 100,
        paymentMethod: charge?.payment_method,
        pixQrCode: lastTransaction?.qr_code || '',
        pixQrCodeUrl: lastTransaction?.qr_code_url || lastTransaction?.qr_code_url_png || '',
        cardBrand: card?.brand || '',
        cardLastDigits: card?.last_four_digits || card?.last_digits || '',
        raw: order,
    };
}

export async function createPagarmeOrderService(params: any) {
    const amountInCents = toCents(params.amount);

    if (!amountInCents || amountInCents <= 0) {
        throw new Error('Valor do pagamento inválido.');
    }

    const barbershopId = params?.metadata?.barbershopId;
    const barbershopRecipientId = await getBarbershopRecipientId(barbershopId);

    if (!barbershopRecipientId) {
        throw new Error('A barbearia ainda não possui pagarme_recipient_id cadastrado.');
    }

    const platformFeeAmountInCents = getPlatformFeeAmount(amountInCents, params.platformFeeAmount);

    const customerPhone = extractPhone(params?.customer?.phone);
    const customerDocument = onlyNumbers(params?.customer?.document);

    const customer = {
        name: params?.customer?.name || 'Cliente',
        email: params?.customer?.email,
        type: customerDocument.length > 11 ? 'company' : 'individual',
        document: customerDocument || undefined,
        phones: customerPhone
            ? {
                mobile_phone: customerPhone,
            }
            : undefined,
    };

    const itemName = params?.item?.name || 'Agendamento';
    const orderCode = `barberone_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    const paymentMethod = String(params.paymentMethod || '').toLowerCase();

    const payment: any = {
        payment_method: paymentMethod === 'pix' ? 'pix' : 'credit_card',
        split: buildSplit({
            amountInCents,
            barbershopRecipientId,
            platformFeeAmountInCents,
        }),
    };

    if (payment.payment_method === 'pix') {
        payment.pix = {
            expires_in: Number(process.env.PAGARME_PIX_EXPIRES_IN || 3600),
        };
    } else {
        if (!params.cardToken) {
            throw new Error('cardToken é obrigatório para pagamento com cartão.');
        }

        payment.credit_card = {
            operation_type: 'auth_and_capture',
            installments: Number(params.installments || 1),
            statement_descriptor: String(process.env.PAGARME_STATEMENT_DESCRIPTOR || 'BARBERONE')
                .replace(/[^a-zA-Z0-9 ]/g, '')
                .slice(0, 13),
            card_token: params.cardToken,
        };
    }

    const payload = {
        code: orderCode,
        closed: true,
        customer,
        items: [
            {
                amount: amountInCents,
                description: itemName,
                quantity: 1,
                code: String(params?.item?.id || 'service'),
            },
        ],
        payments: [payment],
        metadata: params.metadata || {},
    };

    const order = await pagarmeRequest('/orders', {
        method: 'POST',
        headers: {
            'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
    });

    return normalizePagarmeOrder(order);
}

export async function getPagarmeOrderStatusService(orderId: string) {
    const order = await pagarmeRequest(`/orders/${encodeURIComponent(orderId)}`, {
        method: 'GET',
    });

    return normalizePagarmeOrder(order);
}

export async function createPagarmeRecipientService(params: any) {
    const payload = {
        code: params.code || `barbershop_${params.barbershopId || crypto.randomUUID()}`,
        register_information: params.register_information,
        default_bank_account: params.default_bank_account,
        transfer_settings: params.transfer_settings || {
            transfer_enabled: true,
            transfer_interval: 'daily',
        },
        automatic_anticipation_settings: params.automatic_anticipation_settings,
        metadata: {
            barbershopId: String(params.barbershopId || ''),
            ...(params.metadata || {}),
        },
    };

    const recipient = await pagarmeRequest('/recipients', {
        method: 'POST',
        headers: {
            'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
    });

    if (params.barbershopId && recipient?.id) {
        await prisma.barbershops.update({
            where: { id: String(params.barbershopId) },
            data: { pagarme_recipient_id: recipient.id },
        });
    }

    return recipient;
}
