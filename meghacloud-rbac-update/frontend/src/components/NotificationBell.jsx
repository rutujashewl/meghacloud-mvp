import { useEffect, useRef, useState } from "react";
import * as notificationsApi from "../api/notifications";

function timeAgo(isoLike) {
  // SQLite datetime('now') is UTC without a 'Z' suffix — append it so Date parses correctly.
  const then = new Date(isoLike.replace(" ", "T") + "Z").getTime();
  const diffMin = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}

const TYPE_ICON = {
  server_launched: "🚀",
  server_stopped: "⏸",
  payment_successful: "💳",
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function refreshCount() {
    try {
      setUnreadCount(await notificationsApi.getUnreadCount());
    } catch {
      // fail silently — bell just won't show a badge
    }
  }

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      try {
        setNotifications(await notificationsApi.listNotifications());
        setLoaded(true);
      } catch {
        // ignore
      }
    }
  }

  async function handleMarkAllRead() {
    await notificationsApi.markAllRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: 1 })));
    setUnreadCount(0);
  }

  async function handleItemClick(n) {
    if (!n.is_read) {
      await notificationsApi.markRead(n.id);
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: 1 } : x)));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  }

  return (
    <div className="notif-bell-wrap" ref={boxRef}>
      <button className="btn btn-ghost notif-bell" onClick={handleOpen} aria-label="Notifications">
        🔔
        {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span>Notifications</span>
            {unreadCount > 0 && (
              <button className="btn-link" onClick={handleMarkAllRead}>Mark all read</button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-muted" style={{ padding: "16px" }}>No notifications yet.</p>
          ) : (
            <div className="notif-list">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  className={`notif-item ${n.is_read ? "" : "notif-item--unread"}`}
                  onClick={() => handleItemClick(n)}
                >
                  <span className="notif-icon">{TYPE_ICON[n.type] || "🔔"}</span>
                  <span className="notif-body">
                    <span className="notif-title">{n.title}</span>
                    <span className="notif-message">{n.message}</span>
                    <span className="notif-time">{timeAgo(n.created_at)}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
