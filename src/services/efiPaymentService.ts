// src/services/efiPaymentService.ts

import efiClient from '../config/efiClient.js';

type EfiCustomer = {
  name: string;
  email: string;
  cpf: string;
  phone_number?: string;
  birth?: string;
};

type EfiSplitRepass = {
  payee_code: string;
  percentage?: number;
  fixed?: number;
};

type CreateEfiCardPaymentParams = {
  amount: number;
  paymentToken: string;
  installments?: number;
  description?: string;
  customer: EfiCustomer;
  metadata?: {
    userId?: string;
    planId?: string;
    planName?: string;
    paymentId?: string;
    appointmentId?: string;
    barbershopId?: string;
    isAppointmentPayment?: string;
  };
  split?: {
    mode?: 1 | 2;
    repasses: EfiSplitRepass[];
  } | null;
};

function onlyDigits(value?: string | number | null) {
  return String(value || '').replace(/\D/g, '');
}

function toCents(amount: number) {
  return Math.round(Number(amount || 0) * 100);
}

function removeEmpty<T extends Record<string, any>>(obj: T): T {
  Object.keys(obj).forEach((key) => {
    if (
      obj[key] === undefined ||
      obj[key] === null ||
      obj[key] === ''
    ) {
      delete obj[key];
    }
  });

  return obj;
}

export async function createEfiCardPaymentService(params: CreateEfiCardPaymentParams) {
  const amountInCents = toCents(params.amount);

  if (!amountInCents || amountInCents <= 0) {
    throw new Error('Valor do pagamento inválido.');
  }

  if (!params.paymentToken) {
    throw new Error('paymentToken é obrigatório.');
  }

  if (!params.customer?.name || !params.customer?.email || !params.customer?.cpf) {
    throw new Error('Dados do pagador incompletos.');
  }

  const item: any = {
    name: params.description || params.metadata?.planName || 'Pagamento BarberOne',
    value: amountInCents,
    amount: 1,
  };

  /**
   * Split opcional:
   * No Efí, o split de boleto/cartão usa marketplace dentro do item.
   * A documentação informa que o split usa payee_code e pode ser por percentage/fixed.
   */
  if (params.split?.repasses?.length) {
    item.marketplace = {
      mode: params.split.mode || 2,
      repasses: params.split.repasses,
    };
  }

  const customId =
    params.metadata?.paymentId ||
    params.metadata?.appointmentId ||
    params.metadata?.userId ||
    `barberone_${Date.now()}`;

  const body = {
    items: [item],

    metadata: removeEmpty({
      custom_id: String(customId),
      notification_url: process.env.EFI_NOTIFICATION_URL,
    }),

    payment: {
      credit_card: {
        installments: Number(params.installments || 1),
        payment_token: params.paymentToken,

        customer: removeEmpty({
          name: params.customer.name,
          email: params.customer.email,
          cpf: onlyDigits(params.customer.cpf),
          phone_number: onlyDigits(params.customer.phone_number),
          birth: params.customer.birth,
        }),
      },
    },
  };

  try {
    const response = await efiClient.createOneStepCharge([], body);
    return response;
  } catch (error: any) {
    console.error('Erro Efí createOneStepCharge:', {
      message: error?.message,
      code: error?.code,
      error: error?.error,
      error_description: error?.error_description,
      response: error?.response?.data,
    });

    throw new Error(
      error?.response?.data?.error_description ||
      error?.error_description ||
      error?.message ||
      'Erro ao criar cobrança na Efí.'
    );
  }
}