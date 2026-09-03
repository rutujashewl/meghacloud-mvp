// db/init.js
// PostgreSQL version (was SQLite in earlier phases — see git history).
// Keeps the exact same db.prepare(sql).get/all/run(...params) API that every
// route file already uses, so route files did not need their SQL rewritten —
// only `async`/`await` was added at call sites, because pg is async-only
// (unlike node:sqlite, which was synchronous).

const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Set it to your Render PostgreSQL 'Internal Database URL' " +
      "(or 'External Database URL' for local testing) in your .env file."
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.PG_POOL_MAX || 5),
  idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 10000),
  connectionTimeoutMillis: Number(process.env.PG_CONNECTION_TIMEOUT_MS || 10000),
  keepAlive: true,
  // Render (and most managed Postgres hosts) terminate TLS with a cert your
  // local Node install won't have in its trust store — this is the standard,
  // documented way to connect to Render Postgres from an external app.
  ssl: process.env.PGSSL === "false" ? false : { rejectUnauthorized: false },
});

pool.on("error", (err) => {
  console.error("[db] Unexpected error on idle Postgres client", err);
});

// Translates the SQLite-flavored SQL our routes already contain into
// Postgres-flavored SQL, transparently:
//   - "?" positional placeholders  -> "$1", "$2", ...
//   - "datetime('now')"            -> "NOW()"
function toPgSql(sql) {
  let i = 0;
  return sql.replace(/datetime\('now'\)/gi, "NOW()").replace(/\?/g, () => `$${++i}`);
}

function isInsert(sql) {
  return /^\s*INSERT INTO/i.test(sql);
}

const db = {
  prepare(sql) {
    const pgSql = toPgSql(sql);
    // Our routes read `result.lastInsertRowid` after INSERTs (a node:sqlite-ism).
    // Postgres has no such field — RETURNING id gives us the same info, so we
    // auto-append it to any INSERT that doesn't already have a RETURNING clause.
    const runSql = isInsert(sql) && !/returning/i.test(sql) ? `${pgSql} RETURNING id` : pgSql;

    return {
      async get(...params) {
        const res = await pool.query(pgSql, params);
        return res.rows[0];
      },
      async all(...params) {
        const res = await pool.query(pgSql, params);
        return res.rows;
      },
      async run(...params) {
        const res = await pool.query(runSql, params);
        return { lastInsertRowid: res.rows[0]?.id, changes: res.rowCount };
      },
    };
  },
  async exec(sql) {
    await pool.query(sql);
  },
};

// ---------------------------------------------------------------------------
// Schema — same tables/columns as the SQLite version, translated to Postgres
// types (SERIAL instead of INTEGER PRIMARY KEY AUTOINCREMENT, TIMESTAMPTZ
// instead of TEXT-with-datetime()). Column names and meanings are unchanged.
// ---------------------------------------------------------------------------
async function initSchema() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      name          TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT,
      auth_provider TEXT NOT NULL DEFAULT 'email',
      google_id     TEXT UNIQUE,
      phone         TEXT,
      deleted_at    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner';`);
  await db.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES users(id);`);
  await db.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS upi_id TEXT;`);
  await db.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS autopay_enabled BOOLEAN NOT NULL DEFAULT FALSE;`);
  await db.exec(`ALTER TABLE users ADD COLUMN IF NOT EXISTS gstin TEXT;`);
  await db.exec(`UPDATE users SET org_id = id WHERE org_id IS NULL;`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS servers (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      name          TEXT NOT NULL,
      os            TEXT NOT NULL,
      size          TEXT NOT NULL,
      region        TEXT NOT NULL DEFAULT 'Mumbai',
      status        TEXT NOT NULL DEFAULT 'running',
      monthly_cost  INTEGER NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.exec(`ALTER TABLE servers ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES users(id);`);
  await db.exec(`UPDATE servers SET org_id = user_id WHERE org_id IS NULL;`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS managed_databases (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id),
      name          TEXT NOT NULL,
      engine        TEXT NOT NULL,
      version       TEXT NOT NULL,
      size          TEXT NOT NULL,
      region        TEXT NOT NULL DEFAULT 'Mumbai',
      status        TEXT NOT NULL DEFAULT 'available',
      monthly_cost  INTEGER NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.exec(`ALTER TABLE managed_databases ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES users(id);`);
  await db.exec(`UPDATE managed_databases SET org_id = user_id WHERE org_id IS NULL;`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id              SERIAL PRIMARY KEY,
      user_id         INTEGER NOT NULL REFERENCES users(id),
      invoice_number  TEXT NOT NULL UNIQUE,
      subtotal        INTEGER NOT NULL,
      gst_amount      INTEGER NOT NULL,
      total_amount    INTEGER NOT NULL,
      status          TEXT NOT NULL DEFAULT 'pending',
      payment_method  TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      paid_at         TIMESTAMPTZ
    );
  `);
  await db.exec(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS org_id INTEGER REFERENCES users(id);`);
  await db.exec(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT;`);
  await db.exec(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;`);
  await db.exec(`UPDATE invoices SET org_id = user_id WHERE org_id IS NULL;`);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      type        TEXT NOT NULL,
      title       TEXT NOT NULL,
      message     TEXT NOT NULL,
      is_read     INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS email_log (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      to_email    TEXT NOT NULL,
      subject     TEXT NOT NULL,
      body        TEXT NOT NULL,
      sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS whatsapp_log (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      to_phone    TEXT NOT NULL,
      message     TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'sent',
      sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id),
      name        TEXT NOT NULL,
      key_hash    TEXT NOT NULL UNIQUE,
      last_used_at TIMESTAMPTZ,
      revoked_at  TIMESTAMPTZ,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await db.exec(`ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS key_prefix TEXT;`);
  await db.exec(`UPDATE api_keys SET key_prefix = 'mc_live_' WHERE key_prefix IS NULL;`);
  await db.exec(`ALTER TABLE api_keys ALTER COLUMN key_prefix SET NOT NULL;`);

  console.log("[db] PostgreSQL schema ready");
}

module.exports = { db, initSchema };
