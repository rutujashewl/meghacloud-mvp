// routes/notifications.js
// Phase 7 - Notifications:
//   GET   /api/notifications              - list current user's notifications (newest first)
//   GET   /api/notifications/unread-count - badge count for the bell icon
//   PATCH /api/notifications/:id/read     - mark one as read
//   PATCH /api/notifications/read-all     - mark all as read

const express = require("express");
const db = require("../db/init");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  const notifications = db
    .prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50")
    .all(req.user.id);
  res.json({ notifications });
});

router.get("/unread-count", (req, res) => {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0")
    .get(req.user.id);
  res.json({ count: row.count });
});

router.patch("/:id/read", (req, res) => {
  const notification = db
    .prepare("SELECT * FROM notifications WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!notification) return res.status(404).json({ error: "Notification not found" });

  db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ?").run(notification.id);
  res.json({ notification: { ...notification, is_read: 1 } });
});

router.patch("/read-all", (req, res) => {
  db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0").run(req.user.id);
  res.json({ success: true });
});

module.exports = router;
