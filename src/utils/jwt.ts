// import jwt, { SignOptions } from "jsonwebtoken";

// const secret = process.env.JWT_SECRET || "dev-secret";

// export type TokenPayload = {
//   userId: string;
//   role: "admin" | "barber" | "client";
//   isAdmin: boolean;
//   iat?: number;
//   exp?: number;
// };

// const signOptions: SignOptions = {
//   expiresIn: process.env.JWT_EXPIRES_IN ? parseInt(process.env.JWT_EXPIRES_IN, 10) : "24h",
// };

// export function signToken(payload: object) {
//   return jwt.sign(payload, secret, signOptions);
// }

// export function verifyToken(token: string): TokenPayload {
//   return jwt.verify(token, secret) as TokenPayload;
// }

import jwt, { SignOptions } from "jsonwebtoken";

const secret = process.env.JWT_SECRET || "dev-secret";

export type TokenPayload = {
  userId: string;
  barbershopId: string; // ✅ precisa existir
  role: "admin" | "barber" | "client";
  isAdmin: boolean;
  iat?: number;
  exp?: number;
};

const signOptions: SignOptions = {
  expiresIn: process.env.JWT_EXPIRES_IN ? parseInt(process.env.JWT_EXPIRES_IN, 10) : "24h",
};

// ✅ tipa o payload corretamente
export function signToken(payload: Omit<TokenPayload, "iat" | "exp">) {
  return jwt.sign(payload, secret, signOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, secret) as TokenPayload;
}
