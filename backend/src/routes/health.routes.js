const { Router } = require("express");
const { getHealth, getLiveness } = require("../controllers/health.controller");

const router = Router();

router.get("/", getHealth);
router.get("/live", getLiveness);

module.exports = router;
