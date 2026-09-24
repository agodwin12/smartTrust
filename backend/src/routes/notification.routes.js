const { Router } = require("express");
const controller = require("../controllers/notification.controller");
const authenticate = require("../middlewares/authenticate");

const router = Router();
router.use(authenticate);

router.get("/", controller.listMine);
router.get("/unread-count", controller.unreadCount);
router.patch("/:id/read", controller.markRead);
router.post("/read-all", controller.markAllRead);

module.exports = router;
