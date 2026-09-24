const { Router } = require("express");
const controller = require("../controllers/withdrawal.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const requireVerifiedEmail = require("../middlewares/requireVerifiedEmail");
const { validateBody } = require("../middlewares/validate");
const { FINANCE } = require("../utils/roles");
const { requestWithdrawalSchema } = require("../validators/withdrawal.validators");

const router = Router();

router.use(authenticate);

// Finance-wide view of every payout — before "/me" and "/:id" so nothing shadows it.
router.get("/", authorize(...FINANCE), controller.listAll);

router.post("/", requireVerifiedEmail, validateBody(requestWithdrawalSchema), controller.request);
router.get("/me", controller.listMine);
router.get("/:id/refresh", controller.refreshStatus);

module.exports = router;
