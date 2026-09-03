const express = require("express");
const { body, validationResult } = require("express-validator");
const { db } = require("../db/init");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
const engines = { postgres: { versions: ["16", "15"], base: 1499 }, mysql: { versions: ["8.0", "5.7"], base: 1299 } };
const sizes = { small: 1, medium: 2, large: 4 };
router.use(requireAuth);

function owned(id, userId) { return db.prepare("SELECT * FROM managed_databases WHERE id = ? AND user_id = ?").get(id, userId); }

router.get("/meta", (req, res) => res.json({ engines, sizes: Object.keys(sizes), regions: ["Mumbai"] }));
router.get("/", async (req, res) => {
  const databases = await db.prepare("SELECT * FROM managed_databases WHERE user_id = ? ORDER BY created_at DESC").all(req.user.id);
  res.json({ databases });
});
router.post("/", [
  body("name").trim().notEmpty().withMessage("Database name is required"),
  body("engine").isIn(Object.keys(engines)).withMessage("Invalid database engine"),
  body("version").trim().notEmpty().withMessage("Database version is required"),
  body("size").isIn(Object.keys(sizes)).withMessage("Invalid database size"),
  body("region").isIn(["Mumbai"]).withMessage("Invalid database region"),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  const engine = engines[req.body.engine];
  if (!engine.versions.includes(req.body.version)) return res.status(400).json({ error: "Invalid database version" });
  const monthlyCost = engine.base * sizes[req.body.size];
  const result = await db.prepare(`INSERT INTO managed_databases (user_id, org_id, name, engine, version, size, region, monthly_cost) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(req.user.id, req.user.orgId, req.body.name, req.body.engine, req.body.version, req.body.size, req.body.region, monthlyCost);
  const database = await db.prepare("SELECT * FROM managed_databases WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ database });
});
router.delete("/:id", async (req, res) => {
  const database = await owned(req.params.id, req.user.id);
  if (!database) return res.status(404).json({ error: "Database not found" });
  await db.prepare("DELETE FROM managed_databases WHERE id = ?").run(database.id);
  res.status(204).send();
});
module.exports = router;
