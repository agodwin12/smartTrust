const { Router } = require("express");
const controller = require("../controllers/admin.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const { STAFF, ROLES } = require("../utils/roles");
const { assistantRateLimiter } = require("../middlewares/rateLimiter");
const { validateBody } = require("../middlewares/validate");
const { chatSchema } = require("../validators/assistant.validators");

const router = Router();
router.use(authenticate, authorize(...STAFF));

router.get("/stats", controller.stats);
router.get("/jobs", controller.listJobs);
router.post("/jobs/:name/run", authorize(ROLES.SUPER_ADMIN), controller.runJob);

// AI assistant (Gemini) — Super Admin only.
router.get("/assistant/status", authorize(ROLES.SUPER_ADMIN), controller.assistantStatus);
router.post("/assistant/chat", authorize(ROLES.SUPER_ADMIN), assistantRateLimiter, validateBody(chatSchema), controller.assistantChat);

module.exports = router;
