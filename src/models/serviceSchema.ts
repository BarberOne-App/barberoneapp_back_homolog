// src/models/serviceSchemas.ts
import joi from "joi";

export const CreateServiceSchema = joi.object({
  name: joi.string().trim().min(2).required(),
  basePrice: joi.number().precision(2).positive().required(),
  durationMinutes: joi.number().integer().min(1).required(),
  imageUrl: joi.string().uri().trim().allow("", null).optional(),
  active: joi.boolean().optional(),
});

export const UpdateServiceSchema = joi
  .object({
    name: joi.string().trim().min(2).optional(),
    basePrice: joi.number().precision(2).positive().optional(),
    durationMinutes: joi.number().integer().min(1).optional(),
    imageUrl: joi.string().uri().trim().allow("", null).optional(),
    active: joi.boolean().optional(),
  })
  .min(1);

export const ServiceIdParamSchema = joi.object({
  id: joi.string().uuid().required(),
});

export const ListServicesQuerySchema = joi.object({
  q: joi.string().trim().allow("", null).optional(),
  includeInactive: joi.boolean().truthy("true").falsy("false").optional(),
  page: joi.number().integer().min(1).optional(),
  limit: joi.number().integer().min(1).max(100).optional(),
});
