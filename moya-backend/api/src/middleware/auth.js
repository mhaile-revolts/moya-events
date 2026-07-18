const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

// Fail fast at startup if the default secret reaches production.
if (process.env.NODE_ENV === "production" && JWT_SECRET === "dev-secret-change-me") {
  console.error("FATAL: JWT_SECRET must be set to a strong random value in production.");
  process.exit(1);
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

/**
 * Auth for the gate-scanner check-in endpoint.
 *
 * Accepts either:
 *   1. X-Scanner-Key: <SCANNER_API_KEY>  — for dedicated scanner devices
 *   2. Authorization: Bearer <jwt>        — for organiser apps / testing
 *
 * When SCANNER_API_KEY is not set the endpoint requires a valid JWT, so
 * it is never left completely unauthenticated regardless of environment.
 * Set SCANNER_API_KEY to a long random string for physical scanner devices.
 */
function requireCheckinAuth(req, res, next) {
  const scannerKey = process.env.SCANNER_API_KEY;
  if (scannerKey) {
    const provided = req.headers["x-scanner-key"] || "";
    if (provided === scannerKey) return next();
  }
  // Fall back to standard JWT bearer auth.
  requireAuth(req, res, next);
}

function signToken(user) {
  return jwt.sign({ id: user.id, name: user.name, phone: user.phone }, JWT_SECRET, { expiresIn: "30d" });
}

module.exports = { requireAuth, requireCheckinAuth, signToken, JWT_SECRET };
