
import { NextFunction, Request, Response } from "express";
import prisma from "../database/database.js";
import { verifyToken } from "../utils/jwt.js";
import { unauthorized, forbidden } from "../errors/index.js";

function getBearerToken(req: Request) {
  const auth = req.header("authorization") || "";
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) return next(unauthorized("Token ausente"));

  let payload: ReturnType<typeof verifyToken>;
  try {
    payload = verifyToken(token);
  } catch {
    return next(unauthorized("Token inválido"));
  }

  const user = await prisma.users.findUnique({
    where: { id: payload.userId },
    select: {
      id: true,
      current_barbershop_id: true,
      role: true,
      is_admin: true,
      name: true,
      email: true,
    },
  });

  if (!user) return next(unauthorized("Usuário inválido"));

  // evita token trocado entre barbearias
  if (user.current_barbershop_id !== payload.barbershopId) return next(unauthorized("Token inválido para essa barbearia"));

  req.user = {
    id: user.id,
    barbershopId: user.current_barbershop_id,
    role: user.role as any,
    isAdmin: user.is_admin,
    name: user.name,
    email: user.email ?? "",
  };

  next();
}

export function requireRole(...roles: Array<"admin" | "barber" | "client">) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(unauthorized("Não autenticado"));
    if (!roles.includes(req.user.role)) return next(forbidden("Sem permissão"));
    next();
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(unauthorized("Não autenticado"));
  if (req.user.role !== "admin" && !req.user.isAdmin) return next(forbidden("Apenas admin"));
  next();
}

/**
 * Middleware que tenta autenticar via JWT, mas **não bloqueia** se não houver token.
 * Usado nas rotas de pagamento enquanto o frontend não integra o login real.
 * TODO: remover quando o auth estiver integrado — trocar por requireAuth.
 */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = getBearerToken(req);
  if (!token) return next(); // segue sem req.user

  try {
    const payload = verifyToken(token);
    const user = await prisma.users.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        current_barbershop_id: true,
        role: true,
        is_admin: true,
        name: true,
        email: true,
      },
    });

    if (user && user.current_barbershop_id === payload.barbershopId) {
      req.user = {
        id: user.id,
        barbershopId: user.current_barbershop_id,
        role: user.role as any,
        isAdmin: user.is_admin,
        name: user.name,
        email: user.email ?? "",
      };
    }
  } catch {
    // Token inválido — segue sem req.user
  }

  next();
}
