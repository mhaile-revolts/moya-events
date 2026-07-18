const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://moya:moya@db:5432/moya",
});

/**
 * Runs `fn` inside a single BEGIN/COMMIT transaction on one client, so
 * every query fn makes shares the same session and the same row locks.
 * This is the actual fix for the race-condition limitation the
 * frontend-only prototype had to flag and live with — Postgres holds a
 * real row lock (via SELECT ... FOR UPDATE inside fn) for the duration
 * of the transaction, so two concurrent buyers can never both win the
 * last seat or ticket.
 */
async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    // Wrap ROLLBACK so a rollback failure never swallows the original error.
    try { await client.query("ROLLBACK"); } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, withTransaction };
