
import { Request, Response } from "express";
import {
  LoginSchema,
  RegisterBarberSchema,
  RegisterBarbershopSchema,
  RegisterClientSchema,
  RefreshTokenSchema,
  RegisterClientGoogleSchema
} from "../models/authSchemas.js";
import {
  loginService,
  meService,
  refreshTokenService,
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
  console.log("Registering client with data:", req.body);
  const { error } = RegisterClientSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await registerClientService(req.body);
  return res.status(201).send(result);
}

export async function registerClientGoogle(req: Request, res: Response) {
  console.log("Registering client with data:", req.body);
  const { error } = RegisterClientGoogleSchema.validate(req.body);
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

export async function me(req: Request, res: Response) {
  const result = await meService(req.user!.id);
  return res.status(200).send(result);
}

export async function refresh(req: Request, res: Response) {
  const { error } = RefreshTokenSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const result = await refreshTokenService(req.body.refreshToken);
  return res.status(200).send(result);
}

export async function logout(_req: Request, res: Response) {
  // Sem blacklist/Redis por ora — o frontend descarta os tokens localmente.
  // Quando houver Redis, invalidar o refresh token aqui.
  return res.status(200).send({ message: "Logout realizado com sucesso" });
}
