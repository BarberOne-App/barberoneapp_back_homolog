import prisma from "../database/database.js";

/* ───── LIST ───── */
export async function listEmployeePayments(
  barbershopId: string,
  employeeId?: string
) {
  const where: any = { barbershop_id: barbershopId };

  if (employeeId) {
    where.employee_id = employeeId;
  }

  return prisma.employee_payments.findMany({
    where,
    orderBy: { created_at: "desc" },
    include: {
      employee: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
    },
  });
}

/* ───── FIND BY PERIOD ───── */
export async function findEmployeePaymentByPeriod(data: {
  barbershopId: string;
  employeeId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
}) {
  return prisma.employee_payments.findFirst({
    where: {
      barbershop_id: data.barbershopId,
      employee_id: data.employeeId,
      period: data.period,
      period_start: data.periodStart,
      period_end: data.periodEnd,
    },
    include: {
      employee: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
    },
  });
}

/* ───── CREATE ───── */
export async function createEmployeePayment(data: {
  employeeId: string;
  employeeName: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  baseSalary: number;
  commission: number;
  totalVales: number;
  netAmount: number;
  paidBy: string;
  barbershopId: string;
}) {
  return prisma.employee_payments.create({
    data: {
      employee_id: data.employeeId,
      employee_name: data.employeeName,
      period: data.period,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      base_salary: data.baseSalary,
      commission: data.commission,
      total_vales: data.totalVales,
      net_amount: data.netAmount,
      paid_by: data.paidBy,
      barbershop_id: data.barbershopId,
    },
    include: {
      employee: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
    },
  });
}