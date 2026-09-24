const { Router } = require("express");
const controller = require("../controllers/subscriptionPlan.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const { validateBody } = require("../middlewares/validate");
const { STAFF, OPERATIONS } = require("../utils/roles");
const { createPlanSchema, updatePlanSchema } = require("../validators/subscriptionPlan.validators");

const router = Router();

router.get("/", controller.list); // public — active plans only
router.get("/all", authenticate, authorize(...STAFF), controller.listAll);
router.post("/", authenticate, authorize(...OPERATIONS), validateBody(createPlanSchema), controller.create);
router.patch("/:id", authenticate, authorize(...OPERATIONS), validateBody(updatePlanSchema), controller.update);
router.delete("/:id", authenticate, authorize(...OPERATIONS), controller.remove);

module.exports = router;
