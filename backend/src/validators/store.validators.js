const { z } = require("zod");

// Multipart forms send "" for untouched optional fields — treat that as "not provided".
const optionalText = (schema) => z.union([z.literal(""), schema]).optional().transform((v) => (v === "" ? undefined : v));

const createStoreSchema = z.object({
  name: z.string().trim().min(2, "Store name is too short.").max(80),
  description: optionalText(z.string().trim().max(2000)),
  logoUrl: optionalText(z.string().trim().url()),
  bannerUrl: optionalText(z.string().trim().url()),
  location: optionalText(z.string().trim().max(160)),
  contactEmail: optionalText(z.string().trim().email()),
  contactPhone: optionalText(z.string().trim().max(30)),
  // Multipart forms send "true"/"false" strings, JSON clients send booleans.
  acceptsCashOnDelivery: z
    .union([z.literal(""), z.boolean(), z.enum(["true", "false"])])
    .optional()
    .transform((v) => (v === "" || v === undefined ? undefined : v === true || v === "true")),
});

const updateStoreSchema = createStoreSchema.partial();

const updateStoreStatusSchema = z.object({
  status: z.enum(["PENDING", "ACTIVE", "SUSPENDED"]),
});

module.exports = { createStoreSchema, updateStoreSchema, updateStoreStatusSchema };
