const planService = require("../services/subscriptionPlan.service");
const audit = require("../services/audit.service");

async function list(req, res) {
  const plans = await planService.listPlans();
  res.json({ plans });
}

async function listAll(req, res) {
  const plans = await planService.listPlans({ includeInactive: true });
  res.json({ plans });
}

async function create(req, res) {
  const plan = await planService.createPlan(req.body);
  audit.record(req, { action: "PLAN_CREATED", entityType: "SubscriptionPlan", entityId: plan.id, metadata: req.body });
  res.status(201).json({ plan });
}

async function update(req, res) {
  const plan = await planService.updatePlan(req.params.id, req.body);
  audit.record(req, { action: "PLAN_UPDATED", entityType: "SubscriptionPlan", entityId: plan.id, metadata: req.body });
  res.json({ plan });
}

async function remove(req, res) {
  await planService.deletePlan(req.params.id);
  audit.record(req, { action: "PLAN_DELETED", entityType: "SubscriptionPlan", entityId: req.params.id });
  res.status(204).send();
}

module.exports = { list, listAll, create, update, remove };
