-- Moya Events Platform — schema (runs automatically on first container start)

CREATE TABLE users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  phone         TEXT UNIQUE NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OTP codes are short-lived and stored server-side so verification
-- doesn't rely on the client to "remember" the code, unlike the
-- browser-only prototype. In production, swap the "return code in
-- the response" behavior in src/routes/auth.js for an actual SMS
-- provider (e.g. Africa's Talking, Twilio) and never return the code.
CREATE TABLE otp_codes (
  phone         TEXT PRIMARY KEY,
  code          TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE events (
  id            SERIAL PRIMARY KEY,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL,
  date_label    TEXT NOT NULL,
  time_label    TEXT NOT NULL,
  venue         TEXT NOT NULL,
  city          TEXT NOT NULL,
  accent        TEXT NOT NULL DEFAULT '#F5B942',
  description   TEXT NOT NULL DEFAULT '',
  created_by    INTEGER REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ticket_types (
  id            SERIAL PRIMARY KEY,
  event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  price         INTEGER NOT NULL DEFAULT 0,
  capacity      INTEGER NOT NULL,
  sold          INTEGER NOT NULL DEFAULT 0,
  has_seat_map  BOOLEAN NOT NULL DEFAULT false,
  CHECK (sold <= capacity)
);

-- Only populated for ticket_types where has_seat_map = true.
CREATE TABLE seats (
  id              SERIAL PRIMARY KEY,
  ticket_type_id  INTEGER NOT NULL REFERENCES ticket_types(id) ON DELETE CASCADE,
  seat_code       TEXT NOT NULL,          -- e.g. 'A4'
  status          TEXT NOT NULL DEFAULT 'available', -- available | sold
  UNIQUE (ticket_type_id, seat_code)
);

CREATE TABLE orders (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  event_id        INTEGER NOT NULL REFERENCES events(id),
  ticket_type_id  INTEGER NOT NULL REFERENCES ticket_types(id),
  qty             INTEGER NOT NULL,
  total           INTEGER NOT NULL,
  payment_method  TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tickets (
  id              SERIAL PRIMARY KEY,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ticket_number   TEXT UNIQUE NOT NULL,
  seat_code       TEXT,
  used            BOOLEAN NOT NULL DEFAULT false,
  checked_in_at   TIMESTAMPTZ
);

CREATE TABLE reviews (
  id            SERIAL PRIMARY KEY,
  event_id      INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)              -- one review per user per event
);

-- Indexes for common query patterns ------------------------------------
CREATE INDEX idx_orders_user_id     ON orders(user_id);
CREATE INDEX idx_orders_event_user  ON orders(event_id, user_id);
CREATE INDEX idx_ticket_types_event ON ticket_types(event_id);
CREATE INDEX idx_reviews_event_id   ON reviews(event_id);
CREATE INDEX idx_tickets_order_id   ON tickets(order_id);
CREATE INDEX idx_seats_ticket_type  ON seats(ticket_type_id);

-- Seed data -----------------------------------------------------------

INSERT INTO events (title, category, date_label, time_label, venue, city, accent, description) VALUES
('Kigali Nights: Afrobeat Live', 'Music', 'Sun, Jul 26, 2026', '8:00 PM', 'BK Arena', 'Kigali', '#FF6B5E',
  'An open-air night of live Afrobeat, headlined by three of the region''s rising acts.'),
('Founders & Funders Summit', 'Business', 'Mon, Aug 3, 2026', '9:00 AM', 'Norrsken House', 'Kigali', '#F5B942',
  'A day of closed-door investor roundtables and founder pitch sessions.'),
('Comedy Kraze Vol. 4', 'Comedy', 'Mon, Jul 20, 2026', '7:00 PM', 'Kigali Convention Centre', 'Kigali', '#F5B942',
  'Four stand-up comedians, one stage, zero filters.'),
('Sunday League Finals', 'Sports', 'Sun, Jul 27, 2026', '3:00 PM', 'Amahoro Stadium', 'Kigali', '#F5B942',
  'The city''s amateur league finale — two matches back to back.');

INSERT INTO ticket_types (event_id, name, price, capacity, sold, has_seat_map) VALUES
(1, 'General Admission', 15000, 12, 0, false),
(1, 'VIP (front stage + lounge)', 45000, 4, 0, false),
(2, 'Delegate Pass', 25000, 10, 0, false),
(2, 'Startup Pitch Slot', 40000, 3, 0, false),
(3, 'General Admission', 8000, 8, 0, false),
(3, 'Front Row', 18000, 2, 0, false),
(4, 'Terrace', 5000, 20, 0, false),
(4, 'Covered Seating', 12000, 32, 0, true);

-- Seed the seat map for the Covered Seating ticket type.
-- Uses a subquery instead of a hardcoded id so the seed is resilient to
-- id sequence changes on a fresh DB.
DO $$
DECLARE
  tt_id INTEGER;
  row_letter TEXT;
  seat_num INTEGER;
BEGIN
  SELECT tt.id INTO tt_id
  FROM ticket_types tt
  JOIN events e ON e.id = tt.event_id
  WHERE e.title = 'Sunday League Finals' AND tt.name = 'Covered Seating'
  LIMIT 1;

  FOREACH row_letter IN ARRAY ARRAY['A','B','C','D'] LOOP
    FOR seat_num IN 1..8 LOOP
      INSERT INTO seats (ticket_type_id, seat_code) VALUES (tt_id, row_letter || seat_num);
    END LOOP;
  END LOOP;
END $$;
