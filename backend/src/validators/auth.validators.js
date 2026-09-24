const { z } = require("zod");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters.")
  .regex(/[A-Za-z]/, "Password must contain at least one letter.")
  .regex(/[0-9]/, "Password must contain at least one number.");

const otpCode = z.string().trim().length(6, "Enter the 6-digit code.").regex(/^\d+$/, "Code must be numeric.");

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password,
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
  phone: z.string().trim().min(1).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

const verifyEmailSchema = z.object({
  code: otpCode,
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  code: otpCode,
  newPassword: password,
});

module.exports = {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
