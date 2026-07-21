// routes/auth.js
// Phase 1 - Authentication:
//   POST /api/auth/register       - email + password signup
//   POST /api/auth/login          - email + password login
//   POST /api/auth/google         - Google Sign-In (ID token from frontend)
//   GET  /api/auth/me             - basic profile (protected)
//   PATCH /api/auth/me            - update basic profile (protected)

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const { OAuth2Client } = require("google-auth-library");

const db = require("../db/init");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

function publicUser(user) {
  // never send password_hash back to the client
  const { password_hash, ...safe } = user;
  return safe;
}

// ---------- POST /api/auth/register ----------
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, email, password } = req.body;

    const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const password_hash = bcrypt.hashSync(password, 10);

    const result = db
      .prepare(
        `INSERT INTO users (name, email, password_hash, auth_provider)
         VALUES (?, ?, ?, 'email')`
      )
      .run(name, email, password_hash);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
    const token = signToken(user);

    res.status(201).json({ token, user: publicUser(user) });
  }
);

// ---------- POST /api/auth/login ----------
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

    if (!user || !user.password_hash) {
      // Either no account, or a Google-only account with no password set
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.deleted_at) {
      return res.status(401).json({ error: "This account has been deleted" });
    }

    const valid = bcrypt.compareSync(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  }
);

// ---------- POST /api/auth/google ----------
// Frontend sends the Google ID token obtained from Google Sign-In button.
router.post("/google", async (req, res) => {
  const { credential } = req.body; // ID token (JWT) from Google
  if (!credential) {
    return res.status(400).json({ error: "Missing Google credential" });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload(); // { sub, email, name, picture, ... }

    let user = db.prepare("SELECT * FROM users WHERE google_id = ? OR email = ?").get(
      payload.sub,
      payload.email
    );

    if (!user) {
      const result = db
        .prepare(
          `INSERT INTO users (name, email, auth_provider, google_id)
           VALUES (?, ?, 'google', ?)`
        )
        .run(payload.name || payload.email, payload.email, payload.sub);
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
    } else if (!user.google_id) {
      // existing email/password account signing in with Google for the first time
      db.prepare("UPDATE users SET google_id = ? WHERE id = ?").run(payload.sub, user.id);
      user = db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
    }

    if (user.deleted_at) {
      return res.status(401).json({ error: "This account has been deleted" });
    }

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error("[auth/google] verification failed:", err.message);
    res.status(401).json({ error: "Invalid Google credential" });
  }
});

// ---------- GET /api/auth/me ----------
router.get("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user || user.deleted_at) return res.status(404).json({ error: "User not found" });
  res.json({ user: publicUser(user) });
});

// ---------- PATCH /api/auth/me ----------
// Basic profile update: name, phone (password/delete-account come in Phase 1.8)
router.patch(
  "/me",
  requireAuth,
  [
    body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
    body("phone").optional().trim(),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (!existing) return res.status(404).json({ error: "User not found" });

    const name = req.body.name ?? existing.name;
    const phone = req.body.phone ?? existing.phone;

    db.prepare(
      `UPDATE users SET name = ?, phone = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(name, phone, req.user.id);

    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    res.json({ user: publicUser(updated) });
  }
);

// ---------- PATCH /api/auth/password ----------
// Change password. If the account already has a password, the current one must be
// verified first. Google-only accounts (no password_hash yet) can set one directly —
// this is how a Google-signed-up user adds email/password as a second sign-in method.
router.patch(
  "/password",
  requireAuth,
  [
    body("newPassword").isLength({ min: 8 }).withMessage("New password must be at least 8 characters"),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.password_hash) {
      const { currentPassword } = req.body;
      if (!currentPassword || !bcrypt.compareSync(currentPassword, user.password_hash)) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }
    }

    const newHash = bcrypt.hashSync(req.body.newPassword, 10);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(
      newHash,
      user.id
    );

    res.json({ success: true });
  }
);

// ---------- DELETE /api/auth/me ----------
// Soft delete: marks the account deleted_at rather than removing the row, so billing/
// server history stays intact for records (per TAD's audit-trail requirements). A
// deleted account can no longer log in. Requires password confirmation for email
// accounts as a safety check against accidental/malicious calls with a stolen token.
router.delete("/me", requireAuth, (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  if (user.password_hash) {
    const { password } = req.body;
    if (!password || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: "Password is incorrect" });
    }
  }

  db.prepare("UPDATE users SET deleted_at = datetime('now') WHERE id = ?").run(user.id);
  res.json({ success: true });
});

module.exports = router;
