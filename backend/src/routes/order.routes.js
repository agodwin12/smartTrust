const { Router } = require("express");
const controller = require("../controllers/order.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const requireVerifiedEmail = require("../middlewares/requireVerifiedEmail");
const { validateBody } = require("../middlewares/validate");
const { STAFF } = require("../utils/roles");
const { createOrderSchema, payOrderSchema, disputeSchema, cancelOrderSchema } = require("../validators/order.validators");
const { createReviewSchema } = require("../validators/review.validators");
const reviewController = require("../controllers/review.controller");

const router = Router();

router.use(authenticate);

// Staff-wide view of everything — before "/:id" so "all" can't be read as an id.
router.get("/", authorize(...STAFF), controller.listAll);

router.post("/", requireVerifiedEmail, validateBody(createOrderSchema), controller.create);
router.get("/me", controller.listMine);
router.get("/store", controller.listForStore);
router.get("/:id", controller.getById);
router.post("/:id/pay", requireVerifiedEmail, validateBody(payOrderSchema), controller.pay);
router.post("/:id/confirm-delivery", controller.confirmDelivery);
router.post("/:id/confirm-receipt", controller.confirmReceipt);
router.post("/:id/dispute", validateBody(disputeSchema), controller.raiseDispute);
router.post("/:id/cancel", validateBody(cancelOrderSchema), controller.cancel);
router.post("/:id/review", validateBody(createReviewSchema), reviewController.create);

module.exports = router;
