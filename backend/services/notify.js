// services/notify.js
// Central place that fires both an in-app notification and an email whenever
// something notification-worthy happens (server launched/stopped, payment successful).
//
// v1.0 MVP: no real SMTP is configured yet, so sendEmail() just logs the email
// into the `email_log` table instead of actually dispatching it — this keeps the
// rest of the app (routes) unaware of whether email is "real" or simulated, so
// swapping in a real provider (SendGrid/SES) later only touches this one file.

const db = require("../db/init");

const TEMPLATES = {
  server_launched: (server) => ({
    title: "Server launched",
    message: `"${server.name}" is now running in ${server.region}.`,
    emailSubject: `MeghaCloud: "${server.name}" launched successfully`,
    emailBody: `Your server "${server.name}" (${server.os}, ${server.size}) has been launched in ${server.region}.\nEstimated cost: Rs. ${server.monthly_cost}/month.`,
  }),
  server_stopped: (server) => ({
    title: "Server stopped",
    message: `"${server.name}" has been stopped.`,
    emailSubject: `MeghaCloud: "${server.name}" was stopped`,
    emailBody: `Your server "${server.name}" has been stopped. Billing for compute pauses while it's stopped; storage charges (if any) continue.`,
  }),
  payment_successful: (invoice) => ({
    title: "Payment successful",
    message: `Payment of Rs. ${invoice.total_amount.toLocaleString("en-IN")} received for invoice ${invoice.invoice_number}.`,
    emailSubject: `MeghaCloud: Payment received for ${invoice.invoice_number}`,
    emailBody: `We've received your payment of Rs. ${invoice.total_amount.toLocaleString("en-IN")} for invoice ${invoice.invoice_number} via ${invoice.payment_method}. Thank you!`,
  }),
};

function sendEmail(userId, toEmail, subject, body) {
  // Simulated send — see file header. Swap this body out for a real provider call later.
  db.prepare(
    `INSERT INTO email_log (user_id, to_email, subject, body) VALUES (?, ?, ?, ?)`
  ).run(userId, toEmail, subject, body);
  console.log(`[email:simulated] to=${toEmail} subject="${subject}"`);
}

/**
 * Fires an in-app notification + simulated email for a known event type.
 * @param {number} userId
 * @param {string} type - one of the TEMPLATES keys
 * @param {object} payload - the server or invoice object the template needs
 */
function notify(userId, type, payload) {
  const template = TEMPLATES[type];
  if (!template) throw new Error(`Unknown notification type: ${type}`);

  const { title, message, emailSubject, emailBody } = template(payload);

  db.prepare(
    `INSERT INTO notifications (user_id, type, title, message) VALUES (?, ?, ?, ?)`
  ).run(userId, type, title, message);

  const user = db.prepare("SELECT email FROM users WHERE id = ?").get(userId);
  if (user) sendEmail(userId, user.email, emailSubject, emailBody);
}

module.exports = { notify };
