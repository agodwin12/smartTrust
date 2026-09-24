/**
 * The test database URL: TEST_DATABASE_URL if set, otherwise the development
 * DATABASE_URL with "_test" appended to the database name (same server, same
 * credentials, separate database — never the development data).
 */
function testDatabaseUrl() {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL (or TEST_DATABASE_URL) is required to run the tests.");
  const url = new URL(raw);
  const name = url.pathname.replace(/^\//, "");
  if (!name) throw new Error("DATABASE_URL has no database name.");
  url.pathname = `/${name.endsWith("_test") ? name : `${name}_test`}`;
  return url.toString();
}

module.exports = { testDatabaseUrl };
