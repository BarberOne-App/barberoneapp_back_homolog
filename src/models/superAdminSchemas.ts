import joi from "joi";

const status = joi
  .string()
  .trim()
  .valid("active", "inactive", "blocked", "pending");

const subscriptionStatus = joi
  .string()
  .trim()
  .valid("active", "paused", "cancelled", "expired", "none");

export const SuperAdminBarbershopIdParamSchema = joi
  .object({
    id: joi.string().uuid().required(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const SuperAdminListBarbershopsQuerySchema = joi
  .object({
    q: joi.string().trim().allow("", null).optional(),
    status: status.optional(),
    plan: joi.string().trim().allow("", null).optional(),
    subscriptionStatus: subscriptionStatus.optional(),
    createdFrom: joi.date().iso().optional(),
    createdTo: joi.date().iso().optional(),
    page: joi.number().integer().min(1).default(1),
    limit: joi.number().integer().min(1).max(100).default(20),
    sortBy: joi.string().trim().valid("name", "createdAt", "updatedAt", "status").default("createdAt"),
    sortOrder: joi.string().trim().valid("asc", "desc").default("desc"),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const SuperAdminUpdateBarbershopStatusSchema = joi
  .object({
    status: status.required(),
    reason: joi.string().trim().max(400).allow("", null).optional(),
  })
  .options({ abortEarly: false, stripUnknown: true });
