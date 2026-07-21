import client from "./client";

export async function listNotifications() {
  const { data } = await client.get("/notifications");
  return data.notifications;
}

export async function getUnreadCount() {
  const { data } = await client.get("/notifications/unread-count");
  return data.count;
}

export async function markRead(id) {
  const { data } = await client.patch(`/notifications/${id}/read`);
  return data.notification;
}

export async function markAllRead() {
  await client.patch("/notifications/read-all");
}
