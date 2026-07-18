# Moya Events Platform — Local Backend

A real Express + PostgreSQL backend for the Moya prototype, runnable
locally with Docker. This replaces the browser-storage layer from the
frontend prototype with an actual database and actual transactions —
in particular, it closes the race-condition gap that the frontend
version had to flag as an honest limitation (two people buying the
last seat/ticket at the same instant).

## Requirements

- Docker Desktop (or Docker Engine + Compose) installed on your machine
- Nothing else — Postgres and the API both run in containers

## Run it

```bash
cd moya-backend
docker compose up --build
```

First run will take a minute to build the API image and initialize the
database (schema + seed data from `db/init.sql`). Once it's up:

- API: http://localhost:4000/api/health → `{"ok":true}`
- Adminer (DB browser): http://localhost:8080 — system: PostgreSQL, server: `db`, user: `moya`, password: `moya`, database: `moya`

Stop it with `Ctrl+C`, or `docker compose down` to remove containers
(add `-v` to also wipe the database volume and start fresh next time).

## Try it end to end

```bash
# 1. Register (returns a dev-mode OTP code directly — see routes/auth.js)
curl -s -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Aline Uwase","phone":"0780000001"}'
# -> {"devCode":"4821", ...}

# 2. Verify with that code to get a JWT
curl -s -X POST http://localhost:4000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"name":"Aline Uwase","phone":"0780000001","code":"4821"}'
# -> {"token":"eyJ...", "user": {...}}

TOKEN="paste the token here"

# 3. Browse events
curl -s http://localhost:4000/api/events | jq

# 4. Buy a General Admission ticket for event 1
curl -s -X POST http://localhost:4000/api/orders/reserve \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"ticketTypeId": 1, "qty": 2, "paymentMethod": "momo"}'

# 5. See your tickets
curl -s http://localhost:4000/api/tickets/me -H "Authorization: Bearer $TOKEN" | jq

# 6. Gate check-in (try it twice — the second call reports "duplicate")
curl -s -X POST http://localhost:4000/api/tickets/MOYA-EV1-1234/checkin
curl -s -X POST http://localhost:4000/api/tickets/MOYA-EV1-1234/checkin

# 7. Leave a review (only works if this user has a ticket for event 1)
curl -s -X POST http://localhost:4000/api/events/1/reviews \
  -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
  -d '{"rating": 5, "comment": "Great night!"}'
```

## Prove the flash-sale fix actually works

Ticket type 4 ("Startup Pitch Slot") has only 3 seats. Fire several
concurrent requests at it and confirm the sold count never exceeds
capacity — no overselling, even under real concurrency:

```bash
for i in 1 2 3 4 5 6 7 8; do
  curl -s -X POST http://localhost:4000/api/orders/reserve \
    -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" \
    -d '{"ticketTypeId": 4, "qty": 1, "paymentMethod": "momo"}' &
done
wait
```

You should see exactly 3 succeed (`201`) and the rest fail with
`409 {"error":"Sold out.","code":"sold_out"}` — that's the
`SELECT ... FOR UPDATE` row lock in `src/routes/orders.js` doing its
job. The equivalent test against the frontend-only prototype's
key-value storage could not make this guarantee.

## Add to Apple Wallet / Google Wallet

Real integration code is included (`src/wallets/apple.js`, `src/wallets/google.js`,
`GET /api/tickets/:ticketNumber/apple-pass`, `GET /api/tickets/:ticketNumber/google-wallet-link`),
but both require credentials from your own developer accounts that can't be
generated in code — full one-time setup instructions are in:

- `api/certs/apple/README.md` (Apple Developer Program enrollment, Pass Type ID, certificate export)
- `api/certs/google/README.md` (Google Wallet Issuer approval, service account key)

Until those are in place, both endpoints return a clear `501` explaining
exactly what's missing, rather than failing silently. The certs/pass-models
folders are mounted as volumes, so dropping in real files doesn't require
rebuilding the API image — just restart the `api` container.

## What's real here vs. what's still missing for production

**Real:**
- Actual relational schema (users, events, ticket_types, seats, orders, tickets, reviews)
- Actual atomic seat/ticket reservation via database transactions + row locks
- Actual duplicate check-in detection
- JWT-based sessions

**Still stubbed / still needed before this is production-grade:**
- OTP codes are returned in the API response instead of sent by SMS — wire in a real provider (Africa's Talking, Twilio) and stop returning the code
- No real payment gateway integration (MTN MoMo, Stripe, etc.) — `paymentMethod` is just a label stored on the order
- No HTTPS/TLS termination — add a reverse proxy (nginx/Caddy) or a managed load balancer in front of this for anything beyond local dev
- No rate limiting, no request validation library (just manual checks) — add something like `zod` for input validation and `express-rate-limit` before exposing this publicly
- No automated migrations — `db/init.sql` only runs once against an empty volume; add a migration tool (e.g. `node-pg-migrate`) before making schema changes over time
- No tests — add integration tests for the reservation endpoint especially, since that's the correctness-critical path

## Project layout

```
moya-backend/
├── docker-compose.yml
├── db/
│   └── init.sql          # schema + seed data, runs once on first container start
└── api/
    ├── Dockerfile
    ├── package.json
    └── src/
        ├── index.js       # Express app + route mounting
        ├── db.js          # pg pool + transaction helper
        ├── middleware/auth.js
        └── routes/
            ├── auth.js     # register / verify (OTP)
            ├── events.js   # list/detail/create + reviews
            ├── orders.js   # the transactional reservation endpoint
            └── tickets.js  # my tickets + gate check-in
```
