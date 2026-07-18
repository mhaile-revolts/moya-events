const express = require("express");
const { randomInt } = require("crypto");
const { pool } = require("../db");
const { signToken } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// 6-digit code from a cryptographically secure source (previously 4-digit Math.random).
function genCode() {
  return String(randomInt(100000, 1000000));
}

// POST /api/auth/register  { name, phone }
router.post("/register", asyncHandler(async (req, res) => {
  const { name, phone } = req.body || {};
  if (!name || !phone) return res.status(400).json({ error: "name and phone are required." });

  const code = genCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  await pool.query(
    `INSERT INTO otp_codes (phone, code, expires_at) VALUES ($1, $2, $3)
     ON CONFLICT (phone) DO UPDATE SET code = $2, expires_at = $3`,
    [phone, code, expiresAt]
  );

  // TODO: send code via a real SMS provider (e.g. Africa's Talking, Twilio).
  // devCode is only included outside production so it cannot leak to real users.
  const response = { message: "Verification code issued.", pendingName: name };
  if (process.env.NODE_ENV !== "production") {
    response.devCode = code;
  }
  res.json(response);
}));

// POST /api/auth/verify  { name, phone, code }
router.post("/verify", asyncHandler(async (req, res) => {
  const { name, phone, code } = req.body || {};
  if (!phone || !code) return res.status(400).json({ error: "phone and code are required." });

  const otpRes = await pool.query("SELECT * FROM otp_codes WHERE phone = $1", [phone]);
  const otp = otpRes.rows[0];
  if (!otp || otp.code !== code) return res.status(401).json({ error: "Incorrect code." });
  if (new Date(otp.expires_at) < new Date()) return res.status(401).json({ error: "Code expired — request a new one." });

  await pool.query("DELETE FROM otp_codes WHERE phone = $1", [phone]);

  let userRes = await pool.query("SELECT * FROM users WHERE phone = $1", [phone]);
  let user = userRes.rows[0];
  if (!user) {
    const insertRes = await pool.query(
      "INSERT INTO users (name, phone) VALUES ($1, $2) RETURNING *",
      [name || "Attendee", phone]
    );
    user = insertRes.rows[0];
  }

  const token = signToken(user);
  res.json({ token, user: { id: user.id, name: user.name, phone: user.phone } });
}));

module.exports = router;
