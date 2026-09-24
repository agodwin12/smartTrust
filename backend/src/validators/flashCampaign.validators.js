const { z } = require("zod");

const isoDate = z.coerce.date().refine((d) => !Number.isNaN(d.getTime()), { message: "Invalid date." });
const optionalText = (max) => z.string().trim().max(max).optional().or(z.literal("").transform(() => undefined));

const createCampaignSchema = z
  .object({
    name: z.string().trim().min(3, "Campaign name is too short.").max(80),
    description: optionalText(1000),
    startsAt: isoDate,
    endsAt: isoDate,
    minDiscountPercent: z.coerce.number().int().min(1).max(90).default(10),
    applicationsOpen: z.boolean().default(true),
  })
  .refine((d) => d.endsAt > d.startsAt, { path: ["endsAt"], message: "The campaign must end after it starts." });

const updateCampaignSchema = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  description: optionalText(1000).nullable(),
  startsAt: isoDate.optional(),
  endsAt: isoDate.optional(),
  minDiscountPercent: z.coerce.number().int().min(1).max(90).optional(),
  applicationsOpen: z.boolean().optional(),
});

const applySchema = z.object({
  advertisementId: z.string().min(1, "advertisementId is required."),
  campaignPrice: z.coerce.number().positive(),
  note: optionalText(300),
});

const addItemSchema = z.object({
  advertisementId: z.string().min(1, "advertisementId is required."),
  campaignPrice: z.coerce.number().positive(),
});

const reviewItemSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  campaignPrice: z.coerce.number().positive().optional(),
  reviewNote: optionalText(300),
});

module.exports = { createCampaignSchema, updateCampaignSchema, applySchema, addItemSchema, reviewItemSchema };
