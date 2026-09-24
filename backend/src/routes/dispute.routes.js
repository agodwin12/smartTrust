const { Router } = require("express");
const controller = require("../controllers/dispute.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const { validateBody } = require("../middlewares/validate");
const { STAFF, OPERATIONS, ESCROW_VALIDATORS } = require("../utils/roles");
const { updateDisputeSchema } = require("../validators/dispute.validators");

const router = Router();

router.use(authenticate);

// Everyone on staff can see disputes (an accountant deciding an escrow needs the
// context). Customer Service works them (status/notes). Only Super Admin and
// Accountant can VALIDATE the outcome — i.e. actually move the money.
router.get("/", authorize(...STAFF), controller.list);
router.get("/:id", authorize(...STAFF), controller.getById);
router.patch("/:id", authorize(...OPERATIONS), validateBody(updateDisputeSchema), controller.update);
router.post("/:id/release-to-seller", authorize(...ESCROW_VALIDATORS), controller.releaseToSeller);
router.post("/:id/refund-buyer", authorize(...ESCROW_VALIDATORS), controller.refundBuyer);

module.exports = router;
