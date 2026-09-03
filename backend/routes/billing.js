// routes/billing.js
// Phase 5 - Billing:
//   GET  /api/billing/invoices           - list current user's invoices
//   POST /api/billing/invoices/generate  - generate a new invoice from running servers
//   GET  /api/billing/invoices/:id       - single invoice detail
//   POST /api/billing/invoices/:id/pay   - simulate payment (UPI/Razorpay)
//   GET  /api/billing/invoices/:id/pdf   - download invoice as PDF
//
// v1.0 MVP: payment is simulated (mark-as-paid). Real Razorpay/UPI webhook
// integration (signature verification etc., per TAD Section 10.3 threat model)
// is a separate milestone requiring live merchant credentials.

const express = require("express");
const crypto = require("crypto");
const PDFDocument = require("pdfkit");
const { body, validationResult } = require("express-validator");

const { db } = require("../db/init");
const { requireAuth } = require("../middleware/auth");
const { notify } = require("../services/notify");

const router = express.Router();

const GST_RATE = 0.18;

router.post("/webhook", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!signature || !secret || !Buffer.isBuffer(req.body)) return res.status(400).json({ error: "Invalid webhook configuration" });
  const expected = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return res.status(400).json({ error: "Invalid webhook signature" });
  let event;
  try { event = JSON.parse(req.body.toString("utf8")); } catch { return res.status(400).json({ error: "Invalid webhook payload" }); }
  if (event.event !== "payment.captured") return res.json({ received: true });
  const payment = event.payload?.payment?.entity;
  if (!payment?.order_id) return res.status(400).json({ error: "Missing payment order ID" });
  const invoice = await db.prepare("SELECT * FROM invoices WHERE razorpay_order_id = ?").get(payment.order_id);
  if (!invoice) return res.status(404).json({ error: "Invoice not found for payment order" });
  if (invoice.status !== "paid") {
    await db.prepare("UPDATE invoices SET status = 'paid', payment_method = 'razorpay', razorpay_payment_id = ?, paid_at = datetime('now') WHERE id = ?").run(payment.id, invoice.id);
    const updated = await db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoice.id);
    await notify(invoice.user_id, "payment_successful", updated);
  }
  res.json({ received: true });
});

router.use(requireAuth);

function razorpayClient() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return null;
  const Razorpay = require("razorpay");
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}

router.post("/invoices/:id/razorpay/order", async (req, res) => {
  const razorpay = razorpayClient();
  if (!razorpay) return res.status(503).json({ error: "Razorpay is not configured" });
  const invoice = await ownedInvoice(req.params.id, req.user.id);
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  if (invoice.status === "paid") return res.status(409).json({ error: "Invoice is already paid" });
  try {
    const order = await razorpay.orders.create({ amount: invoice.total_amount * 100, currency: "INR", receipt: invoice.invoice_number });
    await db.prepare("UPDATE invoices SET razorpay_order_id = ? WHERE id = ?").run(order.id, invoice.id);
    res.json({ order, keyId: process.env.RAZORPAY_KEY_ID, invoiceId: invoice.id });
  } catch (error) {
    console.error("[razorpay/order] failed:", error.message);
    res.status(502).json({ error: "Could not create Razorpay order" });
  }
});

router.post("/invoices/:id/razorpay/verify", [
  body("razorpay_order_id").trim().notEmpty(),
  body("razorpay_payment_id").trim().notEmpty(),
  body("razorpay_signature").trim().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: "Razorpay payment details are required" });
  const invoice = await ownedInvoice(req.params.id, req.user.id);
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  const payload = `${req.body.razorpay_order_id}|${req.body.razorpay_payment_id}`;
  const expected = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "").update(payload).digest("hex");
  if (expected.length !== req.body.razorpay_signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(req.body.razorpay_signature))) {
    return res.status(400).json({ error: "Invalid Razorpay payment signature" });
  }
  await db.prepare("UPDATE invoices SET status = 'paid', payment_method = 'razorpay', razorpay_order_id = ?, razorpay_payment_id = ?, paid_at = datetime('now') WHERE id = ?").run(req.body.razorpay_order_id, req.body.razorpay_payment_id, invoice.id);
  const updated = await db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoice.id);
  await notify(req.user.id, "payment_successful", updated);
  res.json({ invoice: updated });
});

router.get("/autopay", async (req, res) => {
  const user = await db.prepare("SELECT upi_id, autopay_enabled FROM users WHERE id = ?").get(req.user.id);
  res.json({ autopay: user });
});

router.put("/autopay", [
  body("upi_id").trim().matches(/^[\w.-]+@[\w.-]+$/).withMessage("Enter a valid UPI ID"),
  body("enabled").isBoolean().withMessage("enabled must be true or false"),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });
  await db.prepare("UPDATE users SET upi_id = ?, autopay_enabled = ? WHERE id = ?")
    .run(req.body.upi_id, req.body.enabled, req.user.id);
  res.json({ autopay: { upi_id: req.body.upi_id, autopay_enabled: req.body.enabled } });
});

async function ownedInvoice(id, userId) {
  return db.prepare("SELECT * FROM invoices WHERE id = ? AND user_id = ?").get(id, userId);
}

async function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  const count = await db.prepare("SELECT COUNT(*) as c FROM invoices WHERE invoice_number LIKE ?").get(`MC-${year}-%`);
  const seq = String((parseInt(count?.c, 10) || 0) + 1).padStart(3, "0");
  return `MC-${year}-${seq}`;
}

// ---------- GET /api/billing/invoices ----------
router.get("/invoices", async (req, res) => {
  const invoices = await db
    .prepare("SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.user.id);
  res.json({ invoices });
});

// ---------- POST /api/billing/invoices/generate ----------
// Generates an invoice from the sum of the user's currently-running servers'
// monthly_cost. Meant to simulate a monthly billing cycle for MVP demo purposes.
router.post("/invoices/generate", async (req, res) => {
  const servers = await db
    .prepare("SELECT * FROM servers WHERE user_id = ? AND status = 'running'")
    .all(req.user.id);

  if (servers.length === 0) {
    return res.status(400).json({ error: "No running servers to bill for" });
  }

  const subtotal = servers.reduce((sum, s) => sum + s.monthly_cost, 0);
  const gst_amount = Math.round(subtotal * GST_RATE);
  const total_amount = subtotal + gst_amount;
  const invoice_number = await nextInvoiceNumber();

  const result = await db
    .prepare(
      `INSERT INTO invoices (user_id, invoice_number, subtotal, gst_amount, total_amount, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`
    )
    .run(req.user.id, invoice_number, subtotal, gst_amount, total_amount);

  const invoice = await db.prepare("SELECT * FROM invoices WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ invoice });
});

// ---------- GET /api/billing/invoices/:id ----------
router.get("/invoices/:id", async (req, res) => {
  const invoice = await ownedInvoice(req.params.id, req.user.id);
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  res.json({ invoice });
});

// ---------- POST /api/billing/invoices/:id/pay ----------
router.post(
  "/invoices/:id/pay",
  [body("method").isIn(["upi", "razorpay"]).withMessage("Payment method must be upi or razorpay")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const invoice = await ownedInvoice(req.params.id, req.user.id);
    if (!invoice) return res.status(404).json({ error: "Invoice not found" });
    if (invoice.status === "paid") {
      return res.status(409).json({ error: "Invoice is already paid" });
    }

    await db.prepare(
      `UPDATE invoices SET status = 'paid', payment_method = ?, paid_at = datetime('now') WHERE id = ?`
    ).run(req.body.method, invoice.id);

    const updated = await db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoice.id);
    await notify(req.user.id, "payment_successful", updated);
    res.json({ invoice: updated });
  }
);

// ---------- GET /api/billing/invoices/:id/pdf ----------
router.get("/invoices/:id/pdf", async (req, res) => {
  const invoice = await ownedInvoice(req.params.id, req.user.id);
  if (!invoice) return res.status(404).json({ error: "Invoice not found" });

  const user = await db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${invoice.invoice_number}.pdf"`);

  const doc = new PDFDocument({ size: "A4", margin: 50 });
  doc.pipe(res);

  // Header
  doc.fontSize(20).fillColor("#1D4ED8").text("MeghaCloud", { continued: false });
  doc.fontSize(10).fillColor("#6B7280").text("India-hosted, DPDPA-compliant cloud infrastructure");
  doc.moveDown(1.5);

  doc.fontSize(16).fillColor("#1A1A1A").text("Tax Invoice", { underline: false });
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor("#374151");
  doc.text(`Invoice Number: ${invoice.invoice_number}`);
  doc.text(`Invoice Date: ${invoice.created_at}`);
  doc.text(`Status: ${invoice.status.toUpperCase()}`);
  if (invoice.paid_at) doc.text(`Paid On: ${invoice.paid_at} (${invoice.payment_method})`);
  doc.moveDown(1);

  doc.text(`Billed To: ${user.name}`);
  doc.text(`Email: ${user.email}`);
  if (user.gstin) doc.text(`GSTIN: ${user.gstin}`);
  doc.moveDown(1.5);

  // Table header
  const tableTop = doc.y;
  doc.fontSize(10).fillColor("#FFFFFF");
  doc.rect(50, tableTop, 495, 22).fill("#1D4ED8");
  doc.fillColor("#FFFFFF").text("Description", 60, tableTop + 6);
  doc.text("Amount (Rs.)", 460, tableTop + 6);

  let rowY = tableTop + 30;
  doc.fillColor("#1A1A1A").fontSize(10);
  doc.text("Cloud infrastructure — running servers (monthly)", 60, rowY);
  doc.text(invoice.subtotal.toLocaleString("en-IN"), 460, rowY);

  rowY += 22;
  doc.text("CGST (9%) + SGST (9%)", 60, rowY);
  doc.text(invoice.gst_amount.toLocaleString("en-IN"), 460, rowY);

  rowY += 8;
  doc.moveTo(50, rowY + 14).lineTo(545, rowY + 14).strokeColor("#E2E8F0").stroke();

  rowY += 24;
  doc.fontSize(12).fillColor("#1D4ED8").text("Total", 60, rowY);
  doc.text(`Rs. ${invoice.total_amount.toLocaleString("en-IN")}`, 440, rowY);

  doc.moveDown(4);
  doc.fontSize(8).fillColor("#6B7280").text(
    "All data stored in India. Zero egress fees. This is a system-generated invoice for MeghaCloud MVP demo purposes.",
    50, doc.y, { width: 495 }
  );

  doc.end();
});

module.exports = router;