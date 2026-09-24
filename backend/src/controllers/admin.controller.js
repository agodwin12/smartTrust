const adminService = require("../services/admin.service");
const jobs = require("../jobs");
const audit = require("../services/audit.service");

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

module.exports = { stats, listJobs, runJob };
