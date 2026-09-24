const { Router } = require("express");
const controller = require("../controllers/refund.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const { validateBody } = require("../middlewares/validate");
const { FINANCE } = require("../utils/roles");
const { retryRefundSchema } = require("../validators/refund.validators");

const router = Router();

// Money leaving the platform wallet: accountant + super admin only, like withdrawals.
router.use(authenticate, authorize(...FINANCE));

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.get("/:id/refresh", controller.refresh);
router.post("/:id/retry", validateBody(retryRefundSchema), controller.retry);

module.exports = router;
