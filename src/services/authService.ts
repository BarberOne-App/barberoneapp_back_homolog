import bcrypt from "bcrypt";
import prisma from "../database/database.js";
import { signToken } from "../utils/jwt.js";
import { slugify, normalizeEmail } from "../utils/slugify.js";
import { conflict, notFound, unauthorized } from "../errors/index.js";
import {
  createBarberProfile,
  createBarbershop,
  createUser,
  findBarbershopBySlug,
  findUserByEmailInBarbershop,
} from "../repository/authRepository.js";

function isPrismaUniqueError(e: any) {
  return e?.code === "P2002";
}

function rounds() {
  return Number(process.env.BCRYPT_SALT_ROUNDS || 10);
}

export async function loginService(params: { slug: string; email: string; password: string }) {
  const slug = params.slug.trim();
  const email = normalizeEmail(params.email);

  const shop = await findBarbershopBySlug(slug);
  if (!shop) throw notFound("Barbearia não encontrada");

  const user = await findUserByEmailInBarbershop(shop.id, email);
  if (!user) throw unauthorized("Credenciais inválidas");

  const ok = await bcrypt.compare(params.password, user.password_hash);
  if (!ok) throw unauthorized("Credenciais inválidas");

  const token = signToken({
    userId: user.id,
    barbershopId: shop.id,
    role: user.role as any,
    isAdmin: user.is_admin,
  });

  return {
    token,
    barbershop: shop,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isAdmin: user.is_admin,
    },
  };
}

export async function registerBarbershopService(params: {
  barbershopName: string;
  slug?: string;
  cnpj?: string;
  phone?: string;

  adminName: string;
  adminEmail: string;
  password: string;
}) {
  const adminEmail = normalizeEmail(params.adminEmail);
  const slug = slugify(params.slug?.trim() || params.barbershopName);

  const passwordHash = await bcrypt.hash(params.password, rounds());

  try {
    const result = await prisma.$transaction(async (tx) => {
      const shop = await createBarbershop(
        {
          name: params.barbershopName.trim(),
          slug,
          cnpj: params.cnpj ?? null,
          phone: params.phone ?? null,
          email: adminEmail,
        },
        tx
      );

      const existing = await findUserByEmailInBarbershop(shop.id, adminEmail, tx);
      if (existing) throw conflict("E-mail já cadastrado nessa barbearia");

      const user = await createUser(
        {
          barbershopId: shop.id,
          name: params.adminName.trim(),
          email: adminEmail,
          phone: params.phone ?? null,
          role: "admin",
          isAdmin: true,
          passwordHash,
        },
        tx
      );

      return { shop, user };
    });

    const token = signToken({
      userId: result.user.id,
      barbershopId: result.shop.id,
      role: result.user.role as any,
      isAdmin: result.user.is_admin,
    });

    return {
      token,
      barbershop: result.shop,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        phone: result.user.phone,
        role: result.user.role,
        isAdmin: result.user.is_admin,
      },
    };
  } catch (e: any) {
    if (isPrismaUniqueError(e)) throw conflict("Slug/CNPJ já cadastrado");
    throw e;
  }
}

export async function registerClientService(params: {
  slug: string;
  name: string;
  email: string;
  phone?: string;
  password: string;
}) {
  const slug = params.slug.trim();
  const email = normalizeEmail(params.email);

  const shop = await findBarbershopBySlug(slug);
  if (!shop) throw notFound("Barbearia não encontrada");

  const existing = await findUserByEmailInBarbershop(shop.id, email);
  if (existing) throw conflict("E-mail já cadastrado nessa barbearia");

  const passwordHash = await bcrypt.hash(params.password, rounds());

  const user = await createUser({
    barbershopId: shop.id,
    name: params.name.trim(),
    email,
    phone: params.phone ?? null,
    role: "client",
    isAdmin: false,
    passwordHash,
  });

  const token = signToken({
    userId: user.id,
    barbershopId: shop.id,
    role: user.role as any,
    isAdmin: user.is_admin,
  });

  return {
    token,
    barbershop: shop,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isAdmin: user.is_admin,
    },
  };
}

export async function registerBarberService(params: {
  barbershopId: string;
  name: string;
  email: string;
  phone?: string;
  password: string;
  displayName?: string;
  specialty?: string;
  photoUrl?: string;
  commissionPercent?: number;
}) {
  const email = normalizeEmail(params.email);

  const existing = await findUserByEmailInBarbershop(params.barbershopId, email);
  if (existing) throw conflict("E-mail já cadastrado nessa barbearia");

  const passwordHash = await bcrypt.hash(params.password, rounds());

  const result = await prisma.$transaction(async (tx) => {
    const user = await createUser(
      {
        barbershopId: params.barbershopId,
        name: params.name.trim(),
        email,
        phone: params.phone ?? null,
        role: "barber",
        isAdmin: false,
        passwordHash,
      },
      tx
    );

    const barber = await createBarberProfile(
      {
        barbershopId: params.barbershopId,
        userId: user.id,
        displayName: (params.displayName?.trim() || params.name).trim(),
        specialty: params.specialty ?? null,
        photoUrl: params.photoUrl ?? null,
        commissionPercent: params.commissionPercent ?? null,
      },
      tx
    );

    return { user, barber };
  });

  return {
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      phone: result.user.phone,
      role: result.user.role,
      isAdmin: result.user.is_admin,
    },
    barber: {
      id: result.barber.id,
      displayName: result.barber.display_name,
      specialty: result.barber.specialty,
      photoUrl: result.barber.photo_url,
      commissionPercent: result.barber.commission_percent,
    },
  };
}
