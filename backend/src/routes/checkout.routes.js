const { Router } = require("express");
const controller = require("../controllers/checkout.controller");
const authenticate = require("../middlewares/authenticate");
const optionalAuthenticate = require("../middlewares/optionalAuthenticate");
const { validateBody } = require("../middlewares/validate");
const { createCheckoutSchema, payCheckoutSchema, lookupSchema, cancelLineSchema } = require("../validators/checkout.validators");

const router = Router();

// Cart checkout — signed-in buyers or guests (name + phone, optional email).
router.post("/", optionalAuthenticate, validateBody(createCheckoutSchema), controller.create);
// Guest follow-up without the tracking link.
router.post("/lookup", validateBody(lookupSchema), controller.lookup);
router.get("/mine", authenticate, controller.listMine);
// The buyer, a tracking token (?token= / body.token) or staff.
router.get("/:id", optionalAuthenticate, controller.get);
router.post("/:id/pay", optionalAuthenticate, validateBody(payCheckoutSchema), controller.pay);
router.post("/:id/orders/:orderId/confirm-receipt", optionalAuthenticate, controller.confirmReceipt);
router.post("/:id/orders/:orderId/cancel", optionalAuthenticate, validateBody(cancelLineSchema), controller.cancelLine);

module.exports = router;
