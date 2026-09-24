const scheduler = require("./scheduler");
const subscriptionExpiry = require("./subscriptionExpiry");
const stalePayments = require("./stalePayments");
const payoutStatus = require("./payoutStatus");
const auditRetention = require("./auditRetention");
const viewCounts = require("./viewCounts");

scheduler.register(subscriptionExpiry);
scheduler.register(stalePayments);
scheduler.register(payoutStatus);
scheduler.register(auditRetention);
scheduler.register(viewCounts);

module.exports = scheduler;
