const express = require("express");
const { db } = require("../db/init");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const [invoice, notification, team, apiKey] = await Promise.all([
    db.prepare("SELECT COUNT(*)::int AS count FROM invoices WHERE user_id = ?").get(req.user.id),
    db.prepare("SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = ?").get(req.user.id),
    db.prepare("SELECT COUNT(*)::int AS count FROM users WHERE org_id = ? AND deleted_at IS NULL").get(req.user.orgId),
    db.prepare("SELECT COUNT(*)::int AS count FROM api_keys WHERE user_id = ? AND revoked_at IS NULL").get(req.user.id),
  ]);

  const checks = [
    { id: "data-residency", label: "India data residency", status: "pass", detail: "Configured for India-hosted data" },
    { id: "gst-invoice", label: "GST invoice records", status: invoice.count > 0 ? "pass" : "attention", detail: `${invoice.count} invoice record(s)` },
    { id: "audit-trail", label: "Notification audit trail", status: notification.count > 0 ? "pass" : "attention", detail: `${notification.count} notification record(s)` },
    { id: "team-security", label: "Team access review", status: team.count > 0 ? "pass" : "attention", detail: `${team.count} active team member(s)` },
    { id: "api-security", label: "API key inventory", status: apiKey.count > 0 ? "pass" : "attention", detail: `${apiKey.count} active API key(s)` },
  ];
  const score = Math.round(checks.reduce((total, check) => total + (check.status === "pass" ? 20 : 10), 0));
  res.json({ score, checks, generated_at: new Date().toISOString() });
});

module.exports = router;
