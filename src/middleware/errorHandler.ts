import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { AppError } from "../errors/index.js";

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  // erro "controlado"
  if (err instanceof AppError) {
    return res.status(err.status).send([err.message]);
  }

  // erros conhecidos do Prisma
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = err.meta as Record<string, unknown> | undefined;

    if (err.code === "P2002") {
      const target = Array.isArray(meta?.target) ? (meta!.target as string[]).join(", ") : String(meta?.target ?? "");
      console.error(`[errorHandler] P2002 unique violation — target: ${target}`);
      return res.status(409).send(["Dados ja cadastrados"]);
    }

    if (err.code === "P2003") {
      const field = String(meta?.field_name ?? meta?.fieldName ?? "desconhecido");
      console.error(`[errorHandler] P2003 foreign key — field: ${field}`);
      return res.status(400).send([`Referencia invalida (campo: ${field}): verifique se cliente, barbeiro e servicos existem`]);
    }

    if (err.code === "P2022") {
      const column = String(meta?.column ?? "desconhecida");
      console.error(`[errorHandler] P2022 coluna ausente no banco — coluna: "${column}" | mensagem: ${err.message}`);
      return res.status(500).send([`Coluna ausente no banco de dados: "${column}". Execute as migrations pendentes (npx prisma migrate deploy).`]);
    }

    if (err.code === "P2025") {
      console.error(`[errorHandler] P2025 registro nao encontrado:`, meta);
      return res.status(404).send(["Registro nao encontrado"]);
    }

    if (err.code === "P2014") {
      return res.status(400).send(["Relacao invalida entre os dados enviados"]);
    }

    console.error(`[errorHandler] Prisma ${err.code}:`, err.message, "| meta:", meta);
    return res.status(400).send([`Erro de banco de dados (${err.code}): verifique os dados enviados`]);
  }

  // erro de validacao do Prisma (campos invalidos, tipos errados)
  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error("[errorHandler] PrismaClientValidationError:", err.message);
    return res.status(400).send(["Dados invalidos: verifique os campos obrigatorios e os tipos dos valores"]);
  }

  // erro de inicializacao do Prisma
  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error("[errorHandler] PrismaClientInitializationError:", err.message);
    return res.status(503).send(["Servico temporariamente indisponivel"]);
  }

  console.error("[errorHandler] Erro inesperado:", err);
  return res.status(500).send(["Erro interno do servidor"]);
}
