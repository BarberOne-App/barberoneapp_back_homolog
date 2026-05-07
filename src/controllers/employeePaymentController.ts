import { Request, Response } from "express";
import { CreateEmployeePaymentSchema } from "../models/employeePaymentSchemas.js";
import {
  createEmployeePaymentService,
  listEmployeePaymentsService,
} from "../services/employeePaymentService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

/* ───── LIST ───── */
export async function listEmployeePayments(req: Request, res: Response) {
  try {
    const result = await listEmployeePaymentsService({
      barbershopId: req.user!.barbershopId,
      actorRole: req.user!.role,
      actorId: req.user!.id,
    });

    return res.status(200).send(result);
  } catch (err: any) {
    console.error("Erro ao listar pagamentos:", err);

    return res.status(err.status || 500).send({
      message: err.message || "Erro interno ao listar pagamentos",
    });
  }
}

/* ───── CREATE ───── */
export async function createEmployeePayment(req: Request, res: Response) {
  try {
    const { error, value } = CreateEmployeePaymentSchema.validate(req.body);

    if (error) {
      return res.status(422).send(joiErrors(error));
    }

    const result = await createEmployeePaymentService({
      barbershopId: req.user!.barbershopId,
      actorId: req.user!.id,
      data: value,
    });

    return res.status(201).send(result);
  } catch (err: any) {
    console.error("Erro ao criar pagamento:", err);

    return res.status(err.status || 500).send({
      message: err.message || "Erro interno ao criar pagamento",
    });
  }
}