// routes/servers.js
// Phase 2 - Server Provisioning (simulated, no real VM boot yet — see TAD ADR-04):
//   GET    /api/servers              - list current user's servers
//   POST   /api/servers              - launch a new server
//   GET    /api/servers/:id          - single server detail
//   PATCH  /api/servers/:id/start    - start a stopped server
//   PATCH  /api/servers/:id/stop     - stop a running server
//   PATCH  /api/servers/:id/restart  - restart a running server
//   DELETE /api/servers/:id          - permanently delete a server

const express = require("express");
const { body, validationResult } = require("express-validator");

const db = require("../db/init");
const { requireAuth } = require("../middleware/auth");
const { SIZES, REGIONS, OS_OPTIONS, priceFor } = require("../config/pricing");
const { notify } = require("../services/notify");

const router = express.Router();
router.use(requireAuth);

function ownedServer(id, userId) {
  return db.prepare("SELECT * FROM servers WHERE id = ? AND user_id = ?").get(id, userId);
}

// ---------- GET /api/servers/meta ----------
// Options for the launch form: OS list, sizes (with price), regions.
// Registered before "/:id" so "meta" isn't swallowed as an :id param.
router.get("/meta", (req, res) => {
  res.json({ osOptions: OS_OPTIONS, sizes: SIZES, regions: REGIONS });
});

// ---------- GET /api/servers ----------
router.get("/", (req, res) => {
  const servers = db
    .prepare("SELECT * FROM servers WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.user.id);
  res.json({ servers });
});

// ---------- POST /api/servers ----------
router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Server name is required"),
    body("os").isIn(OS_OPTIONS).withMessage("Invalid OS selection"),
    body("size").isIn(Object.keys(SIZES)).withMessage("Invalid size selection"),
    body("region").isIn(REGIONS).withMessage("Invalid region"),
  ],
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { name, os, size, region } = req.body;
    const monthly_cost = priceFor(size);

    const result = db
      .prepare(
        `INSERT INTO servers (user_id, name, os, size, region, status, monthly_cost)
         VALUES (?, ?, ?, ?, ?, 'running', ?)`
      )
      .run(req.user.id, name, os, size, region, monthly_cost);

    const server = db.prepare("SELECT * FROM servers WHERE id = ?").get(result.lastInsertRowid);
    notify(req.user.id, "server_launched", server);
    res.status(201).json({ server });
  }
);

// ---------- GET /api/servers/:id ----------
router.get("/:id", (req, res) => {
  const server = ownedServer(req.params.id, req.user.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  res.json({ server });
});

// ---------- PATCH /api/servers/:id/start ----------
router.patch("/:id/start", (req, res) => {
  const server = ownedServer(req.params.id, req.user.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (server.status === "running") {
    return res.status(409).json({ error: "Server is already running" });
  }

  db.prepare("UPDATE servers SET status = 'running', updated_at = datetime('now') WHERE id = ?").run(server.id);
  res.json({ server: db.prepare("SELECT * FROM servers WHERE id = ?").get(server.id) });
});

// ---------- PATCH /api/servers/:id/stop ----------
router.patch("/:id/stop", (req, res) => {
  const server = ownedServer(req.params.id, req.user.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (server.status === "stopped") {
    return res.status(409).json({ error: "Server is already stopped" });
  }

  db.prepare("UPDATE servers SET status = 'stopped', updated_at = datetime('now') WHERE id = ?").run(server.id);
  const updated = db.prepare("SELECT * FROM servers WHERE id = ?").get(server.id);
  notify(req.user.id, "server_stopped", updated);
  res.json({ server: updated });
});

// ---------- PATCH /api/servers/:id/restart ----------
router.patch("/:id/restart", (req, res) => {
  const server = ownedServer(req.params.id, req.user.id);
  if (!server) return res.status(404).json({ error: "Server not found" });
  if (server.status !== "running") {
    return res.status(409).json({ error: "Only a running server can be restarted" });
  }

  // Simulated restart: status stays 'running', just bump updated_at.
  db.prepare("UPDATE servers SET updated_at = datetime('now') WHERE id = ?").run(server.id);
  res.json({ server: db.prepare("SELECT * FROM servers WHERE id = ?").get(server.id) });
});

// ---------- DELETE /api/servers/:id ----------
router.delete("/:id", (req, res) => {
  const server = ownedServer(req.params.id, req.user.id);
  if (!server) return res.status(404).json({ error: "Server not found" });

  db.prepare("DELETE FROM servers WHERE id = ?").run(server.id);
  res.status(204).send();
});

module.exports = router;
