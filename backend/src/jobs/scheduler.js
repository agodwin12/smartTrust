const redis = require("../config/redis");
const logger = require("../config/logger");
const sentry = require("../config/sentry");
const ApiError = require("../utils/ApiError");

/**
 * Tiny in-process scheduler for the platform's housekeeping jobs.
 *
 * - Every instance ticks each job on its own interval; a Redis `SET NX PX` lock held for
 *   ~90% of the interval makes sure only ONE instance behind the load balancer actually
 *   runs it per period. Redis down → the job still runs (jobs are idempotent: every one
 *   guards its writes with conditional updates), just without the cross-instance lock.
 * - The last outcome of each job is kept in Redis for the back-office (`GET /admin/jobs`).
 * - `run(name, { trigger: "manual" })` bypasses the lock so a super admin can force a run.
 */

const registry = new Map();
const timers = [];
let started = false;

function register(job) {
  if (!job.name || typeof job.run !== "function" || !job.intervalMs) throw new Error("Invalid job definition");
  registry.set(job.name, job);
}

const lockKey = (name) => `jobs:lock:${name}`;
const statusKey = (name) => `jobs:status:${name}`;

async function acquireLock(name, ttlMs) {
  try {
    const result = await redis.set(lockKey(name), String(process.pid), "PX", ttlMs, "NX");
    return result === "OK" ? "locked" : "busy";
  } catch {
    return "unavailable";
  }
}

async function saveStatus(name, record) {
  try {
    await redis.set(statusKey(name), JSON.stringify(record), "EX", 30 * 24 * 3600);
  } catch {
    /* fail-open: status is a convenience */
  }
}

async function run(name, { trigger = "schedule" } = {}) {
  const job = registry.get(name);
  if (!job) throw new ApiError(404, `Unknown job "${name}".`, "JOB_NOT_FOUND");

  if (trigger === "schedule") {
    const lock = await acquireLock(name, Math.floor(job.intervalMs * 0.9));
    if (lock === "busy") return { name, skipped: true, reason: "ran on another instance this period" };
    if (lock === "unavailable") logger.warn({ job: name }, "Redis unavailable — running job without the cross-instance lock");
  }

  const log = logger.child({ job: name, trigger });
  const startedAt = new Date();
  log.info("job started");
  try {
    const summary = await job.run({ log });
    const record = { name, trigger, ok: true, startedAt, finishedAt: new Date(), durationMs: Date.now() - startedAt.getTime(), summary };
    log.info({ durationMs: record.durationMs, summary }, "job finished");
    await saveStatus(name, record);
    return record;
  } catch (err) {
    const record = { name, trigger, ok: false, startedAt, finishedAt: new Date(), durationMs: Date.now() - startedAt.getTime(), error: err.message };
    log.error({ err }, "job failed");
    sentry.captureException(err, { job: name, trigger });
    await saveStatus(name, record);
    return record;
  }
}

async function list() {
  const names = [...registry.keys()];
  let statuses = [];
  try {
    statuses = names.length ? await redis.mget(names.map(statusKey)) : [];
  } catch {
    statuses = names.map(() => null);
  }
  return names.map((name, i) => {
    const job = registry.get(name);
    let last = null;
    try {
      last = statuses[i] ? JSON.parse(statuses[i]) : null;
    } catch {
      last = null;
    }
    return { name, description: job.description, intervalMs: job.intervalMs, last };
  });
}

function start() {
  if (started) return;
  started = true;
  let stagger = 15_000; // let the server finish booting and Redis connect before the first tick
  for (const job of registry.values()) {
    const first = setTimeout(() => {
      void run(job.name);
      const every = setInterval(() => void run(job.name), job.intervalMs);
      every.unref();
      timers.push(every);
    }, job.initialDelayMs ?? stagger);
    first.unref();
    timers.push(first);
    stagger += 5_000;
  }
  logger.info({ jobs: [...registry.keys()] }, "Background jobs scheduled");
}

function stop() {
  for (const timer of timers) clearTimeout(timer);
  timers.length = 0;
  started = false;
}

module.exports = { register, run, list, start, stop };
