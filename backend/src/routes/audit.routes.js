const { Router } = require("express");
const controller = require("../controllers/audit.controller");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
const { STAFF } = require("../utils/roles");

const router = Router();

// ?actorId=&action=&entityType=&entityId=&from=ISO&to=ISO&page=&pageSize=
router.get("/", authenticate, authorize(...STAFF), controller.list);

module.exports = router;
