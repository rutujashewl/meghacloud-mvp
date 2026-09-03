const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const { db } = require("../db/init");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();
const roles = ["owner", "admin", "developer", "auditor"];
router.use(requireAuth);

function publicMember(user) {
  const { password_hash, google_id, ...safe } = user;
  return safe;
}

router.get("/", async (req, res) => {
  const members = await db.prepare(
    `SELECT * FROM users WHERE org_id = ? AND deleted_at IS NULL ORDER BY created_at`
  ).all(req.user.orgId);
  res.json({ members: members.map(publicMember) });
});

router.post("/invite", requireRole("owner", "admin"), [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("email").isEmail().normalizeEmail().withMessage("Valid email is required"),
  body("role").isIn(roles).withMessage(`Role must be one of: ${roles.join(", ")}`),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  const { name, email, role } = req.body;
  if (role === "owner" && req.user.role !== "owner") {
    return res.status(403).json({ error: "Only an owner can grant the owner role" });
  }
  const existing = await db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "An account with this email already exists" });
  const tempPassword = crypto.randomBytes(6).toString("hex");
  const result = await db.prepare(
    `INSERT INTO users (name, email, password_hash, auth_provider, role, org_id)
     VALUES (?, ?, ?, 'email', ?, ?)`
  ).run(name, email, bcrypt.hashSync(tempPassword, 10), role, req.user.orgId);
  const member = await db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ member: publicMember(member), tempPassword });
});

router.patch("/:id/role", requireRole("owner"), [
  body("role").isIn(roles).withMessage(`Role must be one of: ${roles.join(", ")}`),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  const member = await db.prepare("SELECT * FROM users WHERE id = ? AND org_id = ?").get(req.params.id, req.user.orgId);
  if (!member) return res.status(404).json({ error: "Team member not found" });
  await db.prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?").run(req.body.role, member.id);
  const updated = await db.prepare("SELECT * FROM users WHERE id = ?").get(member.id);
  res.json({ member: publicMember(updated) });
});

router.delete("/:id", requireRole("owner", "admin"), async (req, res) => {
  const member = await db.prepare("SELECT * FROM users WHERE id = ? AND org_id = ?").get(req.params.id, req.user.orgId);
  if (!member) return res.status(404).json({ error: "Team member not found" });
  if (member.id === req.user.id) return res.status(400).json({ error: "You can't remove yourself from the team" });
  await db.prepare("UPDATE users SET deleted_at = datetime('now') WHERE id = ?").run(member.id);
  res.status(204).send();
});

module.exports = router;
