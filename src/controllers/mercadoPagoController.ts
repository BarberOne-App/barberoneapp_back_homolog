import { Request, Response } from "express";
import {
  CreateCheckoutSchema,
  CreatePixSchema,
  ProcessPaymentSchema,
  TransactionIdParamSchema,
} from "../models/mercadoPagoSchemas.js";
import {
  createCheckoutPreference,
  createPixPayment,
  processPayment,
  getPaymentStatusService,
} from "../services/mercadoPagoService.js";
import { MercadoPagoConfig, Payment, Preference } from "mercadopago";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

/* ═══════ POST /mercadopago/checkout ═══════ */
export async function createCheckout(req: Request, res: Response) {
  const { error, value } = CreateCheckoutSchema.validate(req.body, { abortEarly: false });
  if (error) return res.status(422).send(joiErrors(error));

  const barbershopId = req.user?.barbershopId ?? value.barbershopId ?? "test";
  const userId = req.user?.id ?? value.userId ?? "test";

  const result = await createCheckoutPreference({
    barbershopId,
    userId,
    appointmentId: value.appointmentId,
    items: value.items,
    payer: value.payer,
    backUrls: value.backUrls,
  });

  return res.status(201).send(result);
}

/* ═══════ POST /mercadopago/process-payment (Checkout Transparente) ═══════ */
// export async function processPaymentController(req: Request, res: Response) {
//   const { error, value } = ProcessPaymentSchema.validate(req.body, { abortEarly: false });
//   if (error) return res.status(422).send(joiErrors(error));

//   // Usa JWT se disponível, senão body, senão placeholder (modo teste sem auth/banco)
//   const barbershopId = req.user?.barbershopId ?? value.barbershopId ?? "test";
//   const userId = req.user?.id ?? value.userId ?? "test";

//   const result = await processPayment({
//     barbershopId,
//     userId,
//     appointmentId: value.appointmentId,
//     transactionAmount: value.transactionAmount,
//     description: value.description,
//     token: value.token,
//     issuerId: value.issuerId,
//     paymentMethodId: value.paymentMethodId,
//     installments: value.installments,
//     payer: value.payer,
//   });

//   return res.status(201).send(result);
// }

const client = new MercadoPagoConfig({ accessToken: 'APP_USR-6875497196865280-021114-9152b2d1afbda8e50dd61fee0f6921fe-3198516818' });
const payments = new Payment(client);

export async function processPaymentController(req: Request, res: Response) {
  payments.create({
    body: {
      transaction_amount: 100,
      payment_method_id: 'credit_card',
      payer: {
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        identification: {
          type: 'CPF',
          number: '12345678909'
        },
        address: {
          zip_code: '88000000',
          city: 'São Paulo',
          neighborhood: 'Jardim Paulista',
          street_name: 'Rua da Consolação',
          street_number: '1234',
          federal_unit: 'SP'
        }
      }
    },
    requestOptions: { idempotencyKey: '1234567890' }
  })
    .then((result) => console.log(result))
    .catch((error) => console.log(error));
}

/* ═══════ POST /mercadopago/pix (retrocompat) ═══════ */
export async function createPix(req: Request, res: Response) {
  const { error, value } = CreatePixSchema.validate(req.body, { abortEarly: false });
  if (error) return res.status(422).send(joiErrors(error));

  const barbershopId = req.user?.barbershopId ?? value.barbershopId ?? "test";
  const userId = req.user?.id ?? value.userId ?? "test";

  const result = await createPixPayment({
    barbershopId,
    userId,
    appointmentId: value.appointmentId,
    amount: value.amount,
    description: value.description,
    payer: value.payer,
  });

  return res.status(201).send(result);
}

/* ═══════ GET /mercadopago/status/:id ═══════ */
export async function getTransactionStatus(req: Request, res: Response) {
  const { error } = TransactionIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  // Fallback: aceita barbershopId via query, ou usa placeholder (modo teste)
  const barbershopId = req.user?.barbershopId ?? (req.query.barbershopId as string) ?? "test";

  const result = await getPaymentStatusService({
    barbershopId,
    transactionId: req.params.id,
  });

  return res.status(200).send(result);
}
