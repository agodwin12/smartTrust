const { Router } = require("express");
const controller = require("../controllers/search.controller");

const router = Router();

// Public: instant suggestions while typing in the search bar.
router.get("/suggest", controller.suggest);

module.exports = router;
