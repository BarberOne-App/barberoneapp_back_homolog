// import prisma from "../database/database.js";

// export async function findUserByEmail(email: string) {
//   return prisma.users.findUnique({ where: { email } });
// }

// export async function createUser(data: {
//   name: string;
//   email: string;
//   phone?: string | null;
//   role: "admin" | "barber" | "client";
//   isAdmin: boolean;
//   passwordHash: string;
// }) {
//   return prisma.users.create({
//     data: {
//       name: data.name,
//       email: data.email,
//       phone: data.phone ?? null,
//       role: data.role,
//       is_admin: data.isAdmin,
//       password_hash: data.passwordHash,
//     },
//   });
// }

// export async function createBarberProfile(data: {
//   userId: string;
//   displayName: string;
//   specialty?: string | null;
//   photoUrl?: string | null;
//   commissionPercent?: number | null;
// }) {
//   return prisma.barbers.create({
//     data: {
//       user_id: data.userId,
//       display_name: data.displayName,
//       specialty: data.specialty ?? null,
//       photo_url: data.photoUrl ?? null,
//       commission_percent: data.commissionPercent ?? null,
//     },
//   });
// }


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
    where: { barbershop_id: barbershopId, email },
  });
}

export async function createUser(
  data: {
    barbershopId: string;
    name: string;
    email: string;
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
      barbershop_id: data.barbershopId,
      name: data.name,
      email: data.email,
      phone: data.phone ?? null,
      role: data.role,
      is_admin: data.isAdmin,
      password_hash: data.passwordHash,
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
