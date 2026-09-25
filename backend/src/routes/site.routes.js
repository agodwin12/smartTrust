const { Router } = require("express");
const { site } = require("../config/env");

const router = Router();

/** Public contact channels for the storefront widgets (WhatsApp bubble, chat hand-off). */
router.get("/contact", (req, res) => {
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    whatsapp: site.whatsapp || null,
    whatsappUrl: site.whatsapp ? `https://wa.me/${site.whatsapp}` : null,
    email: site.supportEmail || null,
  });
});

module.exports = router;
