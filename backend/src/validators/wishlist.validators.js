const { z } = require("zod");

const mergeWishlistSchema = z.object({
  advertisementIds: z.array(z.string().min(1)).max(200),
});

module.exports = { mergeWishlistSchema };
