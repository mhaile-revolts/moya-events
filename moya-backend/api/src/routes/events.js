const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const requireOrganizer = require("../middleware/requireOrganizer");
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
// Supports optional ?page and ?limit query params.
// When neither is provided, returns a flat array for backward compatibility.
// When either is provided, returns { events, total, page, limit }.
router.get("/", asyncHandler(async (req, res) => {
  const paginate = req.query.page !== undefined || req.query.limit !== undefined;
  const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  if (paginate) {
    const countRes = await pool.query("SELECT COUNT(*) AS total FROM events");
    const total    = parseInt(countRes.rows[0].total, 10);
    const result   = await pool.query("SELECT * FROM events ORDER BY id LIMIT $1 OFFSET $2", [limit, offset]);
    const events   = await attachTicketTypes(result.rows);
    return res.json({ events, total, page, limit });
  }

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

// POST /api/events  (organizer creates an event with one default ticket type)
router.post("/", requireAuth, requireOrganizer, asyncHandler(async (req, res) => {
  const { title, category, dateLabel, timeLabel, venue, city, description, price, capacity, image_url, event_start } = req.body || {};
  if (!title || !category) return res.status(400).json({ error: "title and category are required." });

  const eventRes = await pool.query(
    `INSERT INTO events (title, category, date_label, time_label, venue, city, description, image_url, event_start, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [title, category, dateLabel || "TBD", timeLabel || "TBD", venue || "TBD", city || "Kigali", description || "",
     image_url || null, event_start || null, req.user.id]
  );
  const event = eventRes.rows[0];

  await pool.query(
    `INSERT INTO ticket_types (event_id, name, price, capacity) VALUES ($1, 'General Admission', $2, $3)`,
    [event.id, Number(price) || 0, Number(capacity) || 50]
  );

  const [full] = await attachTicketTypes([event]);
  res.status(201).json(full);
}));

// POST /api/events/:id/ticket-types  — add a ticket type to an existing event
router.post("/:id/ticket-types", requireAuth, requireOrganizer, asyncHandler(async (req, res) => {
  const { name, price, capacity, hasSeatMap } = req.body || {};
  if (!name || capacity === undefined) {
    return res.status(400).json({ error: "name and capacity are required." });
  }

  // Verify the event exists.
  const eventRes = await pool.query("SELECT id FROM events WHERE id = $1", [req.params.id]);
  if (eventRes.rows.length === 0) return res.status(404).json({ error: "Event not found." });

  const result = await pool.query(
    `INSERT INTO ticket_types (event_id, name, price, capacity, has_seat_map)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.params.id, name, Number(price) || 0, Number(capacity), !!hasSeatMap]
  );
  const tt = result.rows[0];
  res.status(201).json({
    id:          tt.id,
    name:        tt.name,
    price:       tt.price,
    capacity:    tt.capacity,
    sold:        tt.sold,
    available:   tt.capacity - tt.sold,
    hasSeatMap:  tt.has_seat_map,
  });
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
