const { Router } = require("express");
const controller = require("../controllers/store.controller");
const reviewController = require("../controllers/review.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const requireVerifiedEmail = require("../middlewares/requireVerifiedEmail");
const upload = require("../middlewares/upload");
const { uploadRateLimiter } = require("../middlewares/rateLimiter");
const { validateBody } = require("../middlewares/validate");
const { OPERATIONS, STAFF } = require("../utils/roles");
const {
  createStoreSchema,
  updateStoreSchema,
  updateStoreStatusSchema,
  rejectStoreSchema,
} = require("../validators/store.validators");

const router = Router();

// Public browsing — no auth.
router.get("/", controller.list);
// Staff directory of every store (any status) — literal path, registered before "/:slug".
router.get("/all", authenticate, authorize(...STAFF), controller.listAll);

// Authenticated seller routes — registered before "/:slug" so "me" is never
// swallowed as a slug. Opening a store needs a verified email.
const storeImages = upload.fields([
  { name: "logo", maxCount: 1 },
  { name: "banner", maxCount: 1 },
]);
router.post("/", authenticate, requireVerifiedEmail, uploadRateLimiter, storeImages, validateBody(createStoreSchema), controller.create);
router.get("/me", authenticate, controller.getMine);
router.patch("/me", authenticate, uploadRateLimiter, storeImages, validateBody(updateStoreSchema), controller.updateMine);

// Staff moderation.
router.patch(
  "/:id/status",
  authenticate,
  authorize(...OPERATIONS),
  validateBody(updateStoreStatusSchema),
  controller.updateStatus
);

// New-store review: any staff member (SUPER_ADMIN, ACCOUNTANT, CUSTOMER_SERVICE).
router.post("/:id/approve", authenticate, authorize(...STAFF), controller.approve);
router.post("/:id/reject", authenticate, authorize(...STAFF), validateBody(rejectStoreSchema), controller.reject);

// Public storefront page — kept last so it never shadows the routes above.
router.get("/:slug/reviews", reviewController.listForStore);
router.get("/:slug", controller.getBySlug);

module.exports = router;
