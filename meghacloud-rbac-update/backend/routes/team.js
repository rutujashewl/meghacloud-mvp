// routes/team.js
// RBAC — Team management (PRD: Owner, Developer, Admin, Auditor roles).
//   GET    /api/team               - list all members of the current user's org
//   POST   /api/team/invite        - add a member (owner/admin only)
//   PATCH  /api/team/:id/role      - change a member's role (owner only)
//   DELETE /api/team/:id           - remove a member (owner/admin only)
//
// v1.0 MVP: "invite" creates the account directly with a generated temp password
// and emails it via the existing simulated notify/email_log pipeline — a real
// token-based invite-link flow is a separate milestone (needs real email delivery).

const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");

const { db } = require("../db/init");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const ROLES = ["owner", "admin", "developer", "auditor"];

function publicMember(user) {
  const { password_hash, google_id, ...safe } = user;
  return safe;
}

// ---------- GET /api/team ----------
router.get("/", async (req, res) => {
  const members = await db
    .prepare(
      `SELECT * FROM users WHERE org_id = ? AND deleted_at IS NULL ORDER BY
       CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 WHEN 'developer' THEN 2 ELSE 3 END, created_at`
    )
    .all(req.user.orgId);
  res.json({ members: members.map(publicMember) });
});

// ---------- POST /api/team/invite ----------
router.post(
  "/invite",
  requireRole("owner", "admin"),
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required").normalizeEmail(),
    body("role").isIn(ROLES).withMessage(`Role must be one of: ${ROLES.join(", ")}`),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, email, role } = req.body;

    // Only an owner can create another owner — an admin inviting someone can't
    // hand out owner-level access.
    if (role === "owner" && req.user.role !== "owner") {
      return res.status(403).json({ error: "Only an owner can grant the owner role" });
    }

    const existing = await db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const tempPassword = crypto.randomBytes(6).toString("hex"); // e.g. "a1b2c3d4e5f6"
    const password_hash = bcrypt.hashSync(tempPassword, 10);

    const result = await db
      .prepare(
        `INSERT INTO users (name, email, password_hash, auth_provider, role, org_id)
         VALUES (?, ?, ?, 'email', ?, ?)`
      )
      .run(name, email, password_hash, role, req.user.orgId);

    // Reuse the existing simulated email pipeline (logs to email_log) so the
    // temp password shows up the same way every other notification email does.
    db.prepare(
      `INSERT INTO email_log (user_id, to_email, subject, body) VALUES (?, ?, ?, ?)`
    ).run(
      result.lastInsertRowid,
      email,
      "You've been added to a MeghaCloud team",
      `${req.user.name} added you to their MeghaCloud team as ${role}.\nLog in with email ${email} and temporary password: ${tempPassword}\nPlease change your password after logging in.`
    );

    const member = await db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
    res.status(201).json({ member: publicMember(member), tempPassword });
  }
);

// ---------- PATCH /api/team/:id/role ----------
router.patch(
  "/:id/role",
  requireRole("owner"),
  [body("role").isIn(ROLES).withMessage(`Role must be one of: ${ROLES.join(", ")}`)],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const member = await db
      .prepare("SELECT * FROM users WHERE id = ? AND org_id = ?")
      .get(req.params.id, req.user.orgId);
    if (!member) return res.status(404).json({ error: "Team member not found" });

    if (member.role === "owner" && req.body.role !== "owner") {
      const ownerCount = await db
        .prepare("SELECT COUNT(*) as c FROM users WHERE org_id = ? AND role = 'owner' AND deleted_at IS NULL")
        .get(req.user.orgId);
      if ((parseInt(ownerCount?.c, 10) || 0) <= 1) {
        return res.status(409).json({ error: "A team must keep at least one owner" });
      }
    }

    await db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?").run(req.body.role, member.id);
    const updated = await db.prepare("SELECT * FROM users WHERE id = ?").get(member.id);
    res.json({ member: publicMember(updated) });
  }
);

// ---------- DELETE /api/team/:id ----------
router.delete("/:id", requireRole("owner", "admin"), async (req, res) => {
  const member = await db
    .prepare("SELECT * FROM users WHERE id = ? AND org_id = ?")
    .get(req.params.id, req.user.orgId);
  if (!member) return res.status(404).json({ error: "Team member not found" });

  if (member.id === req.user.id) {
    return res.status(400).json({ error: "You can't remove yourself from the team" });
  }
  if (member.role === "owner") {
    return res.status(403).json({ error: "Transfer ownership before removing an owner" });
  }

  await db.prepare("UPDATE users SET deleted_at = datetime('now') WHERE id = ?").run(member.id);
  res.status(204).send();
});

module.exports = router;
