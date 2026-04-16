import { Request, Response } from "express";
import {
  AppointmentIdParamSchema,
  AvailableSlotsQuerySchema,
  CreateAppointmentSchema,
  ListAppointmentsQuerySchema,
  UpdateAppointmentSchema,
} from "../models/appointmentSchemas.js";
import {
  cancelAppointmentService,
  createAppointmentService,
  getAppointmentByIdService,
  getAvailableSlotsService,
  listAppointmentsService,
  updateAppointmentService,
} from "../services/appointmentService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

/* ───── LIST ───── */
export async function listAppointments(req: Request, res: Response) {
  const { error, value } = ListAppointmentsQuerySchema.validate(req.query, {
    abortEarly: false,
  });

  if (error) {
    return res.status(422).send(joiErrors(error));
  }

  const result = await listAppointmentsService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    actorId: req.user!.id,
    query: {
      barberId: value.barberId,
      clientId: value.clientId,
      status: value.status,
      dateFrom: value.dateFrom,
      dateTo: value.dateTo,
      page: value.page,
      limit: value.limit,
      allAppointments: value.allAppointments,
    },
  });

  return res.status(200).send(result);
}

/* ───── GET BY ID ───── */
export async function getAppointmentById(req: Request, res: Response) {
  const { error } = AppointmentIdParamSchema.validate(req.params, {
    abortEarly: false,
  });

  if (error) {
    return res.status(422).send(joiErrors(error));
  }

  const result = await getAppointmentByIdService({
    barbershopId: req.user!.barbershopId,
    appointmentId: req.params.id,
  });

  return res.status(200).send(result);
}

/* ───── CREATE ───── */
export async function createAppointment(req: Request, res: Response) {
  const { error, value } = CreateAppointmentSchema.validate(req.body, {
    abortEarly: false,
  });

  if (error) {
    return res.status(422).send(joiErrors(error));
  }

  const result = await createAppointmentService({
    barbershopId: req.user!.barbershopId,
    data: value,
  });

  return res.status(201).send(result);
}

/* ───── UPDATE ───── */
export async function updateAppointment(req: Request, res: Response) {
  const paramsValidation = AppointmentIdParamSchema.validate(req.params, {
    abortEarly: false,
  });

  if (paramsValidation.error) {
    return res.status(422).send(joiErrors(paramsValidation.error));
  }

  const bodyValidation = UpdateAppointmentSchema.validate(req.body, {
    abortEarly: false,
  });

  if (bodyValidation.error) {
    return res.status(422).send(joiErrors(bodyValidation.error));
  }

  const result = await updateAppointmentService({
    barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    actorIsAdmin: req.user!.isAdmin,
    actorId: req.user!.id,
    appointmentId: req.params.id,
    data: bodyValidation.value,
  });

  return res.status(200).send(result);
}

/* ───── CANCEL (soft delete) ───── */
export async function deleteAppointment(req: Request, res: Response) {
  const { error } = AppointmentIdParamSchema.validate(req.params, {
    abortEarly: false,
  });

  if (error) {
    return res.status(422).send(joiErrors(error));
  }

  const result = await cancelAppointmentService({
    barbershopId: req.user!.barbershopId,
    appointmentId: req.params.id,
  });

  return res.status(200).send(result);
}

/* ───── AVAILABLE SLOTS ───── */
export async function getAvailableSlots(req: Request, res: Response) {
  const { error, value } = AvailableSlotsQuerySchema.validate(req.query, {
    abortEarly: false,
  });

  if (error) {
    return res.status(422).send(joiErrors(error));
  }

  const slots = await getAvailableSlotsService({
    barbershopId: req.user!.barbershopId,
    barberId: value.barberId,
    date: value.date,
    duration: value.duration,
  });

  return res.status(200).send({ slots });
}