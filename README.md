# Moya Events

An event ticketing platform built for the Kigali market. Includes a real Express/PostgreSQL backend with atomic ticket reservation, phone-based OTP authentication, Apple Wallet and Google Wallet integration, and a single-file React frontend prototype.

## Repository layout

```
moya-events/
├── moya-backend/               # The actual backend
│   ├── docker-compose.yml      # Postgres + API + Adminer
│   ├── db/
│   │   └── init.sql            # Schema + seed data (runs on first start)
│   └── api/
│       ├── Dockerfile
│       ├── package.json
│       ├── certs/
│       │   ├── apple/          # Drop wwdr.pem, signerCert.pem, signerKey.pem here
│       │   └── google/         # Drop service-account.json here
│       ├── pass-models/
│       │   └── event.pass/     # Apple Wallet pass template + branding images
│       └── src/
│           ├── index.js        # Express app entry point
│           ├── db.js           # pg pool + withTransaction helper
│           ├── middleware/
│           │   ├── auth.js     # JWT verification, requireCheckinAuth
│           │   └── asyncHandler.js
│           ├── routes/
│           │   ├── auth.js     # Phone OTP registration + verification
│           │   ├── events.js   # Event CRUD + reviews
│           │   ├── orders.js   # Atomic ticket reservation
│           │   └── tickets.js  # My tickets, gate check-in, wallet passes
│           └── wallets/
│               ├── apple.js
│               └── google.js
└── moya-events-prototype-v4.jsx  # React frontend prototype
```

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (or Docker Engine + Compose plugin)
- That's it — Postgres and the API both run in containers

## Quick start

```bash
git clone git@github.com:mhaile-revolts/moya-events.git
cd moya-events/moya-backend
docker compose up --build
```

First run takes about a minute to build the image and seed the database. Once running:

| Service | URL |
|---|---|
| API | http://localhost:4000/api/health |
| Adminer (DB browser) | http://localhost:8080 |

**Adminer login:** system `PostgreSQL` · server `db` · user `moya` · password `moya` · database `moya`

Stop with `Ctrl+C`, or `docker compose down` (add `-v` to also wipe the database volume and start fresh).

---

## Authentication flow

Moya uses **phone-based OTP authentication** — no passwords. The flow has two steps: register (request a code) and verify (confirm the code to receive a JWT).

### 1 · Register — request a one-time code

```
POST /api/auth/register
Content-Type: application/json

{ "name": "Aline Uwase", "phone": "0780000001" }
```

The server generates a cryptographically secure 6-digit code (`crypto.randomInt`), stores it in the `otp_codes` table with a 5-minute expiry, and — in a real deployment — sends it by SMS. In development, the code is also returned in the response as `devCode` so you can test without an SMS provider:

```json
{
  "message": "Verification code issued.",
  "pendingName": "Aline Uwase",
  "devCode": "847321"
}
```

> **Before going live:** wire in a real SMS provider ([Africa's Talking](https://africastalking.com) or [Twilio](https://twilio.com)) in `api/src/routes/auth.js` and remove the `devCode` field. The field is already suppressed when `NODE_ENV=production`.

**Rate limiting:** `/api/auth/*` is limited to **10 requests per 15 minutes** per IP (via `express-rate-limit`) to prevent OTP spam and brute-force attempts.

### 2 · Verify — confirm the code, receive a JWT

```
POST /api/auth/verify
Content-Type: application/json

{ "name": "Aline Uwase", "phone": "0780000001", "code": "847321" }
```

The server checks the code against the stored record and its expiry. On success:
- The OTP row is deleted (codes are single-use)
- A user row is created or retrieved
- A signed JWT is issued (30-day expiry)

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": { "id": 1, "name": "Aline Uwase", "phone": "0780000001" }
}
```

### 3 · Authenticated requests

Include the JWT as a Bearer token on any protected endpoint:

```bash
curl -H "Authorization: Bearer $TOKEN" http://localhost:4000/api/tickets/me
```

**JWT payload:**

```json
{ "id": 1, "name": "Aline Uwase", "phone": "0780000001", "iat": ..., "exp": ... }
```

The secret is set via `JWT_SECRET` in the environment. The server will refuse to start if `NODE_ENV=production` and `JWT_SECRET` is still the default placeholder value.

### Gate scanner authentication

The check-in endpoint (`POST /api/tickets/:ticketNumber/checkin`) uses a separate middleware — `requireCheckinAuth` — that accepts **either** of:

| Method | Header | When to use |
|---|---|---|
| Bearer JWT | `Authorization: Bearer <token>` | Organiser apps, manual testing |
| Scanner key | `X-Scanner-Key: <SCANNER_API_KEY>` | Dedicated scanner devices |

If `SCANNER_API_KEY` is not set in the environment, only JWT is accepted. A request with no valid credential returns `401`.

---

## Key API endpoints

### Auth
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Request OTP for a phone number |
| `POST` | `/api/auth/verify` | — | Verify OTP, receive JWT |

### Events
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/events` | — | List all events with ticket types |
| `GET` | `/api/events/:id` | — | Event detail including seat map |
| `POST` | `/api/events` | JWT | Create an event |
| `GET` | `/api/events/:id/reviews` | — | Event reviews |
| `POST` | `/api/events/:id/reviews` | JWT | Submit a review (requires ticket) |

### Orders
| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/orders/reserve` | JWT | Reserve tickets (atomic, concurrency-safe) |

**Request body:**
```json
{
  "ticketTypeId": 1,
  "qty": 2,
  "seatCodes": ["A1", "A2"],
  "paymentMethod": "momo"
}
```
`seatCodes` is required only for reserved-seating ticket types.

### Tickets
| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/tickets/me` | JWT | All tickets for the current user |
| `POST` | `/api/tickets/:ticketNumber/checkin` | JWT or Scanner key | Gate check-in |
| `GET` | `/api/tickets/:ticketNumber/apple-pass` | JWT | Download signed `.pkpass` |
| `GET` | `/api/tickets/:ticketNumber/google-wallet-link` | JWT | Get Add-to-Wallet URL |

---

## Concurrency model

The reservation endpoint uses PostgreSQL row-level locking to prevent overselling under concurrent load:

```sql
SELECT * FROM ticket_types WHERE id = $1 FOR UPDATE
```

This blocks any other transaction trying to reserve from the same ticket type until the current one commits or rolls back. The availability check and the inventory update happen atomically inside the same transaction — there is no window between "check" and "write" where a race can occur.

To verify this, fire several concurrent requests at a low-capacity ticket type:

```bash
for i in 1 2 3 4 5 6 7 8; do
  curl -s -X POST http://localhost:4000/api/orders/reserve \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"ticketTypeId": 4, "qty": 1, "paymentMethod": "momo"}' &
done
wait
```

Exactly as many requests will succeed as there are seats remaining; the rest get `409 {"error":"Sold out.","code":"sold_out"}`.

---

## Environment variables

Set in `docker-compose.yml` for local dev. Override on your deployment host for production.

| Variable | Default | Required in prod | Description |
|---|---|---|---|
| `DATABASE_URL` | `postgres://moya:moya@db:5432/moya` | Yes | Postgres connection string |
| `JWT_SECRET` | `dev-secret-change-me` | **Yes — server will refuse to start if unchanged** | JWT signing secret |
| `PORT` | `4000` | No | API listen port |
| `NODE_ENV` | *(unset)* | Yes (`production`) | Controls devCode visibility, morgan format, CORS |
| `CORS_ORIGIN` | `*` (non-prod) / `false` (prod) | Yes | Allowed frontend origin, e.g. `https://app.moya.rw` |
| `SCANNER_API_KEY` | *(unset)* | Recommended | API key for gate-scanner devices (falls back to JWT if unset) |
| `APPLE_PASS_TYPE_ID` | `pass.com.example.moya` | For Apple Wallet | Your Pass Type ID |
| `APPLE_TEAM_ID` | `REPLACE_WITH_YOUR_TEAM_ID` | For Apple Wallet | Your 10-character Apple Team ID |
| `APPLE_PASS_KEY_PASSPHRASE` | *(empty)* | For Apple Wallet | Passphrase for `signerKey.pem` |
| `GOOGLE_WALLET_ISSUER_ID` | *(empty)* | For Google Wallet | Numeric issuer ID from Google Wallet console |
| `GOOGLE_WALLET_CLASS_SUFFIX` | `moya_event_ticket` | For Google Wallet | Class suffix registered via the setup script |

---

## Wallet setup

Both wallet integrations require a one-time setup in your own developer accounts. Full step-by-step instructions are in the relevant READMEs:

- **Apple Wallet** — `moya-backend/api/certs/apple/README.md`
- **Google Wallet** — `moya-backend/api/certs/google/README.md`

Until credentials are in place, both endpoints return `501` with a clear explanation of what's missing rather than failing silently.

---

## Frontend prototype

`moya-events-prototype-v4.jsx` is a single-file React app (≈1,200 lines) designed to run as an artifact in the [Claude](https://claude.ai) environment. It connects to the local backend at `http://localhost:4000/api` via `fetch()` — as long as `docker compose up` is running, all API calls go straight to your local containers.

To use it, paste the file contents into a Claude artifact and make sure the backend is running.

---

## Production checklist

Before this goes anywhere near real users:

- [ ] Wire a real SMS provider (Africa's Talking, Twilio) into `api/src/routes/auth.js` and remove `devCode` from responses
- [ ] Set `NODE_ENV=production`, a strong `JWT_SECRET`, and `CORS_ORIGIN` on the deployment host
- [ ] Set `SCANNER_API_KEY` for physical gate-scanner devices
- [ ] Add HTTPS/TLS termination (nginx, Caddy, or a managed load balancer)
- [ ] Integrate a real payment gateway (MTN MoMo API, Stripe, etc.) — `paymentMethod` is currently just a label stored on the order
- [ ] Add a migration tool (e.g. `node-pg-migrate`) before making schema changes on a live database
- [ ] Add integration tests for the reservation endpoint (the concurrency-critical path)
- [ ] Add input validation library (e.g. `zod`) beyond the current ad-hoc checks
