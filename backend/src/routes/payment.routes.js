const { Router } = require("express");
const controller = require("../controllers/payment.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const { FINANCE } = require("../utils/roles");

const router = Router();

// Public — authenticated by HMAC signature (X-KPAY-Signature), not a session.
router.post("/webhooks/kpay", controller.kpayWebhook);

// Finance-wide ledger of every incoming payment (orders + subscriptions).
router.get("/", authenticate, authorize(...FINANCE), controller.listAll);

module.exports = router;
