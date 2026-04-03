import joi from "joi";

const uuidParam = joi.object({
  id: joi.string().uuid().required(),
});

const permissionsObject = joi.object({
  viewAdmin: joi.boolean().optional(),
  manageEmployees: joi.boolean().optional(),
  manageProducts: joi.boolean().optional(),
  addProducts: joi.boolean().optional(),
  editProducts: joi.boolean().optional(),
  manageServices: joi.boolean().optional(),
  addServices: joi.boolean().optional(),
  editServices: joi.boolean().optional(),
  managePayments: joi.boolean().optional(),
  managePayroll: joi.boolean().optional(),
  manageAgendamentos: joi.boolean().optional(),
  manageOffScheduleAppointments: joi.boolean().optional(),
  manageBlockedDates: joi.boolean().optional(),
  manageBenefits: joi.boolean().optional(),
  manageSettings: joi.boolean().optional(),
  manageGallery: joi.boolean().optional(),
});

export const CreateUserSchema = joi
  .object({
    name: joi.string().trim().min(2).required(),
    email: joi.string().trim().lowercase().email().required(),
    phone: joi.string().trim().allow("", null).optional(),
    cpf: joi.string().trim().length(11).pattern(/^\d+$/).allow("", null).optional(),
    password: joi.string().min(4).required(),
    role: joi.string().valid("admin", "barber", "receptionist", "client").required(),
    isAdmin: joi.boolean().optional(),
    permissions: permissionsObject.optional(),
    photoUrl: joi.string().uri().allow("", null).optional(),
  })
  .options({ abortEarly: false, stripUnknown: true });

const ImportUserRowSchema = joi.object({
  name: joi.string().trim().min(2).required(),
  email: joi.string().trim().lowercase().email().required(),
  phone: joi.string().trim().allow("", null).optional(),
  cpf: joi.string().trim().length(11).pattern(/^\d+$/).allow("", null).optional(),
  role: joi.string().valid("admin", "barber", "receptionist", "client").optional(),
  isAdmin: joi.boolean().optional(),
  permissions: permissionsObject.optional(),
  photoUrl: joi.string().uri().allow("", null).optional(),
});

export const ImportUsersSchema = joi
  .object({
    defaultPassword: joi.string().trim().min(4).max(100).optional(),
    skipExisting: joi.boolean().optional(),
    rows: joi.array().items(ImportUserRowSchema).min(1).max(500).required(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const UpdateUserSchema = joi
  .object({
    name: joi.string().optional(),
    email: joi.string().email().optional(),
    phone: joi.string().allow(null, '').optional(),
    cpf: joi.string().allow(null, '').optional(),
    role: joi.string().optional(),
    isAdmin: joi.boolean().optional(),
    photoUrl: joi.string().allow(null, '').optional(),

    currentPassword: joi.string().min(4).optional(),
    newPassword: joi.string().min(4).optional(),
    resetPassword: joi.string().min(4).optional(),
  })
  .min(1)
  .options({ abortEarly: false, stripUnknown: true });

export const UpdatePermissionsSchema = joi
  .object({
    permissions: permissionsObject.required(),
  })
  .options({ abortEarly: false, stripUnknown: true });

export const ListUsersQuerySchema = joi
  .object({
    role: joi.string().valid("admin", "barber", "receptionist", "client").optional(),
    q: joi.string().trim().max(120).optional(),
    page: joi.number().integer().min(1).optional(),
    limit: joi.number().integer().min(1).max(100).optional(),
  })
  .unknown(true);

export const UserIdParamSchema = uuidParam;
