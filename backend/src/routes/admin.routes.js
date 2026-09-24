const { Router } = require("express");
const controller = require("../controllers/admin.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const { STAFF, ROLES } = require("../utils/roles");

const router = Router();
router.use(authenticate, authorize(...STAFF));

router.get("/stats", controller.stats);
router.get("/jobs", controller.listJobs);
router.post("/jobs/:name/run", authorize(ROLES.SUPER_ADMIN), controller.runJob);

module.exports = router;
