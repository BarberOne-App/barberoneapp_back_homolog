import {
  createEmployeePayment,
  listEmployeePayments,
} from "../repository/employeePaymentRepository.js";
import { forbidden } from "../errors/index.js";

/* ─────────────── helpers ─────────────── */
function serialize(payment: any) {
  return {
    id: payment.id,
    employeeId: payment.employee_id,
    employeeName: payment.employee_name,
    period: payment.period,
    periodStart: payment.period_start,
    periodEnd: payment.period_end,
    salarioFixo: Number(payment.base_salary),
    commission: Number(payment.commission),
    totalVales: Number(payment.total_vales),
    liquido: Number(payment.net_amount),
    paidAt: payment.paid_at,
    paidBy: payment.paid_by,
    paidByName: payment.creator?.name ?? null,
    createdAt: payment.created_at,
  };
}

/* ───────── LIST ───────── */
export async function listEmployeePaymentsService(params: {
  barbershopId: string;
  actorRole: string;
  actorId: string;
}) {
  if (params.actorRole !== "admin" && params.actorRole !== "barber" && params.actorRole !== "receptionist") {
    throw forbidden("Sem permissão para listar pagamentos de funcionários");
  }

  const employeeId = params.actorRole === "barber" ? params.actorId : undefined;
  const items = await listEmployeePayments(params.barbershopId, employeeId);
  return items.map(serialize);
}

/* ───────── CREATE ───────── */
export async function createEmployeePaymentService(params: {
  barbershopId: string;
  actorId: string;
  data: {
    employeeId: string;
    employeeName: string;
    period: string;
    periodStart: string;
    periodEnd: string;
    salarioFixo: number;
    commission: number;
    totalVales: number;
    liquido: number;
  };
}) {
  const created = await createEmployeePayment({
    employeeId: params.data.employeeId,
    employeeName: params.data.employeeName,
    period: params.data.period,
    periodStart: params.data.periodStart,
    periodEnd: params.data.periodEnd,
    baseSalary: params.data.salarioFixo,
    commission: params.data.commission,
    totalVales: params.data.totalVales,
    netAmount: params.data.liquido,
    paidBy: params.actorId,
    barbershopId: params.barbershopId,
  });

  return serialize(created);
}
