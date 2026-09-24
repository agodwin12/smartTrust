const { Router } = require("express");
const controller = require("../controllers/wishlist.controller");
const authenticate = require("../middlewares/authenticate");
const { validateBody } = require("../middlewares/validate");
const { mergeWishlistSchema } = require("../validators/wishlist.validators");

const router = Router();
router.use(authenticate);

router.get("/", controller.list);
router.post("/merge", validateBody(mergeWishlistSchema), controller.merge);
router.put("/:advertisementId", controller.add);
router.delete("/:advertisementId", controller.remove);

module.exports = router;
