
import prisma from "../database/database.js";
import type { Prisma, PrismaClient } from "@prisma/client";

type DB = PrismaClient | Prisma.TransactionClient;

function dbClient(tx?: Prisma.TransactionClient): DB {
  return (tx ?? prisma) as DB;
}

export async function findBarbershopBySlug(slug: string, tx?: Prisma.TransactionClient) {
  const db = dbClient(tx);
  return db.barbershops.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
}

export async function createBarbershop(
  data: {
    name: string;
    slug: string;
    cnpj?: string | null;
    phone?: string | null;
    email?: string | null;
  },
  tx?: Prisma.TransactionClient
) {
  const db = dbClient(tx);
  return db.barbershops.create({
    data: {
      name: data.name,
      slug: data.slug,
      cnpj: data.cnpj ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
    },
    select: { id: true, name: true, slug: true },
  });
}

export async function findUserByEmailInBarbershop(barbershopId: string, email: string, tx?: Prisma.TransactionClient) {
  const db = dbClient(tx);
  return db.users.findFirst({
    where: { email, barbershop_links: { some: { barbershop_id: barbershopId } } },
  });
}

/** Busca usuário por email (login sem slug) */
export async function findUserByEmail(email: string, tx?: Prisma.TransactionClient) {
  const db = dbClient(tx);
  return db.users.findFirst({
    where: { email },
    include: {
      current_barbershop: { select: { id: true, name: true, slug: true } },
    },
  });
}

export async function createUser(
  data: {
    barbershopId: string;
    name: string;
    email: string;
    cpf?: string | null;
    phone?: string | null;
    role: "admin" | "barber" | "client";
    isAdmin: boolean;
    passwordHash: string;
  },
  tx?: Prisma.TransactionClient
) {
  const db = dbClient(tx);
  return db.users.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      cpf: data.cpf ?? null,
      role: data.role,
      is_admin: data.isAdmin,
      password_hash: data.passwordHash,
      current_barbershop_id: data.barbershopId,
      barbershop_links: {
        create: {
          barbershop_id: data.barbershopId,
        },
      },
    },
  });
}

export async function createBarberProfile(
  data: {
    barbershopId: string;
    userId: string;
    displayName: string;
    specialty?: string | null;
    photoUrl?: string | null;
    commissionPercent?: number | null;
  },
  tx?: Prisma.TransactionClient
) {
  const db = dbClient(tx);
  return db.barbers.create({
    data: {
      barbershop_id: data.barbershopId,
      user_id: data.userId,
      display_name: data.displayName,
      specialty: data.specialty ?? null,
      photo_url: data.photoUrl ?? null,
      commission_percent: data.commissionPercent ?? null,
    },
  });
}

/** Busca user por ID com dados completos (usado no GET /auth/me) */
export async function findUserById(userId: string, tx?: Prisma.TransactionClient) {
  const db = dbClient(tx);
  return db.users.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      cpf: true,
      role: true,
      is_admin: true,
      permissions: true,
      photo_url: true,
      created_at: true,
      updated_at: true,
      current_barbershop_id: true,
      current_barbershop: {
        select: { id: true, name: true, slug: true },
      },
      barbers: {
        select: {
          id: true,
          display_name: true,
          specialty: true,
          photo_url: true,
          commission_percent: true,
        },
      },
      subscriptions: {
        where: { status: "active" },
        select: {
          id: true,
          plan_id: true,
          status: true,
          started_at: true,
          next_billing_at: true,
          monthly_barber_id: true,
          subscription_plans: {
            select: { id: true, name: true, price: true, cuts_per_month: true },
          },
        },
        take: 1,
      },
    },
  });
}
