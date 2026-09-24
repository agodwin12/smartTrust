const reviewService = require("../services/review.service");
const storeService = require("../services/store.service");
const audit = require("../services/audit.service");

async function create(req, res) {
  const review = await reviewService.create(req.params.id, req.user.id, req.body);
  audit.record(req, { action: "REVIEW_CREATED", entityType: "Review", entityId: review.id, metadata: { orderId: req.params.id, rating: review.rating } });
  res.status(201).json({ review });
}

async function listForStore(req, res) {
  const store = await storeService.getBySlug(req.params.slug);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize, 10) || 10, 1), 50);
  res.json(await reviewService.listForStore(store.id, { page, pageSize }));
}

module.exports = { create, listForStore };
