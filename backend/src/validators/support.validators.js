const { z } = require("zod");

const locale = z.enum(["en", "fr"]).optional();

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(190),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(10).max(4000),
  locale,
  // Honeypot — real browsers leave it empty; bots fill every field.
  website: z.string().max(0).optional(),
});

const newsletterSchema = z.object({
  email: z.string().trim().email().max(190),
  locale,
  website: z.string().max(0).optional(),
});

module.exports = { contactSchema, newsletterSchema };
