import { Request, Response } from "express";
import {
  CreateAppointmentPaymentSchema,
  CreatePaymentSchema,
  ListAppointmentPaymentsQuerySchema,
  ListPaymentsQuerySchema,
  PaymentIdParamSchema,
  UpdatePaymentSchema,
} from "../models/paymentSchemas.js";
import {
  createAppointmentPaymentService,
  createPaymentService,
  getPaymentByIdService,
  listAppointmentPaymentsService,
  listPaymentsService,
  updatePaymentService,
} from "../services/paymentService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

/* ═══════════ PAYMENTS (subscription) ═══════════ */

export async function listPayments(req: Request, res: Response) {
  const { error, value } = ListPaymentsQuerySchema.validate(req.query, { abortEarly: false });
  if (error) return res.status(422).send(joiErrors(error));

  const result = await listPaymentsService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    actorId: req.user!.id,
    query: {
      userId: value.userId,
      subscriptionId: value.subscriptionId,
      status: value.status,
      method: value.method,
      page: value.page,
      limit: value.limit,
    },
  });

  return res.status(200).send(result);
}

export async function getPaymentById(req: Request, res: Response) {
  const { error } = PaymentIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await getPaymentByIdService({
    barbershopId: req.user!.barbershopId,
    paymentId: req.params.id,
  });

  return res.status(200).send(result);
}

export async function createPayment(req: Request, res: Response) {
  const { error, value } = CreatePaymentSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  // const { value } = req.body;

  const result = await createPaymentService({
    barbershopId: req.user!.barbershopId,
    data: value,
  });

  return res.status(201).send(result);
}

/* ═══════════ APPOINTMENT PAYMENTS ═══════════ */

export async function listAppointmentPayments(req: Request, res: Response) {
  const { error, value } = ListAppointmentPaymentsQuerySchema.validate(req.query, { abortEarly: false });
  if (error) return res.status(422).send(joiErrors(error));

  const result = await listAppointmentPaymentsService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    actorId: req.user!.id,
    query: {
      appointmentId: value.appointmentId,
      userId: value.userId,
      status: value.status,
      page: value.page,
      limit: value.limit,
    },
  });

  return res.status(200).send(result);
}

export async function createAppointmentPayment(req: Request, res: Response) {
  const { error, value } = CreateAppointmentPaymentSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await createAppointmentPaymentService({
    barbershopId: req.user!.barbershopId,
    data: value,
  });

  return res.status(201).send(result);
}

/* ═══════════ UPDATE (shared) ═══════════ */

export async function updatePayment(req: Request, res: Response) {
  const p = PaymentIdParamSchema.validate(req.params);
  if (p.error) return res.status(422).send(joiErrors(p.error));

  const b = UpdatePaymentSchema.validate(req.body, { abortEarly: false });
  if (b.error) return res.status(422).send(joiErrors(b.error));

  const result = await updatePaymentService({
    barbershopId: req.user!.barbershopId,
    paymentId: req.params.id,
    actorId: req.user!.id,
    data: b.value,
  });

  return res.status(200).send(result);
}
