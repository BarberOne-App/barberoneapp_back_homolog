import bcrypt from "bcrypt";
import { conflict, forbidden, notFound } from "../errors/index.js";
import {
  createUserInBarbershop,
  deleteUserFromBarbershop,
  emailExistsInBarbershop,
  findUserByIdInBarbershop,
  listUsersInBarbershop,
  updateUserInBarbershop,
  updateUserPermissions,
} from "../repository/userRepository.js";

function rounds() {
  return Number(process.env.BCRYPT_SALT_ROUNDS || 10);
}

function serializeUser(u: any) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    cpf: u.cpf,
    birthDate: u.birth_date ?? null,
    birth_date: u.birth_date ?? null,
    role: u.role,
    isAdmin: u.is_admin,
    permissions: u.permissions,
    photoUrl: u.photo_url,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    barbershopId: u.current_barbershop_id,
    barberProfile: u.barbers ?? null,
  };
}

/* ── LIST ── */
export async function listUsersService(params: {
  barbershopId: string;
  actorRole: string;
  query: { role?: string; q?: string; page?: number; limit?: number };
}) {
  if (
    params.actorRole !== "admin" &&
    params.actorRole !== "receptionist" &&
    params.actorRole !== "barber"
  ) {
    throw forbidden("Sem permissão para listar usuários");
  }

  const page = params.query.page ?? 1;
  const limit = params.query.limit ?? 50;

  const { items, total } = await listUsersInBarbershop({
    barbershopId: params.barbershopId,
    role: params.query.role,
    q: params.query.q?.trim(),
    page,
    limit,
  });

  return {
    page,
    limit,
    total,
    items: items.map(serializeUser),
  };
}

/* ── GET BY ID ── */
export async function getUserByIdService(params: {
  barbershopId: string;
  userId: string;
}) {
  const user = await findUserByIdInBarbershop(params.barbershopId, params.userId);
  if (!user) throw notFound("Usuário não encontrado");
  return serializeUser(user);
}

/* ── CHECK EMAIL ── */
export async function checkEmailService(params: {
  barbershopId: string;
  email: string;
}) {
  const exists = await emailExistsInBarbershop(
    params.barbershopId,
    params.email.trim().toLowerCase()
  );
  return { exists };
}

/* ── CREATE ── */
export async function createUserService(params: {
  barbershopId: string;
  actorRole: string;
  data: {
    name: string;
    email: string;
    phone?: string | null;
    cpf?: string | null;
    birthDate?: string | null;
    password: string;
    role: string;
    isAdmin?: boolean;
    permissions?: Record<string, boolean>;
    photoUrl?: string | null;
  };
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode criar usuários");
  }

  const email = params.data.email.trim().toLowerCase();

  const exists = await emailExistsInBarbershop(params.barbershopId, email);
  if (exists) throw conflict("E-mail já cadastrado nessa barbearia");

  const passwordHash = await bcrypt.hash(params.data.password, rounds());

  const user = await createUserInBarbershop({
    barbershopId: params.barbershopId,
    name: params.data.name.trim(),
    email,
    phone: params.data.phone ?? null,
    cpf: params.data.cpf ?? null,
    birthDate: params.data.birthDate ?? null,
    role: params.data.role,
    isAdmin: params.data.isAdmin ?? false,
    passwordHash,
    permissions: params.data.permissions,
    photoUrl: params.data.photoUrl ?? null,
  });

  return serializeUser(user);
}

export async function importUsersService(params: {
  barbershopId: string;
  actorRole: string;
  data: {
    defaultPassword?: string;
    skipExisting?: boolean;
    rows: Array<{
      name: string;
      email: string;
      phone?: string | null;
      cpf?: string | null;
      birthDate?: string | null;
      role?: string;
      isAdmin?: boolean;
      permissions?: Record<string, boolean>;
      photoUrl?: string | null;
    }>;
  };
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode importar usuários");
  }

  const defaultPassword = params.data.defaultPassword?.trim() || "123456";
  if (defaultPassword.length < 4) {
    throw conflict("A senha padrão deve ter no mínimo 4 caracteres");
  }

  const skipExisting = params.data.skipExisting !== false;
  const seenEmails = new Set<string>();
  const created: any[] = [];
  const errors: Array<{ row: number; email?: string; message: string }> = [];
  let skippedCount = 0;

  const passwordHash = await bcrypt.hash(defaultPassword, rounds());

  for (let i = 0; i < params.data.rows.length; i += 1) {
    const rowIndex = i + 1;
    const row = params.data.rows[i];
    const email = row.email.trim().toLowerCase();

    if (seenEmails.has(email)) {
      errors.push({ row: rowIndex, email, message: "E-mail duplicado no arquivo" });
      continue;
    }
    seenEmails.add(email);

    try {
      const exists = await emailExistsInBarbershop(params.barbershopId, email);
      if (exists) {
        if (skipExisting) {
          skippedCount += 1;
          continue;
        }
        errors.push({
          row: rowIndex,
          email,
          message: "E-mail já cadastrado nessa barbearia",
        });
        continue;
      }

      const user = await createUserInBarbershop({
        barbershopId: params.barbershopId,
        name: row.name.trim(),
        email,
        phone: row.phone ?? null,
        cpf: row.cpf ?? null,
        birthDate: row.birthDate ?? null,
        role: row.role || "client",
        isAdmin: row.isAdmin ?? false,
        passwordHash,
        permissions: row.permissions,
        photoUrl: row.photoUrl ?? null,
      });

      created.push(serializeUser(user));
    } catch (error: any) {
      errors.push({
        row: rowIndex,
        email,
        message: error?.message || "Erro ao criar usuário",
      });
    }
  }

  return {
    createdCount: created.length,
    skippedCount,
    failedCount: errors.length,
    defaultPasswordApplied: defaultPassword,
    created,
    errors,
  };
}

/* ── UPDATE ── */
// export async function updateUserService(params: {
//   barbershopId: string;
//   actorRole: string;
//   actorId: string;
//   userId: string;
//   data: {
//     name?: string;
//     email?: string;
//     phone?: string | null;
//     cpf?: string | null;
//     role?: string;
//     isAdmin?: boolean;
//     photoUrl?: string | null;
//     currentPassword?: string;
//     newPassword?: string;
//   };
// }) {
//   // Admin pode editar qualquer user. Demais só a si mesmos.
//   if (params.actorRole !== "admin" && params.actorId !== params.userId) {
//     throw forbidden("Sem permissão para editar este usuário");
//   }

//   // Se não for admin, não pode mudar role/isAdmin
//   if (params.actorRole !== "admin") {
//     delete params.data.role;
//     delete params.data.isAdmin;
//   }

//   const updateData: any = {};

//   if (params.data.name !== undefined) updateData.name = params.data.name.trim();
//   if (params.data.email !== undefined) {
//     const email = params.data.email.trim().toLowerCase();
//     // checar se outro user já usa esse email
//     const exists = await emailExistsInBarbershop(params.barbershopId, email);
//     const current = await findUserByIdInBarbershop(params.barbershopId, params.userId);
//     if (exists && current?.email !== email) throw conflict("E-mail já cadastrado nessa barbearia");
//     updateData.email = email;
//   }
//   if (params.data.phone !== undefined) updateData.phone = params.data.phone ?? null;
//   if (params.data.cpf !== undefined) updateData.cpf = params.data.cpf ?? null;
//   if (params.data.role !== undefined) updateData.role = params.data.role;
//   if (params.data.isAdmin !== undefined) updateData.is_admin = params.data.isAdmin;
//   if (params.data.photoUrl !== undefined) updateData.photo_url = params.data.photoUrl ?? null;

//   const updated = await updateUserInBarbershop(params.barbershopId, params.userId, updateData);
//   if (!updated) throw notFound("Usuário não encontrado");

//   return serializeUser(updated);
// }

export async function updateUserService(params: {
  barbershopId: string;
  actorRole: string;
  actorId: string;
  userId: string;
  data: {
    name?: string;
    email?: string;
    phone?: string | null;
    cpf?: string | null;
    birthDate?: string | null;
    role?: string;
    isAdmin?: boolean;
    photoUrl?: string | null;
    currentPassword?: string;
    newPassword?: string;
    resetPassword?: string;
  };
}) {
  if (params.actorRole !== "admin" && params.actorId !== params.userId) {
    throw forbidden("Sem permissão para editar este usuário");
  }

  if (params.actorRole !== "admin") {
    delete params.data.role;
    delete params.data.isAdmin;
  }

  const current = await findUserByIdInBarbershop(params.barbershopId, params.userId);
  if (!current) throw notFound("Usuário não encontrado");

  const updateData: any = {};

  if (params.data.name !== undefined) updateData.name = params.data.name.trim();

  if (params.data.email !== undefined) {
    const email = params.data.email.trim().toLowerCase();
    const exists = await emailExistsInBarbershop(params.barbershopId, email);

    if (exists && current.email !== email) {
      throw conflict("E-mail já cadastrado nessa barbearia");
    }

    updateData.email = email;
  }

  if (params.data.phone !== undefined) updateData.phone = params.data.phone ?? null;
  if (params.data.cpf !== undefined) updateData.cpf = params.data.cpf ?? null;
  if (params.data.birthDate !== undefined) {
    updateData.birth_date = params.data.birthDate ? new Date(params.data.birthDate) : null;
  }
  if (params.data.role !== undefined) updateData.role = params.data.role;
  if (params.data.isAdmin !== undefined) updateData.is_admin = params.data.isAdmin;
  if (params.data.photoUrl !== undefined) updateData.photo_url = params.data.photoUrl ?? null;

  // ALTERAÇÃO DE SENHA
  if (params.data.resetPassword) {
    if (!params.data.newPassword) {
      throw conflict("Informe a nova senha");
    }

    updateData.password_hash = await bcrypt.hash(params.data.newPassword, rounds());
  } else if (params.data.currentPassword || params.data.newPassword) {
    if (!params.data.currentPassword || !params.data.newPassword) {
      throw conflict("Informe a senha atual e a nova senha");
    }

    const passwordOk = await bcrypt.compare(
      params.data.currentPassword,
      current.password_hash
    );

    if (!passwordOk) {
      throw forbidden("Senha atual incorreta");
    }

    updateData.password_hash = await bcrypt.hash(params.data.newPassword, rounds());
  }
  // if (params.data.currentPassword || params.data.newPassword) {
  //   if (!params.data.currentPassword || !params.data.newPassword) {
  //     throw conflict("Informe a senha atual e a nova senha");
  //   }

  //   const passwordOk = await bcrypt.compare(
  //     params.data.currentPassword,
  //     current.password_hash
  //   );

  //   if (!passwordOk) {
  //     throw forbidden("Senha atual incorreta");
  //   }

  //   updateData.password_hash = await bcrypt.hash(params.data.newPassword, 10);
  // }

  const updated = await updateUserInBarbershop(
    params.barbershopId,
    params.userId,
    updateData
  );

  if (!updated) throw notFound("Usuário não encontrado");

  return serializeUser(updated);
}

/* ── UPDATE PERMISSIONS ── */
export async function updatePermissionsService(params: {
  barbershopId: string;
  actorRole: string;
  userId: string;
  permissions: Record<string, boolean>;
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode alterar permissões");
  }

  const updated = await updateUserPermissions(
    params.barbershopId,
    params.userId,
    params.permissions
  );
  if (!updated) throw notFound("Usuário não encontrado");

  return serializeUser(updated);
}

/* ── DELETE ── */
export async function deleteUserService(params: {
  barbershopId: string;
  actorRole: string;
  actorId: string;
  userId: string;
}) {
  if (params.actorRole !== "admin") {
    throw forbidden("Apenas admin pode remover usuários");
  }

  if (params.actorId === params.userId) {
    throw forbidden("Não é possível remover a própria conta");
  }

  const deleted = await deleteUserFromBarbershop(params.barbershopId, params.userId);
  if (!deleted) throw notFound("Usuário não encontrado");

  return { ok: true };
}