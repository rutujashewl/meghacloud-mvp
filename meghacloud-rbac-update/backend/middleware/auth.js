// middleware/auth.js
// Verifies the JWT sent in the Authorization header and attaches
// the decoded user info to req.user for downstream routes.

const jwt = require("jsonwebtoken");
const { db } = require("../db/init");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Pull role/org_id fresh from the DB on every request instead of trusting the
    // JWT for them — an admin demoting/removing someone should take effect
    // immediately, not after their token expires.
    const row = await db
      .prepare("SELECT id, email, name, role, org_id, deleted_at FROM users WHERE id = ?")
      .get(payload.id);

    if (!row || row.deleted_at) {
      return res.status(401).json({ error: "Account no longer active" });
    }

    req.user = { id: row.id, email: row.email, name: row.name, role: row.role, orgId: row.org_id };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// requireRole("owner", "admin") -> 403s anyone whose role isn't in the list.
// Use after requireAuth so req.user.role is already populated.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: `This action requires one of: ${allowedRoles.join(", ")}` });
    }
    next();
  };
}

// Blocks write methods for the read-only Auditor role; GETs pass through.
function blockAuditorWrites(req, res, next) {
  if (req.user.role === "auditor" && req.method !== "GET") {
    return res.status(403).json({ error: "Auditor role is read-only" });
  }
  next();
}

module.exports = { requireAuth, requireRole, blockAuditorWrites };
