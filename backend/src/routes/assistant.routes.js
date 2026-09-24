const { Router } = require("express");
const controller = require("../controllers/assistant.controller");
const optionalAuthenticate = require("../middlewares/optionalAuthenticate");
const { validateBody } = require("../middlewares/validate");
const { assistantRateLimiter } = require("../middlewares/rateLimiter");
const { chatSchema } = require("../validators/assistant.validators");

const router = Router();

router.get("/status", controller.status);
router.post("/chat", assistantRateLimiter, optionalAuthenticate, validateBody(chatSchema), controller.chat);

module.exports = router;
