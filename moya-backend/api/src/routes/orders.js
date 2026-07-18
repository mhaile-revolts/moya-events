const express = require("express");
const { randomBytes } = require("crypto");
const { pool, withTransaction } = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Collision-resistant ticket number using 4 random bytes (hex) per ticket.
// Replaces the previous Math.random() approach which had only 8,999 values
// per event and could collide under the UNIQUE constraint.
function genTicketNumber(eventId) {
  return `MOYA-EV${eventId}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

/**
 * POST /api/orders/reserve
 * body: { ticketTypeId, qty, seatCodes?, paymentMethod }
 *
 * This is the one endpoint in the whole system where correctness under
 * concurrency actually matters (Section 5.2/NFR-012 in the SRS — the
 * flash-sale / no-double-sell requirement). It's handled with:
 *   1. SELECT ... FOR UPDATE on the ticket_type row, which blocks any
 *      other transaction trying to reserve from the same ticket type
 *      until this one commits or rolls back.
 *   2. For seat-mapped types, the same FOR UPDATE lock on the specific
 *      seat rows being requested.
 *   3. A capacity check performed *after* acquiring the lock, so the
 *      check and the write are atomic together — no other request can
 *      slip in between "check" and "write" the way it could with the
 *      read-then-write approach in the frontend-only prototype.
 */
router.post("/reserve", requireAuth, async (req, res) => {
  const { ticketTypeId, qty, seatCodes, paymentMethod } = req.body || {};
  if (!ticketTypeId || !qty || qty < 1) {
    return res.status(400).json({ error: "ticketTypeId and a positive qty are required." });
  }

  try {
    const order = await withTransaction(async (client) => {
      const ttRes = await client.query(
        "SELECT * FROM ticket_types WHERE id = $1 FOR UPDATE",
        [ticketTypeId]
      );
      const tt = ttRes.rows[0];
      if (!tt) throw Object.assign(new Error("Ticket type not found."), { status: 404 });

      if (tt.has_seat_map) {
        if (!Array.isArray(seatCodes) || seatCodes.length !== qty) {
          throw Object.assign(new Error("seatCodes must be provided and match qty for reserved seating."), { status: 400 });
        }
        const seatRes = await client.query(
          `SELECT * FROM seats WHERE ticket_type_id = $1 AND seat_code = ANY($2) FOR UPDATE`,
          [ticketTypeId, seatCodes]
        );
        if (seatRes.rows.length !== seatCodes.length) {
          throw Object.assign(new Error("One or more seats don't exist."), { status: 400 });
        }
        const taken = seatRes.rows.filter((s) => s.status !== "available");
        if (taken.length > 0) {
          throw Object.assign(
            new Error(`Seat(s) ${taken.map((s) => s.seat_code).join(", ")} were just taken.`),
            { status: 409, code: "seats_taken" }
          );
        }
      }

      if (tt.capacity - tt.sold < qty) {
        throw Object.assign(new Error("Sold out."), { status: 409, code: "sold_out" });
      }

      await client.query("UPDATE ticket_types SET sold = sold + $1 WHERE id = $2", [qty, ticketTypeId]);

      if (tt.has_seat_map) {
        await client.query(
          `UPDATE seats SET status = 'sold' WHERE ticket_type_id = $1 AND seat_code = ANY($2)`,
          [ticketTypeId, seatCodes]
        );
      }

      const total = tt.price * qty;
      const orderRes = await client.query(
        `INSERT INTO orders (user_id, event_id, ticket_type_id, qty, total, payment_method)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.user.id, tt.event_id, ticketTypeId, qty, total, paymentMethod || "momo"]
      );
      const orderRow = orderRes.rows[0];

      const tickets = [];
      for (let i = 0; i < qty; i++) {
        const ticketNumber = genTicketNumber(tt.event_id);
        const seatCode = tt.has_seat_map ? seatCodes[i] : null;
        const ticketRes = await client.query(
          `INSERT INTO tickets (order_id, ticket_number, seat_code) VALUES ($1,$2,$3) RETURNING *`,
          [orderRow.id, ticketNumber, seatCode]
        );
        tickets.push(ticketRes.rows[0]);
      }

      return { order: orderRow, tickets };
    });

    res.status(201).json(order);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ error: err.message, code: err.code });
  }
});

module.exports = router;
