const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

async function attachTicketTypes(events) {
  const ids = events.map((e) => e.id);
  if (ids.length === 0) return events;
  const ttRes = await pool.query(
    "SELECT * FROM ticket_types WHERE event_id = ANY($1) ORDER BY id",
    [ids]
  );
  const byEvent = {};
  ttRes.rows.forEach((tt) => {
    (byEvent[tt.event_id] ||= []).push({
      id: tt.id,
      name: tt.name,
      price: tt.price,
      capacity: tt.capacity,
      sold: tt.sold,
      available: tt.capacity - tt.sold,
      hasSeatMap: tt.has_seat_map,
    });
  });
  return events.map((e) => ({ ...e, ticketTypes: byEvent[e.id] || [] }));
}

// GET /api/events
router.get("/", asyncHandler(async (req, res) => {
  const result = await pool.query("SELECT * FROM events ORDER BY id");
  const events = await attachTicketTypes(result.rows);
  res.json(events);
}));

// GET /api/events/:id
router.get("/:id", asyncHandler(async (req, res) => {
  const result = await pool.query("SELECT * FROM events WHERE id = $1", [req.params.id]);
  if (result.rows.length === 0) return res.status(404).json({ error: "Event not found." });
  const [event] = await attachTicketTypes(result.rows);

  // Attach seat status for any seat-mapped ticket types.
  for (const tt of event.ticketTypes) {
    if (tt.hasSeatMap) {
      const seatRes = await pool.query(
        "SELECT seat_code, status FROM seats WHERE ticket_type_id = $1 ORDER BY seat_code",
        [tt.id]
      );
      tt.seats = seatRes.rows;
    }
  }
  res.json(event);
}));

// POST /api/events  (organizer creates an event with one ticket type)
router.post("/", requireAuth, asyncHandler(async (req, res) => {
  const { title, category, dateLabel, timeLabel, venue, city, description, price, capacity } = req.body || {};
  if (!title || !category) return res.status(400).json({ error: "title and category are required." });

  const eventRes = await pool.query(
    `INSERT INTO events (title, category, date_label, time_label, venue, city, description, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [title, category, dateLabel || "TBD", timeLabel || "TBD", venue || "TBD", city || "Kigali", description || "", req.user.id]
  );
  const event = eventRes.rows[0];

  await pool.query(
    `INSERT INTO ticket_types (event_id, name, price, capacity) VALUES ($1, 'General Admission', $2, $3)`,
    [event.id, Number(price) || 0, Number(capacity) || 50]
  );

  const [full] = await attachTicketTypes([event]);
  res.status(201).json(full);
}));

// GET /api/events/:id/reviews
router.get("/:id/reviews", asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT r.id, r.rating, r.comment, r.created_at, r.user_id, u.name
     FROM reviews r JOIN users u ON u.id = r.user_id
     WHERE r.event_id = $1 ORDER BY r.created_at DESC`,
    [req.params.id]
  );
  res.json(result.rows);
}));

// POST /api/events/:id/reviews  { rating, comment }  — requires a ticket for this event
router.post("/:id/reviews", requireAuth, asyncHandler(async (req, res) => {
  const { rating, comment } = req.body || {};
  if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: "rating must be 1-5." });

  const ownsTicket = await pool.query(
    `SELECT 1 FROM orders WHERE event_id = $1 AND user_id = $2 LIMIT 1`,
    [req.params.id, req.user.id]
  );
  if (ownsTicket.rows.length === 0) {
    return res.status(403).json({ error: "Only attendees with a ticket for this event can review it." });
  }

  const result = await pool.query(
    `INSERT INTO reviews (event_id, user_id, rating, comment) VALUES ($1,$2,$3,$4)
     ON CONFLICT (event_id, user_id) DO UPDATE SET rating = $3, comment = $4
     RETURNING *`,
    [req.params.id, req.user.id, rating, comment || null]
  );
  res.status(201).json(result.rows[0]);
}));

module.exports = router;
