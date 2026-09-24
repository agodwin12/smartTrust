const { z } = require("zod");

const message = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

// The client sends the recent transcript (stateless API). The first entry must be the
// user's, and the last one is the new question the assistant has to answer.
const chatSchema = z.object({
  messages: z
    .array(message)
    .min(1)
    .max(12)
    .refine((list) => list[0].role === "user" && list[list.length - 1].role === "user", {
      message: "The conversation must start and end with a user message.",
    }),
  locale: z.enum(["en", "fr"]).default("en"),
});

module.exports = { chatSchema };
