const advertisementService = require("../services/advertisement.service");

/** Flushes the Redis view counters (ads:views) into Postgres — one write per viewed listing per minute. */
module.exports = {
  name: "view-counts",
  description: "Flushes batched listing view counters to the database",
  intervalMs: 60 * 1000,
  initialDelayMs: 30 * 1000,
  async run() {
    const listings = await advertisementService.flushViewCounts();
    return { listings };
  },
};
