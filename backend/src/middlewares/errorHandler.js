const logger = require("../config/logger");

function notFound(req, res, next) {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Prisma's "known request" errors carry a code; the two a client can actually
// cause deserve a clean 4xx instead of a 500 with SQL internals in the message.
function mapPrismaError(err) {
  if (err.code === "P2002") {
    return { status: 409, message: "A record with that value already exists.", code: "CONFLICT" };
  }
  if (err.code === "P2025") {
    return { status: 404, message: "Record not found.", code: "NOT_FOUND" };
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const isProduction = process.env.NODE_ENV === "production";
  const isMulterError = err.name === "MulterError" || err.code === "LIMIT_FILE_SIZE";
  const prismaMapped = err.name === "PrismaClientKnownRequestError" ? mapPrismaError(err) : null;

  const status = prismaMapped?.status ?? err.status ?? (isMulterError ? 422 : 500);
  const code = prismaMapped?.code ?? err.code;

  // A 5xx message is whatever an internal library threw — a Prisma constraint
  // name, a driver error, a stack fragment. Never send that to a client in
  // production; the full error still goes to the server log just above.
  const message =
    status >= 500 && isProduction
      ? "Internal Server Error"
      : prismaMapped?.message ?? err.message ?? "Internal Server Error";

  if (status >= 500) (req.log ?? logger).error({ err, requestId: req.id }, "Unhandled request error");

  res.status(status).json({
    error: message,
    ...(code && { code }),
    // Lets a user quote the exact request in a support ticket; matches the log line.
    ...(req.id && { requestId: req.id }),
    ...(!isProduction && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
