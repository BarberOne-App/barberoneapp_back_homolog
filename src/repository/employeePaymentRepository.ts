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
    include: EMPLOYEE_PAYMENT_INCLUDE,
  });
}

export async function findEmployeePaymentByPeriod(data: {
  employeeId: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  barbershopId: string;
}) {
  return prisma.employee_payments.findFirst({
    where: {
      employee_id: data.employeeId,
      period: data.period,
      period_start: data.periodStart,
      period_end: data.periodEnd,
      barbershop_id: data.barbershopId,
    },
    include: EMPLOYEE_PAYMENT_INCLUDE,
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
    include: EMPLOYEE_PAYMENT_INCLUDE,
  });
}

export async function incrementEmployeeCommissionByPeriod(data: {
  employeeId: string;
  employeeName: string;
  period: string;
  periodStart: string;
  periodEnd: string;
  commissionAmount: number;
  paidBy: string;
  paidAt: Date;
  barbershopId: string;
}) {
  const existing = await findEmployeePaymentByPeriod({
    employeeId: data.employeeId,
    period: data.period,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    barbershopId: data.barbershopId,
  });

  if (existing) {
    return prisma.employee_payments.update({
      where: { id: existing.id },
      data: {
        employee_name: data.employeeName,
        commission: { increment: data.commissionAmount },
        net_amount: { increment: data.commissionAmount },
        paid_at: data.paidAt,
        paid_by: data.paidBy,
      },
      include: EMPLOYEE_PAYMENT_INCLUDE,
    });
  }

  return createEmployeePayment({
    employeeId: data.employeeId,
    employeeName: data.employeeName,
    period: data.period,
    periodStart: data.periodStart,
    periodEnd: data.periodEnd,
    baseSalary: 0,
    commission: data.commissionAmount,
    totalVales: 0,
    netAmount: data.commissionAmount,
    paidBy: data.paidBy,
    barbershopId: data.barbershopId,
  });
}