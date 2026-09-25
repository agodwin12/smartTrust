const assistantService = require("../services/assistant.service");

async function status(req, res) {
  res.json({ enabled: assistantService.isEnabled(), mode: assistantService.mode() });
}

async function chat(req, res) {
  const { messages, locale } = req.body;
  const result = await assistantService.chat({ messages, locale, user: req.user ?? null });
  res.json(result);
}

module.exports = { status, chat };
