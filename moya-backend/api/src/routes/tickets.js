const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireCheckinAuth } = require("../middleware/auth");
const { generateApplePass } = require("../wallets/apple");
const { buildGoogleWalletLink } = require("../wallets/google");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

async function getFullTicket(ticketNumber) {
  const result = await pool.query(
    `SELECT t.ticket_number, t.seat_code, t.used, t.checked_in_at,
            o.user_id, o.qty,
            e.title, e.date_label, e.time_label, e.venue, e.city, e.accent, e.category,
            tt.name AS ticket_type_name
     FROM tickets t
     JOIN orders o ON o.id = t.order_id
     JOIN events e ON e.id = o.event_id
     JOIN ticket_types tt ON tt.id = o.ticket_type_id
     WHERE t.ticket_number = $1`,
    [ticketNumber]
  );
  return result.rows[0] || null;
}

// GET /api/tickets/me — confirmed tickets for the logged-in user
// Only orders with status = 'confirmed' are returned; pending-payment tickets are hidden.
// Supports optional ?page and ?limit pagination (same pattern as GET /api/events).
router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const paginate = req.query.page !== undefined || req.query.limit !== undefined;
  const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  const baseQuery = `
    SELECT t.ticket_number, t.seat_code, t.used, t.checked_in_at,
           o.qty, o.total, o.created_at AS purchased_at,
           e.id AS event_id, e.title AS event_title, e.date_label, e.time_label, e.venue, e.city, e.accent, e.category,
           tt.name AS ticket_type_name
    FROM tickets t
    JOIN orders o ON o.id = t.order_id
    JOIN events e ON e.id = o.event_id
    JOIN ticket_types tt ON tt.id = o.ticket_type_id
    WHERE o.user_id = $1 AND o.status = 'confirmed'
    ORDER BY o.created_at DESC`;

  if (paginate) {
    const countRes = await pool.query(
      `SELECT COUNT(*) AS total
       FROM tickets t
       JOIN orders o ON o.id = t.order_id
       WHERE o.user_id = $1 AND o.status = 'confirmed'`,
      [req.user.id]
    );
    const total  = parseInt(countRes.rows[0].total, 10);
    const result = await pool.query(baseQuery + " LIMIT $2 OFFSET $3", [req.user.id, limit, offset]);
    return res.json({ tickets: result.rows, total, page, limit });
  }

  const result = await pool.query(baseQuery, [req.user.id]);
  res.json(result.rows);
}));

// POST /api/tickets/:ticketNumber/checkin — gate scanner endpoint
// Real duplicate-scan detection (NFR-040): the UPDATE only flips
// used=false -> true once; a second scan of the same ticket_number
// finds used already true and is reported as a duplicate rather than
// silently succeeding again.
// requireCheckinAuth accepts an X-Scanner-Key header (for scanner devices)
// or a standard JWT bearer token (for organiser apps).
router.post("/:ticketNumber/checkin", requireCheckinAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM tickets WHERE ticket_number = $1",
    [req.params.ticketNumber]
  );
  const ticket = result.rows[0];
  if (!ticket) return res.status(404).json({ error: "Ticket not found." });

  if (ticket.used) {
    return res.status(409).json({
      error: "Ticket already used.",
      checkedInAt: ticket.checked_in_at,
      code: "duplicate",
    });
  }

  const updateRes = await pool.query(
    `UPDATE tickets SET used = true, checked_in_at = now()
     WHERE ticket_number = $1 AND used = false
     RETURNING *`,
    [req.params.ticketNumber]
  );

  if (updateRes.rows.length === 0) {
    // Someone else's check-in request won the race between our SELECT and UPDATE.
    return res.status(409).json({ error: "Ticket already used.", code: "duplicate" });
  }

  res.json({ ok: true, checkedInAt: updateRes.rows[0].checked_in_at });
}));
// GET /api/tickets/:ticketNumber/apple-pass — download a signed .pkpass
router.get("/:ticketNumber/apple-pass", requireAuth, asyncHandler(async (req, res) => {
  const row = await getFullTicket(req.params.ticketNumber);
  if (!row) return res.status(404).json({ error: "Ticket not found." });
  if (row.user_id !== req.user.id) return res.status(403).json({ error: "This isn't your ticket." });

  try {
    const buffer = await generateApplePass({
      ticket: row,
      event: row, // same joined row has both ticket + event fields
    });
    res.set("Content-Type", "application/vnd.apple.pkpass");
    res.set("Content-Disposition", `attachment; filename="${row.ticket_number}.pkpass"`);
    res.send(buffer);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}));
// GET /api/tickets/:ticketNumber/google-wallet-link — returns a save-to-wallet URL
router.get("/:ticketNumber/google-wallet-link", requireAuth, asyncHandler(async (req, res) => {
  const row = await getFullTicket(req.params.ticketNumber);
  if (!row) return res.status(404).json({ error: "Ticket not found." });
  if (row.user_id !== req.user.id) return res.status(403).json({ error: "This isn't your ticket." });

  try {
    const url = buildGoogleWalletLink({ ticket: row, event: row });
    res.json({ url });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}));

module.exports = router;
