const { z } = require("zod");

const compareAtRule = (data, ctx) => {
  if (data.compareAtPrice !== undefined && data.price !== undefined && data.compareAtPrice <= data.price) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["compareAtPrice"],
      message: "compareAtPrice must be greater than price.",
    });
  }
};

// multipart/form-data fields arrive as strings — coerce the numeric ones.
const createAdvertisementSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(10).max(5000),
    price: z.coerce.number().positive(),
    // Optional "was" price: when present it must exceed price, and the listing shows up under /deals.
    compareAtPrice: z.coerce.number().positive().optional(),
    categoryId: z.string().min(1, "categoryId is required."),
    condition: z.enum(["NEW", "USED"]).optional(),
    location: z.string().trim().max(160).optional(),
    video: z.string().trim().url().optional(),
  })
  .superRefine(compareAtRule);

const updateAdvertisementSchema = z
  .object({
    title: z.string().trim().min(3).max(120).optional(),
    description: z.string().trim().min(10).max(5000).optional(),
    price: z.coerce.number().positive().optional(),
    // Send an empty string to clear a previous compareAtPrice.
    compareAtPrice: z
      .union([z.literal(""), z.coerce.number().positive()])
      .optional()
      .transform((v) => (v === "" ? null : v)),
    categoryId: z.string().min(1).optional(),
    condition: z.enum(["NEW", "USED"]).optional(),
    location: z.string().trim().max(160).optional(),
    video: z.string().trim().url().optional(),
  })
  .superRefine((data, ctx) => {
    if (typeof data.compareAtPrice === "number") compareAtRule(data, ctx);
  });

const featureSchema = z.object({
  // Admin-only override — a seller's own feature request always uses their plan's
  // configured heroDurationHours instead, this field is ignored for them.
  durationHours: z.coerce.number().int().positive().optional(),
});

const LIST_SORTS = ["newest", "price_asc", "price_desc", "popular"];

module.exports = { createAdvertisementSchema, updateAdvertisementSchema, featureSchema, LIST_SORTS };
