-- Migration 001 — MVP features
-- Apply to an existing Moya database to bring it up to the MVP schema.
-- Safe to run multiple times: all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.

-- users: add organizer role flag
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_organizer BOOLEAN NOT NULL DEFAULT false;

-- events: add image and structured start time
ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url   TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS event_start TIMESTAMPTZ;

-- orders: add payment status and Flutterwave transaction reference
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status  TEXT NOT NULL DEFAULT 'pending_payment';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS tx_ref  TEXT;

-- Backfill existing orders so they don't get stuck in pending_payment.
-- Orders created before this migration had no payment flow, so treat them as confirmed.
UPDATE orders SET status = 'confirmed' WHERE status = 'pending_payment' AND created_at < now();

-- payment_intents: track initiated Flutterwave payments
CREATE TABLE IF NOT EXISTS payment_intents (
  id         SERIAL PRIMARY KEY,
  order_id   INTEGER NOT NULL REFERENCES orders(id),
  tx_ref     TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index on orders.tx_ref for fast webhook lookups
CREATE INDEX IF NOT EXISTS idx_orders_tx_ref ON orders(tx_ref);
