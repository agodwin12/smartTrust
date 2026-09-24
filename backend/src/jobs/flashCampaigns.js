const flashCampaignService = require("../services/flashCampaign.service");

/**
 * Starts and ends flash campaigns on time: approved campaign prices go live when a
 * published campaign's start time passes, and every applied price is restored when the
 * end time passes. Both steps are idempotent (activatedAt / endedAt are set exactly once).
 */
module.exports = {
  name: "flash-campaigns",
  description: "Applies flash-campaign prices at start time and restores them at end time",
  // Half a minute: a campaign that ends on screen has its prices restored within ~30 s.
  intervalMs: 30 * 1000,
  async run({ log }) {
    const activated = await flashCampaignService.activateDue();
    const ended = await flashCampaignService.endDue();
    if (activated || ended) log.info({ activated, ended }, "flash campaigns moved");
    return { activated, ended };
  },
};
