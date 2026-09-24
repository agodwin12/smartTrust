const { Router } = require("express");
const controller = require("../controllers/flashCampaign.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const { validateBody } = require("../middlewares/validate");
const { OPERATIONS } = require("../utils/roles");
const { createCampaignSchema, updateCampaignSchema, applySchema, addItemSchema, reviewItemSchema } = require("../validators/flashCampaign.validators");

const router = Router();

// Public: what the storefront shows.
router.get("/current", controller.current);
router.get("/upcoming", controller.upcoming);

// Sellers: campaigns open for applications, and their own applications.
router.get("/open", authenticate, controller.listOpen);
router.get("/mine", authenticate, controller.listMine);
router.post("/:id/applications", authenticate, validateBody(applySchema), controller.apply);
router.delete("/:id/applications/:itemId", authenticate, controller.withdraw);

// Back-office (super admin + customer service).
router.get("/admin", authenticate, authorize(...OPERATIONS), controller.listAll);
router.get("/admin/:id", authenticate, authorize(...OPERATIONS), controller.getAdmin);
router.post("/", authenticate, authorize(...OPERATIONS), validateBody(createCampaignSchema), controller.create);
router.patch("/:id", authenticate, authorize(...OPERATIONS), validateBody(updateCampaignSchema), controller.update);
router.post("/:id/publish", authenticate, authorize(...OPERATIONS), controller.publish);
router.post("/:id/cancel", authenticate, authorize(...OPERATIONS), controller.cancel);
router.post("/:id/items", authenticate, authorize(...OPERATIONS), validateBody(addItemSchema), controller.addItem);
router.patch("/:id/items/:itemId", authenticate, authorize(...OPERATIONS), validateBody(reviewItemSchema), controller.reviewItem);
router.delete("/:id/items/:itemId", authenticate, authorize(...OPERATIONS), controller.removeItem);

module.exports = router;
