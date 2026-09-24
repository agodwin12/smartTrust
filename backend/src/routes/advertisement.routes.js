const { Router } = require("express");
const controller = require("../controllers/advertisement.controller");
const authenticate = require("../middlewares/authenticate");
const upload = require("../middlewares/upload");
const { validateBody } = require("../middlewares/validate");
const { uploadRateLimiter } = require("../middlewares/rateLimiter");
const authorize = require("../middlewares/authorize");
const { STAFF } = require("../utils/roles");
const {
  createAdvertisementSchema,
  updateAdvertisementSchema,
  featureSchema,
} = require("../validators/advertisement.validators");

const router = Router();

// Public browsing — registered before the authenticated "/me" and the trailing
// "/:slug" so neither literal path gets swallowed as a slug.
router.get("/", controller.list);
router.get("/hero", controller.listHero);
router.get("/all", authenticate, authorize(...STAFF), controller.listAll);
router.get("/me", authenticate, controller.listMine);
router.get("/me/:id", authenticate, controller.getMine);

router.post(
  "/",
  authenticate,
  uploadRateLimiter,
  upload.array("images", 8),
  validateBody(createAdvertisementSchema),
  controller.create
);
router.patch(
  "/:id",
  authenticate,
  uploadRateLimiter,
  upload.array("images", 8),
  validateBody(updateAdvertisementSchema),
  controller.update
);
router.post("/:id/publish", authenticate, controller.publish);
router.post("/:id/archive", authenticate, controller.archive);
router.post("/:id/feature", authenticate, validateBody(featureSchema), controller.feature);
router.delete("/:id/feature", authenticate, controller.unfeature);

// Public storefront-style detail page — kept last so it never shadows the routes above.
router.get("/:slug", controller.getBySlug);

module.exports = router;
