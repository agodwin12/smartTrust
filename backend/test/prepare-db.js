/**
 * `npm run pretest`: creates the *_test database if it does not exist and applies the
 * migrations to it. Idempotent — safe to run before every test run and in CI.
 */
require("./bootstrap");
const { execSync } = require("child_process");
const { Client } = require("pg");

async function ensureDatabase(urlString) {
  const url = new URL(urlString);
  const dbName = url.pathname.replace(/^\//, "");
  const admin = new URL(urlString);
  admin.pathname = "/postgres";
  admin.search = "";
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`Created test database ${dbName}`);
    }
  } finally {
    await client.end();
  }
}

(async () => {
  await ensureDatabase(process.env.DATABASE_URL);
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
