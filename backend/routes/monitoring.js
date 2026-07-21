// routes/monitoring.js
// Phase 6 - Basic Monitoring (simulated, no real VM agent yet — see TAD ADR-04):
//   GET /api/servers/:id/monitoring - current usage + 7-day trend + today's incident timeline
//
// Metrics are deterministically generated from the server's id + status, so repeated
// calls return a stable trend (doesn't jump around on every refresh) while the
// "current" reading has a small live jitter, similar to a real polling agent.

const express = require("express");
const db = require("../db/init");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// Simple seeded PRNG (mulberry32) so a given server+day always produces the same value.
function seededRandom(seed) {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function buildMetrics(server) {
  const isRunning = server.status === "running";
  const baseSeed = server.id * 1000;

  if (!isRunning) {
    return {
      current: { cpu: 0, ram: 0, disk: buildDiskUsage(server), uptime_pct: 0 },
      trend: buildTrend(baseSeed, false),
      incidents: buildIncidents(baseSeed, false),
    };
  }

  // Base load differs a bit per server (some servers just run hotter) but stays
  // in a believable band; "current" adds small live jitter on top of that base.
  const baseCpu = 15 + seededRandom(baseSeed) * 35; // 15-50%
  const baseRam = 30 + seededRandom(baseSeed + 1) * 40; // 30-70%
  const jitter = () => (Math.random() - 0.5) * 10; // +/- 5, changes each request

  return {
    current: {
      cpu: Math.round(clamp(baseCpu + jitter(), 1, 98)),
      ram: Math.round(clamp(baseRam + jitter(), 1, 98)),
      disk: buildDiskUsage(server),
      uptime_pct: Number((99 + seededRandom(baseSeed + 2)).toFixed(2)) > 100
        ? 99.99
        : Number((99 + seededRandom(baseSeed + 2)).toFixed(2)),
    },
    trend: buildTrend(baseSeed, true),
    incidents: buildIncidents(baseSeed, true),
  };
}

function buildDiskUsage(server) {
  const seed = server.id * 777 + server.name.length;
  return Math.round(20 + seededRandom(seed) * 50); // 20-70%
}

function buildTrend(baseSeed, isRunning) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((day, i) => {
    if (!isRunning) return { day, cpu: 0, ram: 0 };
    const cpu = Math.round(clamp(15 + seededRandom(baseSeed + 10 + i) * 45, 5, 90));
    const ram = Math.round(clamp(30 + seededRandom(baseSeed + 20 + i) * 45, 10, 95));
    return { day, cpu, ram };
  });
}

function buildIncidents(baseSeed, isRunning) {
  if (!isRunning) {
    return [{ time: "All day", status: "stopped", label: "Server stopped" }];
  }
  // Mostly healthy, occasional simulated "degraded" blip based on seed.
  const hasBlip = seededRandom(baseSeed + 99) > 0.7;
  if (!hasBlip) {
    return [{ time: "12 AM – 11:59 PM", status: "healthy", label: "Healthy" }];
  }
  return [
    { time: "12 AM – 2 PM", status: "healthy", label: "Healthy" },
    { time: "2 PM – 3 PM", status: "degraded", label: "Degraded Performance" },
    { time: "3 PM – 11:59 PM", status: "healthy", label: "Healthy" },
  ];
}

function ownedServer(id, userId) {
  return db.prepare("SELECT * FROM servers WHERE id = ? AND user_id = ?").get(id, userId);
}

// ---------- GET /api/servers/:id/monitoring ----------
router.get("/:id/monitoring", (req, res) => {
  const server = ownedServer(req.params.id, req.user.id);
  if (!server) return res.status(404).json({ error: "Server not found" });

  res.json(buildMetrics(server));
});

module.exports = router;
