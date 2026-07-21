// db/init.js
// Sets up SQLite database and the `users` table for Phase 1 (Auth Foundation).
// Later phases (servers, billing, notifications) will add their own tables here.

const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const DB_PATH = process.env.DB_PATH || "./data/meghacloud.db";

// Make sure the data/ folder exists before SQLite tries to write the file
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const conn = new DatabaseSync(DB_PATH);

// Thin wrapper so route files can keep using the familiar
// better-sqlite3-style API: db.prepare(sql).get/all/run(...params)
const db = {
  prepare(sql) {
    const stmt = conn.prepare(sql);
    return {
      get: (...params) => stmt.get(...params),
      all: (...params) => stmt.all(...params),
      run: (...params) => {
        const info = stmt.run(...params);
        return { lastInsertRowid: info.lastInsertRowid, changes: info.changes };
      },
    };
  },
  exec(sql) {
    conn.exec(sql);
  },
};

// --- users table ---
// auth_provider: 'email' | 'google'
// password_hash is NULL for google-only accounts
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    auth_provider TEXT NOT NULL DEFAULT 'email',
    google_id     TEXT UNIQUE,
    phone         TEXT,
    deleted_at    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Safe migration: add deleted_at to a users table created before this column existed.
try {
  db.exec(`ALTER TABLE users ADD COLUMN deleted_at TEXT;`);
} catch (e) {
  // already exists — fine
}

// --- servers table ---
// status: 'running' | 'stopped'
// v1.0 MVP: provisioning is simulated (no real OpenStack/VM boot yet, per TAD ADR-04 —
// real hypervisor integration is a separate infra milestone). Status just flips in DB.
db.exec(`
  CREATE TABLE IF NOT EXISTS servers (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL,
    name          TEXT NOT NULL,
    os            TEXT NOT NULL,
    size          TEXT NOT NULL,
    region        TEXT NOT NULL DEFAULT 'Mumbai',
    status        TEXT NOT NULL DEFAULT 'running',
    monthly_cost  INTEGER NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// --- invoices table ---
// status: 'pending' | 'paid'
// v1.0 MVP: payment is simulated (mark-as-paid) — real Razorpay/UPI webhook
// integration per TAD Section 9.3 is a separate milestone needing live merchant keys.
db.exec(`
  CREATE TABLE IF NOT EXISTS invoices (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER NOT NULL,
    invoice_number  TEXT NOT NULL UNIQUE,
    subtotal        INTEGER NOT NULL,
    gst_amount      INTEGER NOT NULL,
    total_amount    INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'pending',
    payment_method  TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    paid_at         TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// --- notifications table ---
// type: 'server_launched' | 'server_stopped' | 'payment_successful'
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    message     TEXT NOT NULL,
    is_read     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

// --- email_log table ---
// v1.0 MVP: no real SMTP configured yet, so "sending" an email just logs it here
// (visible in Settings > Email Log for demo/verification purposes). Swap in a real
// provider (SendGrid/SES) behind the same sendEmail() function when ready.
db.exec(`
  CREATE TABLE IF NOT EXISTS email_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    to_email    TEXT NOT NULL,
    subject     TEXT NOT NULL,
    body        TEXT NOT NULL,
    sent_at     TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`);

console.log(`[db] SQLite ready at ${DB_PATH} (using node:sqlite)`);

module.exports = db;
