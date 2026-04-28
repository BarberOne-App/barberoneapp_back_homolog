import crypto from "crypto";
import { mpPayment, mpPreference, MP_NOTIFICATION_URL } from "../config/mercadopago.js";
import prisma from "../database/database.js";
import { badRequest, notFound } from "../errors/index.js";
import { AppError } from "../errors/AppError.js";
import { syncEmployeeCommissionFromAppointmentPayment } from "./employeePaymentService.js";

/** Extrair mensagem útil de erro do SDK do Mercado Pago */
function mpError(err: any): never {
  const msg = err?.message ?? err?.cause?.message ?? "Erro desconhecido do Mercado Pago";
  const detail = err?.cause ?? err;
  console.error("[MercadoPago Error]", JSON.stringify(detail, null, 2));
  throw new AppError(502, `Mercado Pago: ${msg}`);
}

/* ══════════════════════════════════════════════════
   1) CHECKOUT PRO — criar Preferência (pagamento avulso)
   ══════════════════════════════════════════════════ */

export interface CreateCheckoutInput {
  barbershopId: string;
  userId: string;
  appointmentId?: string;
  items: {
    title: string;
    quantity: number;
    unitPrice: number;
    description?: string;
  }[];
  payer: {
    email: string;
    name?: string;
  };
  /** URL de retorno após pagamento */
  backUrls?: {
    success?: string;
    failure?: string;
    pending?: string;
  };
}

export async function createCheckoutPreference(input: CreateCheckoutInput) {
  const totalAmount = input.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  if (totalAmount <= 0) throw badRequest("Valor total deve ser maior que 0");

  // Criar registro na payment_transactions antes (status pending)
  const tx = await prisma.payment_transactions.create({
    data: {
      barbershop_id: input.barbershopId,
      user_id: input.userId,
      appointment_id: input.appointmentId ?? null,
      amount: totalAmount,
      method: "credito",          // será atualizado pelo webhook com o método real
      status: "pending",
      status_raw: "checkout_created",
    },
  });

  // Criar Preference no Mercado Pago
  const hasBackUrls = input.backUrls?.success;
  let preference: any;
  try {
    preference = await mpPreference.create({
      body: {
        items: input.items.map((i) => ({
          id: tx.id,
          title: i.title,
          quantity: i.quantity,
          unit_price: i.unitPrice,
          currency_id: "BRL",
          description: i.description,
        })),
        payer: {
          email: input.payer.email,
          name: input.payer.name,
        },
        ...(hasBackUrls
          ? {
              back_urls: {
                success: input.backUrls!.success!,
                failure: input.backUrls?.failure || input.backUrls!.success!,
                pending: input.backUrls?.pending || input.backUrls!.success!,
              },
              auto_return: "approved" as const,
            }
          : {}),
        external_reference: tx.id,
        notification_url: MP_NOTIFICATION_URL || undefined,
      },
    });
  } catch (err: any) {
    // Limpar transação órfã
    await prisma.payment_transactions.delete({ where: { id: tx.id } }).catch(() => {});
    mpError(err);
  }

  // Salvar preference id no registro
  await prisma.payment_transactions.update({
    where: { id: tx.id },
    data: {
      mp_preference_id: preference.id,
      status_raw: "preference_created",
      updated_at: new Date(),
    },
  });

  return {
    transactionId: tx.id,
    preferenceId: preference.id,
    initPoint: preference.init_point,
    sandboxInitPoint: preference.sandbox_init_point,
  };
}

/* ══════════════════════════════════════════════════
   2) CHECKOUT TRANSPARENTE — process_payment
   Recebe dados do MercadoPago.js (CardForm / PIX / Boleto)
   e cria pagamento direto via /v1/payments
   ══════════════════════════════════════════════════ */

export interface ProcessPaymentInput {
  barbershopId: string;
  userId: string;
  appointmentId?: string;
  /** Valor do pagamento */
  transactionAmount: number;
  /** Descrição do produto/serviço */
  description: string;
  /** Token gerado pelo CardForm no frontend (obrigatório para cartão) */
  token?: string;
  /** ID do emissor do cartão (obrigatório para cartão) */
  issuerId?: string;
  /** Método de pagamento (visa, master, pix, bolbradesco, etc.) */
  paymentMethodId: string;
  /** Número de parcelas (cartão). Default: 1 */
  installments?: number;
  /** Dados do pagador */
  payer: {
    email: string;
    firstName?: string;
    lastName?: string;
    identification?: {
      type: string;   // CPF, CNPJ
      number: string;
    };
    /** Endereço (obrigatório para boleto) */
    address?: {
      zipCode?: string;
      streetName?: string;
      streetNumber?: string;
      neighborhood?: string;
      city?: string;
      federalUnit?: string;
    };
  };
}

/** Verifica se um ID tem formato UUID válido */
function isValidUuid(id?: string): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export async function processPayment(input: ProcessPaymentInput) {
  if (input.transactionAmount <= 0) throw badRequest("Valor deve ser maior que 0");

  const localMethod = detectLocalMethod(input.paymentMethodId);

  /*
   * Se os IDs são UUIDs válidos (auth integrado), cria registro local no banco.
   * Caso contrário (frontend mockado), vai direto pro Mercado Pago sem salvar.
   * TODO: remover esse bypass quando o frontend integrar o login real.
   */
  const canPersist = isValidUuid(input.barbershopId);
  let tx: { id: string; appointment_id: string | null } | null = null;

  if (canPersist) {
    tx = await prisma.payment_transactions.create({
      data: {
        barbershop_id: input.barbershopId,
        user_id: isValidUuid(input.userId) ? input.userId : null,
        appointment_id: isValidUuid(input.appointmentId) ? input.appointmentId : null,
        amount: input.transactionAmount,
        method: localMethod,
        status: "pending",
        status_raw: "processing",
      },
    });
  }

  // ID usado como external_reference e idempotency key
  const referenceId = tx?.id ?? crypto.randomUUID();

  // Montar body para a API do Mercado Pago
  const paymentBody: Record<string, any> = {
    transaction_amount: input.transactionAmount,
    description: input.description,
    payment_method_id: input.paymentMethodId,
    payer: {
      email: input.payer.email,
      first_name: input.payer.firstName,
      last_name: input.payer.lastName,
      identification: input.payer.identification
        ? { type: input.payer.identification.type, number: input.payer.identification.number }
        : undefined,
    },
    external_reference: referenceId,
    notification_url: MP_NOTIFICATION_URL || undefined,
  };

  // ─── Campos específicos para cartão ───
  if (input.token) {
    paymentBody.token = input.token;
    paymentBody.installments = input.installments ?? 1;
    if (input.issuerId) paymentBody.issuer_id = input.issuerId;
  }

  // ─── Campos específicos para boleto ───
  if (input.paymentMethodId === "bolbradesco" && input.payer.address) {
    paymentBody.payer.address = {
      zip_code: input.payer.address.zipCode,
      street_name: input.payer.address.streetName,
      street_number: input.payer.address.streetNumber,
      neighborhood: input.payer.address.neighborhood,
      city: input.payer.address.city,
      federal_unit: input.payer.address.federalUnit,
    };
  }

  // Criar pagamento no Mercado Pago
  let payment: any;
  try {
    payment = await mpPayment.create({
      body: paymentBody,
      requestOptions: {
        idempotencyKey: referenceId,
      },
    });
  } catch (err: any) {
    if (tx) await prisma.payment_transactions.delete({ where: { id: tx.id } }).catch(() => {});
    mpError(err);
  }

  // Atualizar registro local (se existir) com dados do MP
  const newStatus = mapMpStatus(payment.status ?? "");

    if (tx) {
      await prisma.payment_transactions.update({
        where: { id: tx.id },
        data: {
        mp_payment_id: String(payment.id),
        status: newStatus as any,
        status_raw: payment.status,
        method: mapMpPaymentMethod(payment.payment_method_id ?? input.paymentMethodId),
        paid_at: payment.status === "approved" ? new Date() : null,
        updated_at: new Date(),
      },
    });

      // Se aprovado e tem appointment, confirmar agendamento
      if (payment.status === "approved" && tx.appointment_id) {
        await syncEmployeeCommissionFromAppointmentPayment({
          barbershopId: input.barbershopId,
          appointmentId: tx.appointment_id,
          paidAt: new Date(),
          actorId: isValidUuid(input.userId) ? input.userId : null,
        });

        await prisma.appointments.update({
          where: { id: tx.appointment_id },
          data: { status: "confirmed", updated_at: new Date() },
        }).catch(() => {});
      }
  }

  // Montar resposta baseada no tipo de pagamento
  const baseResponse = {
    transactionId: referenceId,
    mpPaymentId: payment.id,
    status: payment.status,
    statusDetail: payment.status_detail,
    paymentMethodId: payment.payment_method_id,
    paymentTypeId: payment.payment_type_id,
  };

  // PIX — incluir QR code
  if (input.paymentMethodId === "pix") {
    const pixData = payment.point_of_interaction?.transaction_data;
    return {
      ...baseResponse,
      pixQrCode: pixData?.qr_code ?? null,
      pixQrCodeBase64: pixData?.qr_code_base64 ?? null,
      ticketUrl: pixData?.ticket_url ?? null,
      expirationDate: payment.date_of_expiration ?? null,
    };
  }

  // Boleto — incluir link para pagamento
  if (input.paymentMethodId === "bolbradesco") {
    return {
      ...baseResponse,
      boletoUrl: payment.transaction_details?.external_resource_url ?? null,
      barcode: payment.barcode?.content ?? null,
      expirationDate: payment.date_of_expiration ?? null,
    };
  }

  // Cartão — se ainda está in_process, aguardar resolução via polling
  if (payment.status === "in_process" && payment.id) {
    const MAX_ATTEMPTS = 10;
    const INTERVAL_MS = 3000; // 3 segundos entre tentativas (total máx ≈ 30s)

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      await new Promise((r) => setTimeout(r, INTERVAL_MS));

      try {
        const check = await mpPayment.get({ id: String(payment.id) });
        const checkedStatus = check.status ?? "in_process";

        // Se obteve uma resposta definitiva, atualizar banco e retornar
        if (checkedStatus !== "in_process" && checkedStatus !== "pending") {
          const finalStatus = mapMpStatus(checkedStatus);

          if (tx) {
            await prisma.payment_transactions.update({
              where: { id: tx.id },
              data: {
                status: finalStatus as any,
                status_raw: checkedStatus,
                paid_at: checkedStatus === "approved" ? new Date() : null,
                updated_at: new Date(),
              },
            });

            if (checkedStatus === "approved" && tx.appointment_id) {
              await syncEmployeeCommissionFromAppointmentPayment({
                barbershopId: input.barbershopId,
                appointmentId: tx.appointment_id,
                paidAt: new Date(),
                actorId: isValidUuid(input.userId) ? input.userId : null,
              });

              await prisma.appointments.update({
                where: { id: tx.appointment_id },
                data: { status: "confirmed", updated_at: new Date() },
              }).catch(() => {});
            }
          }

          return {
            transactionId: referenceId,
            mpPaymentId: check.id,
            status: checkedStatus,
            statusDetail: check.status_detail,
            paymentMethodId: check.payment_method_id,
            paymentTypeId: check.payment_type_id,
            installments: check.installments,
            dateApproved: check.date_approved,
          };
        }
      } catch {
        // Falha na consulta — continua tentando
      }
    }

    // Esgotou tentativas e ainda está in_process — retorna o que tem
    console.warn(`[processPayment] Pagamento ${payment.id} permanece in_process após ${MAX_ATTEMPTS} tentativas`);
  }

  // Cartão — retorno padrão (aprovado direto ou timeout do polling)
  return {
    ...baseResponse,
    installments: payment.installments,
    dateApproved: payment.date_approved,
  };
}

/** Detectar método local (enum) baseado no paymentMethodId do MP */
function detectLocalMethod(mpMethodId: string): any {
  if (mpMethodId === "pix") return "pix";
  if (mpMethodId === "bolbradesco") return "credito"; // não temos "boleto" no enum
  if (mpMethodId.includes("debit") || mpMethodId === "maestro") return "debito";
  // visa, master, amex, hipercard, elo, etc → crédito
  return "credito";
}

/* ══════════════════════════════════════════════════
   2b) PIX direto (mantido para retrocompatibilidade)
   ══════════════════════════════════════════════════ */

export interface CreatePixInput {
  barbershopId: string;
  userId: string;
  appointmentId?: string;
  amount: number;
  description: string;
  payer: {
    email: string;
    firstName?: string;
    lastName?: string;
    cpf?: string;
  };
}

export async function createPixPayment(input: CreatePixInput) {
  return processPayment({
    barbershopId: input.barbershopId,
    userId: input.userId,
    appointmentId: input.appointmentId,
    transactionAmount: input.amount,
    description: input.description,
    paymentMethodId: "pix",
    payer: {
      email: input.payer.email,
      firstName: input.payer.firstName,
      lastName: input.payer.lastName,
      identification: input.payer.cpf
        ? { type: "CPF", number: input.payer.cpf }
        : undefined,
    },
  });
}

/* ══════════════════════════════════════════════════
   3) CONSULTAR STATUS DE PAGAMENTO
   ══════════════════════════════════════════════════ */

export async function getPaymentStatusService(params: {
  barbershopId: string;
  transactionId: string;
}) {
  // Tentar buscar no banco primeiro
  const tx = await prisma.payment_transactions.findFirst({
    where: { id: params.transactionId, barbershop_id: params.barbershopId },
  }).catch(() => null);

  if (tx) {
    // Se tem mp_payment_id, consultar status atualizado no MP
    if (tx.mp_payment_id) {
      try {
        const mpPay = await mpPayment.get({ id: tx.mp_payment_id });
        const newStatus = mapMpStatus(mpPay.status ?? "");

        if (newStatus !== tx.status) {
          await prisma.payment_transactions.update({
            where: { id: tx.id },
            data: {
              status: newStatus as any,
              status_raw: mpPay.status,
              paid_at: mpPay.status === "approved" ? new Date() : tx.paid_at,
              method: mapMpPaymentMethod(mpPay.payment_method_id ?? ""),
              updated_at: new Date(),
            },
          });
        }

        return {
          transactionId: tx.id,
          mpPaymentId: tx.mp_payment_id,
          status: newStatus,
          statusRaw: mpPay.status,
          amount: Number(tx.amount),
          method: mapMpPaymentMethod(mpPay.payment_method_id ?? ""),
          paidAt: mpPay.status === "approved" ? (tx.paid_at ?? new Date()) : null,
        };
      } catch {
        // Se falhou ao consultar MP, retornar dados locais
      }
    }

    return {
      transactionId: tx.id,
      mpPaymentId: tx.mp_payment_id,
      status: tx.status,
      statusRaw: tx.status_raw,
      amount: Number(tx.amount),
      method: tx.method,
      paidAt: tx.paid_at,
    };
  }

  /*
   * Modo teste (sem banco): o transactionId pode ser o mpPaymentId numérico
   * ou um UUID gerado localmente. Tenta consultar direto no MP.
   * TODO: remover quando o auth/banco estiver integrado.
   */
  try {
    const mpPay = await mpPayment.get({ id: params.transactionId });
    return {
      transactionId: params.transactionId,
      mpPaymentId: String(mpPay.id),
      status: mapMpStatus(mpPay.status ?? ""),
      statusRaw: mpPay.status,
      amount: Number(mpPay.transaction_amount),
      method: mapMpPaymentMethod(mpPay.payment_method_id ?? ""),
      paidAt: mpPay.status === "approved" ? new Date() : null,
    };
  } catch {
    throw notFound("Transação não encontrada");
  }
}

/* ══════════════════════════════════════════════════
   4) WEBHOOK — processar notificação do MP
   ══════════════════════════════════════════════════ */

export async function processWebhookNotification(data: {
  type: string;
  action?: string;
  data?: { id?: string };
  id?: number | string;
}) {
  // Notificações de pagamento
  if (data.type === "payment") {
    const paymentId = data.data?.id ?? String(data.id ?? "");
    if (!paymentId) return { processed: false, reason: "no_payment_id" };

    try {
      const mpPay = await mpPayment.get({ id: paymentId });
      const externalRef = mpPay.external_reference;

      if (!externalRef) return { processed: false, reason: "no_external_reference" };

      // Buscar transação local
      const tx = await prisma.payment_transactions.findUnique({
        where: { id: externalRef },
      });

      if (!tx) return { processed: false, reason: "transaction_not_found" };

      const newStatus = mapMpStatus(mpPay.status ?? "");
      const becameApproved = tx.status !== newStatus && mpPay.status === "approved";
      const approvedAt = mpPay.status === "approved" ? new Date() : tx.paid_at;

      await prisma.payment_transactions.update({
        where: { id: tx.id },
        data: {
          mp_payment_id: String(mpPay.id),
          status: newStatus as any,
          status_raw: mpPay.status,
          method: mapMpPaymentMethod(mpPay.payment_method_id ?? ""),
          paid_at: approvedAt,
          updated_at: new Date(),
        },
      });

      // Se pagamento aprovado e tem appointment_id, atualizar status do agendamento
      if (mpPay.status === "approved" && tx.appointment_id) {
        if (becameApproved) {
          await syncEmployeeCommissionFromAppointmentPayment({
            barbershopId: tx.barbershop_id,
            appointmentId: tx.appointment_id,
            paidAt: approvedAt,
            actorId: tx.user_id,
          });
        }

        await prisma.appointments.update({
          where: { id: tx.appointment_id },
          data: { status: "confirmed", updated_at: new Date() },
        });
      }

      return { processed: true, transactionId: tx.id, status: newStatus };
    } catch (err: any) {
      console.error("[Webhook MP] Erro ao processar pagamento:", err.message);
      return { processed: false, reason: "mp_api_error", error: err.message };
    }
  }

  // Notificações de plano (preapproval_plan) — atualizar assinatura
  if (data.type === "subscription_preapproval") {
    const preapprovalId = data.data?.id ?? String(data.id ?? "");
    if (!preapprovalId) return { processed: false, reason: "no_preapproval_id" };

    try {
      // Buscar assinatura pelo mp_preapproval_id
      const sub = await prisma.subscriptions.findFirst({
        where: { mp_preapproval_id: preapprovalId },
      });

      if (!sub) return { processed: false, reason: "subscription_not_found" };

      // Podemos atualizar status baseado no tipo de ação
      // Para assinaturas MP, geralmente verificamos o status via API
      return { processed: true, subscriptionId: sub.id };
    } catch (err: any) {
      console.error("[Webhook MP] Erro ao processar subscription:", err.message);
      return { processed: false, reason: "mp_api_error", error: err.message };
    }
  }

  return { processed: false, reason: "unhandled_type", type: data.type };
}

/* ══════════════════════════════════════════════════
   HELPERS — mapear status do MP para nosso enum
   ══════════════════════════════════════════════════ */

function mapMpStatus(mpStatus: string): string {
  switch (mpStatus) {
    case "approved":
      return "approved";
    case "authorized":
      return "approved";
    case "pending":
    case "in_process":
    case "in_mediation":
      return "pending";
    case "rejected":
    case "cancelled":
      return "failed";
    case "refunded":
    case "charged_back":
      return "refunded";
    default:
      return "pending";
  }
}

function mapMpPaymentMethod(mpMethodId: string): any {
  if (mpMethodId === "pix") return "pix";
  if (mpMethodId === "debit_card" || mpMethodId?.startsWith("debit")) return "debito";
  // credit, visa, mastercard, etc
  return "credito";
}
