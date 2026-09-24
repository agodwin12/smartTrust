const { Router } = require("express");
const controller = require("../controllers/subscription.controller");
const authenticate = require("../middlewares/authenticate");
const requireVerifiedEmail = require("../middlewares/requireVerifiedEmail");
const { validateBody } = require("../middlewares/validate");
const { checkoutSchema } = require("../validators/subscription.validators");

const router = Router();

router.use(authenticate);

router.post("/checkout", requireVerifiedEmail, validateBody(checkoutSchema), controller.checkout);
router.get("/me", controller.getMine);
router.get("/:id/refresh", controller.refreshStatus);

module.exports = router;
