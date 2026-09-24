const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");
const { databaseUrl, dbPool } = require("./env");
const logger = require("./logger");

// Prisma 7 has no built-in query engine — a driver adapter provides the DB connection.
// Pool size is explicit (config/env.js#dbPool), not left to the driver's own default.
const pool = new Pool({ connectionString: databaseUrl, ...dbPool });

pool.on("error", (err) => {
  logger.error({ err }, "Postgres pool error");
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

module.exports = prisma;
