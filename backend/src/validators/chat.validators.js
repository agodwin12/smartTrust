const { z } = require("zod");

// Exactly one target: the product being asked about (preferred), or the store itself.
const startConversationSchema = z
  .object({
    advertisementId: z.string().trim().min(1).max(40).optional(),
    storeId: z.string().trim().min(1).max(40).optional(),
  })
  .refine((d) => Boolean(d.advertisementId) !== Boolean(d.storeId), { message: "Give either advertisementId or storeId." });

// multipart (photo) or JSON; the 2 000-character cap and "not empty" rule live in chat.service.
const sendMessageSchema = z.object({
  body: z.string().max(4000).optional(),
  clientId: z.string().trim().regex(/^[A-Za-z0-9_-]{8,64}$/).optional(),
  advertisementId: z.string().trim().min(1).max(40).optional(),
});

module.exports = { startConversationSchema, sendMessageSchema };
