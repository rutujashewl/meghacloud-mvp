// middleware/auth.js
// Verifies the JWT sent in the Authorization header and attaches
// the decoded user info to req.user for downstream routes.

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { db } = require("../db/init");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  try {
    if (token.startsWith("mc_live_")) {
      const keyHash = crypto.createHash("sha256").update(token).digest("hex");
      const key = await db.prepare("SELECT u.id, u.email, u.name, u.role, u.org_id FROM api_keys k JOIN users u ON u.id = k.user_id WHERE k.key_hash = ? AND k.revoked_at IS NULL AND u.deleted_at IS NULL").get(keyHash);
      if (!key) return res.status(401).json({ error: "Invalid or revoked API key" });
      await db.prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE key_hash = ?").run(keyHash);
      req.user = { id: key.id, email: key.email, name: key.name, role: key.role || "owner", orgId: key.org_id || key.id };
      return next();
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id, email: payload.email, name: payload.name, role: payload.role || "owner", orgId: payload.org_id || payload.id };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `This action requires one of: ${allowedRoles.join(", ")}` });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
