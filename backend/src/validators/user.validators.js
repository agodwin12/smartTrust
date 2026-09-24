const { z } = require("zod");
const { ROLES } = require("../utils/roles");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[A-Za-z]/, "Password must contain at least one letter.")
  .regex(/[0-9]/, "Password must contain at least one number.");

const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  phone: z.string().trim().min(1).nullable().optional(),
});

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: password,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current password.",
    path: ["newPassword"],
  });

const updateUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]),
});

const updateUserRoleSchema = z.object({
  role: z.enum([ROLES.CUSTOMER, ROLES.CUSTOMER_SERVICE, ROLES.ACCOUNTANT, ROLES.SUPER_ADMIN]),
});

const createStaffSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password,
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
  phone: z.string().trim().min(1).optional(),
  role: z.enum([ROLES.CUSTOMER_SERVICE, ROLES.ACCOUNTANT, ROLES.SUPER_ADMIN]),
});

module.exports = {
  updateProfileSchema,
  changePasswordSchema,
  updateUserStatusSchema,
  updateUserRoleSchema,
  createStaffSchema,
};
