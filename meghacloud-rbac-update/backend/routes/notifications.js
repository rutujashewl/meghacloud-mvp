// routes/notifications.js
// Phase 7 - Notifications:
//   GET   /api/notifications              - list current user's notifications (newest first)
//   GET   /api/notifications/unread-count - badge count for the bell icon
//   PATCH /api/notifications/:id/read     - mark one as read
//   PATCH /api/notifications/read-all     - mark all as read

const express = require("express");
const { db } = require("../db/init");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", async (req, res) => {
  const notifications = await db
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
    .all(req.user.id);
  res.json({ notifications });
});

router.get("/unread-count", async (req, res) => {
  const row = await db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0")
    .get(req.user.id);
  // Postgres returns COUNT(*) as a string (bigint) — coerce to a real number.
  res.json({ count: parseInt(row?.count, 10) || 0 });
});

router.patch("/:id/read", async (req, res) => {
  const notification = await db
    .prepare("SELECT * FROM notifications WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!notification) return res.status(404).json({ error: "Notification not found" });

  await db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(notification.id);
  res.json({ notification: { ...notification, is_read: 1 } });
});

router.patch("/read-all", async (req, res) => {
  await db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0").run(req.user.id);
  res.json({ success: true });
});

module.exports = router;