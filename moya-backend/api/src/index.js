const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const eventRoutes = require("./routes/events");
const orderRoutes = require("./routes/orders");
const paymentRoutes = require("./routes/payments");
const ticketRoutes = require("./routes/tickets");

const app = express();

// Security headers (X-Frame-Options, CSP, HSTS, etc.)
app.use(helmet());

// Restrict CORS to the configured origin in production; allow all in dev.
app.use(cors({
  origin: process.env.CORS_ORIGIN || (process.env.NODE_ENV !== "production" ? "*" : false),
}));

app.use(express.json());

// Structured logs in production, human-readable in dev.
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Throttle auth endpoints: limits OTP spam and brute-force attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please try again later." },
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/tickets", ticketRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Moya API listening on port ${PORT}`));
