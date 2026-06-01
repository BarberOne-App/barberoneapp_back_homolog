import crypto from 'crypto';
import prisma from '../database/database.js';
import { pagarmeRequest } from './pagarmeApi.js';
import { register } from 'module';

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
    paymentMethod: string;
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

// function buildSplit({ amountInCents, barbershopRecipientId, platformFeeAmountInCents, paymentMethod }: BuildSplitParams): SplitItem[] {
//     const platformRecipientId = process.env.PAGARME_PLATFORM_RECIPIENT_ID;

//     if (!barbershopRecipientId) {
//         throw new Error('A barbearia ainda não possui pagarme_recipient_id cadastrado.');
//     }


//     if (!platformRecipientId || platformFeeAmountInCents <= 0) {
//         return [
//             {
//                 amount: amountInCents,
//                 recipient_id: barbershopRecipientId,
//                 type: 'flat',
//                 options: {
//                     liable: true,
//                     charge_processing_fee: true,
//                     charge_remainder_fee: true,
//                 },
//             },
//         ];
//     }

//     const sellerAmount = Math.max(0, amountInCents - platformFeeAmountInCents);

//     return [
//         {
//             amount: sellerAmount,
//             recipient_id: barbershopRecipientId,
//             type: 'flat',
//             options: {
//                 liable: false,
//                 charge_processing_fee: false,
//                 charge_remainder_fee: false,
//             },
//         },
//         {
//             amount: platformFeeAmountInCents,
//             recipient_id: platformRecipientId,
//             type: 'flat',
//             options: {
//                 liable: true,
//                 charge_processing_fee: true,
//                 charge_remainder_fee: true,
//             },
//         },
//     ];
// }

function buildSplit({
    amountInCents,
    barbershopRecipientId,
    platformFeeAmountInCents,
    paymentMethod,
}: BuildSplitParams): SplitItem[] {
    const platformRecipientId = process.env.PAGARME_PLATFORM_RECIPIENT_ID;

    if (!barbershopRecipientId) {
        throw new Error('A barbearia ainda não possui pagarme_recipient_id cadastrado.');
    }

    const normalizedPaymentMethod = String(paymentMethod || '').toLowerCase();

    console.log('VALOR AQUI:', amountInCents);
    // PIX: não envia nada para a plataforma
    // 100% do valor vai para a barbearia
    if (normalizedPaymentMethod === 'pix') {
        if (!platformRecipientId) {
            return [
                {
                    amount: amountInCents,
                    recipient_id: barbershopRecipientId,
                    type: 'flat',
                    options: {
                        liable: false,
                        charge_processing_fee: false,
                        charge_remainder_fee: false,
                    },
                },
            ];
        }

        return [
            {
                amount: amountInCents,
                recipient_id: barbershopRecipientId,
                type: 'flat',
                options: {
                    liable: false,
                    charge_processing_fee: false,
                    charge_remainder_fee: false,
                },
            },
            {
                amount: 0,
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

    // Caso não tenha recebedor da plataforma ou taxa inválida,
    // também manda tudo para a barbearia
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

function normalizePaymentMethod(method: any) {
    const value = String(method || '').trim().toLowerCase();

    if (value === 'pix') return 'pix';

    if (
        value === 'card' ||
        value === 'cartao' ||
        value === 'cartão' ||
        value === 'credit_card' ||
        value === 'creditcard'
    ) {
        return 'credit_card';
    }

    throw new Error(`Método de pagamento inválido: ${method}`);
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
        type: 'individual',
        document: params?.customer?.document,
        phones: { mobile_phone: { country_code: '55', area_code: '32', number: customerPhone } },
    };

    const itemName = params?.item?.name || 'Agendamento';
    const orderCode = `barberone_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;

    const paymentMethod = normalizePaymentMethod(params.paymentMethod);

    const payment: any = {
        payment_method: paymentMethod,
        split: buildSplit({
            paymentMethod,
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

        const billingAddress = {
            line_1: '123, Rua Teste, Centro',
            line_2: 'Casa',
            zip_code: '36880000',
            city: 'Muriae',
            state: 'MG',
            country: 'BR',
        };

        payment.credit_card = {
            operation_type: 'auth_and_capture',
            installments: 1,
            statement_descriptor: 'Minas Gerais',
            card_token: params.cardToken,
            card: {
                billing_address: billingAddress,
            },
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
                code: '1234',
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

    console.log('Pagarme order created:', JSON.stringify(order.charges?.[0]?.last_transaction));
    return order;
}

export async function getPagarmeOrderStatusService(orderId: string) {
    const order = await pagarmeRequest(`/orders/${encodeURIComponent(orderId)}`, {
        method: 'GET',
    });

    return normalizePagarmeOrder(order);
}

export async function createPagarmeRecipientService(params: any) {
    const payload = buildPagarmeRecipientPayload(params);

    const recipient = await pagarmeRequest('/recipients', {
        method: 'POST',
        headers: {
            'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
    });

    const shouldLinkBarbershop = params.linkBarbershop === true;

    if (params.barbershopId && !shouldLinkBarbershop) {
        throw new Error('Vinculação da barbearia ao recebedor precisa ser feita explicitamente pelo admin.');
    }

    if (params.barbershopId && recipient?.id && shouldLinkBarbershop) {
        const existingBarbershop = await prisma.barbershops.findUnique({
            where: { id: String(params.barbershopId) },
            select: { id: true },
        });

        if (existingBarbershop) {
            await prisma.barbershops.update({
                where: { id: String(params.barbershopId) },
                data: {
                    pagarme_recipient_id: recipient.id,
                    pagarme_recipient_status: recipient.status || recipient?.status_raw || null,
                },
            });
        }
    }

    return recipient;
}

function buildPagarmeRecipientPayload(params: any) {
    return {
        register_information: params.register_information || params.registerInformation,
        default_bank_account: params.default_bank_account || params.defaultBankAccount,
        transfer_settings: {
            transfer_enabled: true,
            transfer_interval: 'daily',
            transfer_day: 0,
        },
        automatic_anticipation_settings:
            params.automatic_anticipation_settings || params.automaticAnticipationSettings,
        metadata: {
            barbershopId: String(params.barbershopId || ''),
            ...(params.metadata || {}),
        },
        code: params.code || `barbershop_${params.barbershopId || crypto.randomUUID()}`,
    };
}

export async function getPagarmeRecipientService(recipientId: string) {
    if (!recipientId) {
        throw new Error('Recipient ID é obrigatório.');
    }

    return pagarmeRequest(`/recipients/${recipientId}`, {
        method: 'GET',
    });
}

function buildPagarmeRecipientUpdatePayload(params: any) {
    const registerInformation =
        params.register_information || params.registerInformation;

    if (!registerInformation) {
        throw new Error('register_information é obrigatório para atualizar o recebedor.');
    }

    return {
        register_information: registerInformation,
        metadata: {
            barbershopId: String(params.barbershopId || ''),
            ...(params.metadata || {}),
        },
    };
}

export async function updatePagarmeRecipientService(params: any) {
    const recipientId = String(params.recipientId || params.id || '').trim();

    if (!recipientId) {
        throw new Error('Recipient ID é obrigatório para atualização.');
    }

    const payload = buildPagarmeRecipientUpdatePayload(params);

    console.log(
        'PAYLOAD UPDATE RECIPIENT PAGARME:',
        JSON.stringify(payload, null, 2)
    );

    const updateResult = await pagarmeRequest(`/recipients/${recipientId}`, {
        method: 'PUT',
        headers: {
            'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify(payload),
    });

    console.log(
        'RETORNO UPDATE RECIPIENT PAGARME:',
        JSON.stringify(updateResult, null, 2)
    );

    const refreshedRecipient = await pagarmeRequest(`/recipients/${recipientId}`, {
        method: 'GET',
    });

    console.log(
        'RECIPIENT APÓS GET:',
        JSON.stringify(refreshedRecipient, null, 2)
    );

    const shouldLinkBarbershop = params.linkBarbershop === true;

    if (params.barbershopId && !shouldLinkBarbershop) {
        throw new Error('Vinculação da barbearia ao recebedor precisa ser feita explicitamente pelo admin.');
    }

    if (params.barbershopId && shouldLinkBarbershop) {
        await prisma.barbershops.update({
            where: { id: String(params.barbershopId) },
            data: {
                pagarme_recipient_id: refreshedRecipient?.id || recipientId,
                pagarme_recipient_status:
                    refreshedRecipient?.status ||
                    refreshedRecipient?.status_raw ||
                    null,
            },
        });
    }

    return refreshedRecipient;
}


// export async function updatePagarmeRecipientService(params: any) {
//     const recipientId = String(params.recipientId || params.id || '').trim();

//     if (!recipientId) {
//         throw new Error('Recipient ID é obrigatório para atualização.');
//     }

//     const payload = buildPagarmeRecipientPayload(params);

//     const recipient = await pagarmeRequest(`/recipients/${recipientId}`, {
//         method: 'PUT',
//         headers: {
//             'Idempotency-Key': crypto.randomUUID(),
//         },
//         body: JSON.stringify(payload),
//     });

//     const shouldLinkBarbershop = params.linkBarbershop === true;

//     if (params.barbershopId && !shouldLinkBarbershop) {
//         throw new Error('Vinculação da barbearia ao recebedor precisa ser feita explicitamente pelo admin.');
//     }

//     if (params.barbershopId && recipient?.id && shouldLinkBarbershop) {
//         const existingBarbershop = await prisma.barbershops.findUnique({
//             where: { id: String(params.barbershopId) },
//             select: { id: true },
//         });

//         if (existingBarbershop) {
//             await prisma.barbershops.update({
//                 where: { id: String(params.barbershopId) },
//                 data: {
//                     pagarme_recipient_id: recipient.id,
//                     pagarme_recipient_status: recipient.status || recipient?.status_raw || null,
//                 },
//             });
//         }
//     }

//     return recipient;
// }
