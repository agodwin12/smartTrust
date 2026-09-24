const { z } = require("zod");

const updateDisputeSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "REJECTED"]).optional(),
  resolution: z.string().trim().min(1).max(2000).optional(),
});

module.exports = { updateDisputeSchema };
