const scheduler = require("./scheduler");
const subscriptionExpiry = require("./subscriptionExpiry");
const stalePayments = require("./stalePayments");
const payoutStatus = require("./payoutStatus");
const auditRetention = require("./auditRetention");
const viewCounts = require("./viewCounts");
const flashCampaigns = require("./flashCampaigns");
const videoRecovery = require("./videoRecovery");

scheduler.register(subscriptionExpiry);
scheduler.register(stalePayments);
scheduler.register(payoutStatus);
scheduler.register(auditRetention);
scheduler.register(viewCounts);
scheduler.register(flashCampaigns);
scheduler.register(videoRecovery);

module.exports = scheduler;
