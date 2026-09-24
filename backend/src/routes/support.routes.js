const { Router } = require("express");
const controller = require("../controllers/support.controller");
const { validateBody } = require("../middlewares/validate");
const { otpRequestRateLimiter } = require("../middlewares/rateLimiter");
const { contactSchema, newsletterSchema } = require("../validators/support.validators");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const { STAFF } = require("../utils/roles");

const router = Router();

// Public forms. Both reuse the strict "sends an email / writes a row per call" limiter (5 / 15 min / IP).
router.post("/contact", otpRequestRateLimiter, validateBody(contactSchema), controller.contact);
router.post("/newsletter", otpRequestRateLimiter, validateBody(newsletterSchema), controller.subscribe);

// Staff inbox.
router.get("/messages", authenticate, authorize(...STAFF), controller.listMessages);
router.patch("/messages/:id/handled", authenticate, authorize(...STAFF), controller.markHandled);
router.get("/subscribers", authenticate, authorize(...STAFF), controller.listSubscribers);

module.exports = router;
