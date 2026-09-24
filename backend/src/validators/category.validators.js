const { z } = require("zod");

// multipart/form-data fields always arrive as strings, so this coerces/accepts
// plain strings rather than expecting real JSON types.
const createCategorySchema = z.object({
  name: z.string().trim().min(2, "Category name is too short.").max(60),
  parentId: z.string().trim().min(1).optional(),
});

const updateCategorySchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  parentId: z.string().trim().min(1).nullable().optional(),
  removeImage: z
    .union([z.literal("true"), z.literal("false")])
    .transform((v) => v === "true")
    .optional(),
});

module.exports = { createCategorySchema, updateCategorySchema };
