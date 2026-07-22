// server.js
// MeghaCloud MVP - Phase 1: Authentication backend

require("dotenv").config();
const express = require("express");
const cors = require("cors");

const { initSchema } = require("./db/init"); // creates the SQLite file + users table on boot

const authRoutes = require("./routes/auth");
const serverRoutes = require("./routes/servers");
const billingRoutes = require("./routes/billing");
const monitoringRoutes = require("./routes/monitoring");
const notificationRoutes = require("./routes/notifications");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "meghacloud-backend", phase: "7-notifications" });
});

app.use("/api/auth", authRoutes);
app.use("/api/servers", serverRoutes);
app.use("/api/servers", monitoringRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/notifications", notificationRoutes);

// fallback 404
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

initSchema()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[server] MeghaCloud backend running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database initialization failed:", err);
    process.exit(1);
  });