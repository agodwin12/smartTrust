const crypto = require("crypto");
const pinoHttp = require("pino-http");
const logger = require("../config/logger");

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Gives every request an id (honours one sent by a proxy/frontend, otherwise mints a
 * UUID), echoes it on the response so a client can quote it in a support ticket, and
 * attaches a child logger with that id as `req.log`.
 */
function requestId(req, res, next) {
  const incoming = req.get(REQUEST_ID_HEADER);
  req.id = incoming && incoming.length <= 128 ? incoming : crypto.randomUUID();
  res.setHeader(REQUEST_ID_HEADER, req.id);
  next();
}

/** One structured access-log line per request: method, url, status, duration, requestId, userId. */
const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => req.id,
  autoLogging: { ignore: (req) => req.url === "/api/health" || req.url === "/api/health/live" },
  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customProps: (req) => ({ userId: req.user?.id ?? null }),
  customSuccessMessage: (req, res) => `${req.method} ${req.originalUrl || req.url} ${res.statusCode}`,
  customErrorMessage: (req, res) => `${req.method} ${req.originalUrl || req.url} ${res.statusCode}`,
  serializers: {
    // Keep access lines compact: no headers/body dumps, just what you grep for.
    req: (req) => ({ id: req.id, method: req.method, url: req.url, ip: req.remoteAddress }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

module.exports = { requestId, requestLogger, REQUEST_ID_HEADER };
