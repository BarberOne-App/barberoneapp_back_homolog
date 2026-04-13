import { Request, Response } from "express";
import {
  CreateUserSchema,
  ImportUsersSchema,
  ListUsersQuerySchema,
  UpdatePermissionsSchema,
  UpdateUserSchema,
  UserIdParamSchema,
} from "../models/userSchemas.js";
import {
  checkEmailService,
  createUserService,
  deleteUserService,
  getUserByIdService,
  importUsersService,
  listUsersService,
  updatePermissionsService,
  updateUserService,
} from "../services/userService.js";

function joiErrors(error: any) {
  return error.details?.map((d: any) => d.message) ?? ["Dados inválidos"];
}

export async function listUsers(req: Request, res: Response) {
  console.log(req.user);
  const { error, value } = ListUsersQuerySchema.validate(req.query, { abortEarly: false });
  if (error) return res.status(422).send(joiErrors(error));

  const barbershopId = '6aeb6856-c163-4b33-9b8c-4ec043f88008';

  const result = await listUsersService({
    // barbershopId: req.user!.barbershopId,
    barbershopId: barbershopId,
    actorRole: req.user!.role,
    query: {
      role: value.role,
      q: value.q,
      page: value.page,
      limit: value.limit,
    },
  });

  return res.status(200).send(result);
}

export async function getUserById(req: Request, res: Response) {
  const { error } = UserIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const barbershopId = '6aeb6856-c163-4b33-9b8c-4ec043f88008';

  const result = await getUserByIdService({
    // barbershopId: req.user!.barbershopId,
    barbershopId: barbershopId,
    userId: req.params.id,
  });

  return res.status(200).send(result);
}

export async function checkEmail(req: Request, res: Response) {
  const email = req.params.email;
  if (!email) return res.status(400).send(["Email obrigatório"]);

  const barbershopId = '6aeb6856-c163-4b33-9b8c-4ec043f88008';

  const result = await checkEmailService({
    barbershopId: barbershopId,
    // barbershopId: req.user!.barbershopId,
    email,
  });

  return res.status(200).send(result);
}

export async function createUser(req: Request, res: Response) {
  console.log(req.body);
  const { error } = CreateUserSchema.validate(req.body);
  if (error) return res.status(422).send(joiErrors(error));

  const barbershopId = '6aeb6856-c163-4b33-9b8c-4ec043f88008';

  const result = await createUserService({
    barbershopId: barbershopId,
    // barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    data: req.body,
  });

  return res.status(201).send(result);
}

export async function importUsers(req: Request, res: Response) {
  const { error, value } = ImportUsersSchema.validate(req.body, { abortEarly: false });
  if (error) return res.status(422).send(joiErrors(error));

  const barbershopId = '6aeb6856-c163-4b33-9b8c-4ec043f88008';

  const result = await importUsersService({
    barbershopId,
    actorRole: req.user!.role,
    data: {
      defaultPassword: value.defaultPassword,
      skipExisting: value.skipExisting,
      rows: value.rows,
    },
  });

  return res.status(201).send(result);
}

export async function updateUser(req: Request, res: Response) {
  const p = UserIdParamSchema.validate(req.params);
  if (p.error) return res.status(422).send(joiErrors(p.error));

  const b = UpdateUserSchema.validate(req.body, { abortEarly: false });
  if (b.error) return res.status(422).send(joiErrors(b.error));

  const barbershopId = '6aeb6856-c163-4b33-9b8c-4ec043f88008';

  const result = await updateUserService({
    barbershopId: barbershopId,
    // barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    actorId: req.user!.id,
    userId: req.params.id,
    data: b.value,
  });

  return res.status(200).send(result);
}

export async function updatePermissions(req: Request, res: Response) {
  const p = UserIdParamSchema.validate(req.params);
  if (p.error) return res.status(422).send(joiErrors(p.error));

  const b = UpdatePermissionsSchema.validate(req.body, { abortEarly: false });
  if (b.error) return res.status(422).send(joiErrors(b.error));

  const barbershopId = '6aeb6856-c163-4b33-9b8c-4ec043f88008';

  const result = await updatePermissionsService({
    barbershopId: barbershopId,
    // barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    userId: req.params.id,
    permissions: b.value.permissions,
  });

  return res.status(200).send(result);
}

export async function deleteUser(req: Request, res: Response) {
  const { error } = UserIdParamSchema.validate(req.params);
  if (error) return res.status(422).send(joiErrors(error));

  const barbershopId = '6aeb6856-c163-4b33-9b8c-4ec043f88008';

  const result = await deleteUserService({
    barbershopId: barbershopId,
    // barbershopId: req.user!.barbershopId,
    actorRole: req.user!.role,
    actorId: req.user!.id,
    userId: req.params.id,
  });

  return res.status(200).send(result);
}
