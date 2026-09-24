const { Router } = require("express");
const controller = require("../controllers/category.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const upload = require("../middlewares/upload");
const { validateBody } = require("../middlewares/validate");
const { uploadRateLimiter } = require("../middlewares/rateLimiter");
const { OPERATIONS } = require("../utils/roles");
const { createCategorySchema, updateCategorySchema } = require("../validators/category.validators");

const router = Router();

// Public browsing.
router.get("/", controller.list);
router.get("/:slug", controller.getBySlug);

// Staff-managed — multer parses the multipart body before validateBody reads req.body.
router.post(
  "/",
  authenticate,
  authorize(...OPERATIONS),
  uploadRateLimiter,
  upload.single("image"),
  validateBody(createCategorySchema),
  controller.create
);
router.patch(
  "/:id",
  authenticate,
  authorize(...OPERATIONS),
  uploadRateLimiter,
  upload.single("image"),
  validateBody(updateCategorySchema),
  controller.update
);
router.delete("/:id", authenticate, authorize(...OPERATIONS), controller.remove);

module.exports = router;
