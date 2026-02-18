// import { Request, Response } from "express";
// import bcrypt from "bcrypt";
// import prisma from "../database/database.js";
// import { signToken } from "../utils/jwt.js";
// import {
//   LoginSchema,
//   RegisterBarberSchema,
//   RegisterBarbershopSchema,
//   RegisterClientSchema,
// } from "../models/authSchemas.js";
// import {
//   LoginData,
//   RegisterBarberData,
//   RegisterBarbershopData,
//   RegisterClientData,
// } from "../protocols/authProtocols.js";
// import { createBarberProfile, createUser, findUserByEmail } from "../repository/authRepository.js";

// function joiErrors(error: any) {
//   return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
// }

// export async function login(req: Request, res: Response) {
//   const body = req.body as LoginData;

//   const { error } = LoginSchema.validate(body);
//   if (error) return res.status(422).send(joiErrors(error));

//   const user = await findUserByEmail(body.email);
//   if (!user) return res.sendStatus(401);

//   const ok = await bcrypt.compare(body.password, user.password_hash);
//   if (!ok) return res.sendStatus(401);

//   const token = signToken({ userId: user.id, role: user.role, isAdmin: user.is_admin });

//   // não devolve hash
//   return res.status(200).send({
//     token,
//     user: {
//       id: user.id,
//       name: user.name,
//       email: user.email,
//       phone: user.phone,
//       role: user.role,
//       isAdmin: user.is_admin,
//     },
//   });
// }

// // "Barbearia" = admin
// export async function registerBarbershop(req: Request, res: Response) {
//   const body = req.body as RegisterBarbershopData;

//   const { error } = RegisterBarbershopSchema.validate(body);
//   if (error) return res.status(422).send(joiErrors(error));

//   const existing = await findUserByEmail(body.email);
//   if (existing) return res.status(409).send(["E-mail já cadastrado"]);

//   const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
//   const passwordHash = await bcrypt.hash(body.password, rounds);

//   const user = await createUser({
//     name: body.name,
//     email: body.email,
//     phone: body.phone ?? null,
//     role: "admin",
//     isAdmin: true,
//     passwordHash,
//   });

//   const token = signToken({ userId: user.id, role: user.role, isAdmin: user.is_admin });

//   return res.status(201).send({
//     token,
//     user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, isAdmin: user.is_admin },
//   });
// }

// export async function registerClient(req: Request, res: Response) {
//   const body = req.body as RegisterClientData;

//   const { error } = RegisterClientSchema.validate(body);
//   if (error) return res.status(422).send(joiErrors(error));

//   const existing = await findUserByEmail(body.email);
//   if (existing) return res.status(409).send(["E-mail já cadastrado"]);

//   const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
//   const passwordHash = await bcrypt.hash(body.password, rounds);

//   const user = await createUser({
//     name: body.name,
//     email: body.email,
//     phone: body.phone ?? null,
//     role: "client",
//     isAdmin: false,
//     passwordHash,
//   });

//   const token = signToken({ userId: user.id, role: user.role, isAdmin: user.is_admin });

//   return res.status(201).send({
//     token,
//     user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role, isAdmin: user.is_admin },
//   });
// }

// export async function registerBarber(req: Request, res: Response) {
//   const body = req.body as RegisterBarberData;

//   const { error } = RegisterBarberSchema.validate(body);
//   if (error) return res.status(422).send(joiErrors(error));

//   const existing = await findUserByEmail(body.email);
//   if (existing) return res.status(409).send(["E-mail já cadastrado"]);

//   const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 10);
//   const passwordHash = await bcrypt.hash(body.password, rounds);

//   // cria user + perfil barber em transação
//   const result = await prisma.$transaction(async () => {
//     const user = await createUser({
//       name: body.name,
//       email: body.email,
//       phone: body.phone ?? null,
//       role: "barber",
//       isAdmin: false,
//       passwordHash,
//     });

//     const barber = await createBarberProfile({
//       userId: user.id,
//       displayName: (body.displayName?.trim() || body.name).trim(),
//       specialty: body.specialty ?? null,
//       photoUrl: body.photoUrl ?? null,
//       commissionPercent: body.commissionPercent ?? null,
//     });

//     return { user, barber };
//   });

//   const token = signToken({ userId: result.user.id, role: result.user.role, isAdmin: result.user.is_admin });

//   return res.status(201).send({
//     token,
//     user: {
//       id: result.user.id,
//       name: result.user.name,
//       email: result.user.email,
//       phone: result.user.phone,
//       role: result.user.role,
//       isAdmin: result.user.is_admin,
//     },
//     barber: {
//       id: result.barber.id,
//       displayName: result.barber.display_name,
//       specialty: result.barber.specialty,
//       photoUrl: result.barber.photo_url,
//       commissionPercent: result.barber.commission_percent,
//     },
//   });
// }


import { Request, Response } from "express";
import {
  LoginSchema,
  RegisterBarberSchema,
  RegisterBarbershopSchema,
  RegisterClientSchema,
} from "../models/authSchemas.js";
import {
  loginService,
  registerBarberService,
  registerBarbershopService,
  registerClientService,
} from "../services/authService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

export async function login(req: Request, res: Response) {
  const { error } = LoginSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await loginService(req.body);
  return res.status(200).send(result);
}

export async function registerBarbershop(req: Request, res: Response) {
  const { error } = RegisterBarbershopSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await registerBarbershopService(req.body);
  return res.status(201).send(result);
}

export async function registerClient(req: Request, res: Response) {
  const { error } = RegisterClientSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await registerClientService(req.body);
  return res.status(201).send(result);
}

export async function registerBarber(req: Request, res: Response) {
  const { error } = RegisterBarberSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const barbershopId = req.user!.barbershopId;

  const result = await registerBarberService({
    barbershopId,
    ...req.body,
  });

  return res.status(201).send(result);
}
