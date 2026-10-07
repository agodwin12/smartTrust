const { Router } = require("express");
const controller = require("../controllers/chat.controller");
const authenticate = require("../middlewares/authenticate");
const upload = require("../middlewares/upload");
const { validateBody } = require("../middlewares/validate");
const { chatMessageRateLimiter, chatStartRateLimiter } = require("../middlewares/rateLimiter");
const ApiError = require("../utils/ApiError");
const { startConversationSchema, sendMessageSchema } = require("../validators/chat.validators");

const router = Router();
router.use(authenticate);

/** One optional photo per message (JPEG/PNG/WebP, 5 MB), with clear errors instead of a 500. */
function chatPhoto(req, res, next) {
  upload.single("image")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") return next(new ApiError(422, "Photos must be smaller than 5 MB.", "FILE_TOO_LARGE"));
    if (!err.status) return next(new ApiError(422, err.message || "Only JPEG, PNG or WebP photos can be sent.", "UNSUPPORTED_FILE_TYPE"));
    next(err);
  });
}

router.get("/", controller.list);
router.get("/unread", controller.unread);
// Only buyers open conversations (a store owner gets OWN_STORE): sellers reply.
router.post("/", chatStartRateLimiter, validateBody(startConversationSchema), controller.start);
router.get("/:id", controller.get);
router.get("/:id/messages", controller.messages);
router.post("/:id/messages", chatMessageRateLimiter, chatPhoto, validateBody(sendMessageSchema), controller.send);
router.post("/:id/read", controller.read);

module.exports = router;
