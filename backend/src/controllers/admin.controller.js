const adminService = require("../services/admin.service");
const jobs = require("../jobs");
const audit = require("../services/audit.service");
const adminAssistant = require("../services/adminAssistant.service");

async function stats(req, res) {
  res.json(await adminService.stats());
}

async function listJobs(req, res) {
  res.json({ jobs: await jobs.list() });
}

async function runJob(req, res) {
  const record = await jobs.run(req.params.name, { trigger: "manual" });
  audit.record(req, { action: "JOB_RUN", entityType: "Job", entityId: req.params.name, metadata: { ok: record.ok, summary: record.summary ?? null, error: record.error ?? null } });
  res.json({ run: record });
}

/** Super Admin AI assistant (Gemini): questions about orders, money and activity, answered from read-only tools. */
async function assistantStatus(req, res) {
  res.json(adminAssistant.status());
}

async function assistantChat(req, res) {
  const { messages, locale } = req.body;
  const result = await adminAssistant.chat({ messages, locale, admin: req.user });
  audit.record(req, { action: "ADMIN_ASSISTANT_QUERY", entityType: "Assistant", metadata: { question: messages[messages.length - 1].content.slice(0, 300), model: result.model } });
  res.json(result);
}

module.exports = {
  assistantStatus,
  assistantChat, stats, listJobs, runJob };
