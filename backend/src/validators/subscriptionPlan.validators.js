const { z } = require("zod");

const createPlanSchema = z
  .object({
    name: z.string().trim().min(2).max(40),
    durationDays: z.number().int().positive(),
    adQuota: z.number().int().positive(),
    price: z.number().positive(),
    features: z.union([z.array(z.string().trim().min(1).max(120)).max(20), z.record(z.string(), z.any())]).optional(), // list of bullet lines (admin UI) or a free-form object
    isActive: z.boolean().optional(),
    heroEligible: z.boolean().optional(),
    // Admin-defined floor per the product requirement: a hero feature lasts at
    // least 48 hours.
    heroDurationHours: z.number().int().min(48).optional(),
  })
  .refine((data) => !data.heroEligible || data.heroDurationHours, {
    message: "heroDurationHours is required when heroEligible is true.",
    path: ["heroDurationHours"],
  });

const updatePlanSchema = z.object({
  name: z.string().trim().min(2).max(40).optional(),
  durationDays: z.number().int().positive().optional(),
  adQuota: z.number().int().positive().optional(),
  price: z.number().positive().optional(),
  features: z.union([z.array(z.string().trim().min(1).max(120)).max(20), z.record(z.string(), z.any())]).optional(), // list of bullet lines (admin UI) or a free-form object
  isActive: z.boolean().optional(),
  heroEligible: z.boolean().optional(),
  heroDurationHours: z.number().int().min(48).optional(),
});

module.exports = { createPlanSchema, updatePlanSchema };
