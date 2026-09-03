const express = require("express");
const crypto = require("crypto");
const { body, validationResult } = require("express-validator");
const { db } = require("../db/init");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const keys = await db.prepare("SELECT id, name, last_used_at, created_at, revoked_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  res.json({ keys });
});

router.post("/", [body("name").trim().isLength({ min: 2, max: 80 }).withMessage("Key name must be 2-80 characters")], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  const rawKey = `mc_live_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 16);
  const result = await db.prepare("INSERT INTO api_keys (user_id, name, key_prefix, key_hash) VALUES (?, ?, ?, ?)").run(req.user.id, req.body.name, keyPrefix, keyHash);
  const key = await db.prepare("SELECT id, name, created_at FROM api_keys WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ key, secret: rawKey });
});

router.delete("/:id", async (req, res) => {
  const result = await db.prepare("UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND user_id = ? AND revoked_at IS NULL").run(req.params.id, req.user.id);
  if (!result.changes) return res.status(404).json({ error: "API key not found" });
  res.status(204).send();
});

module.exports = router;
