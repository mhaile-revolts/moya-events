const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const { initiatePayment, verifyPayment } = require("../services/payment");
const asyncHandler = require("../middleware/asyncHandler");

const router = express.Router();

// POST /api/payments/initiate — start a Flutterwave payment for an existing order
router.post("/initiate", requireAuth, asyncHandler(async (req, res) => {
  const { orderId } = req.body || {};
  if (!orderId) return res.status(400).json({ error: "orderId is required." });

  // Fetch the order — must belong to the requesting user and be pending payment.
  const orderRes = await pool.query(
    "SELECT o.*, u.name AS user_name, u.phone AS user_phone FROM orders o JOIN users u ON u.id = o.user_id WHERE o.id = $1",
    [orderId]
  );
  const order = orderRes.rows[0];
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (order.user_id !== req.user.id) return res.status(403).json({ error: "Not your order." });
  if (order.status !== "pending_payment") {
    return res.status(409).json({ error: `Order is not pending payment (status: ${order.status}).` });
  }

  // Fetch the event for display metadata.
  const eventRes = await pool.query("SELECT * FROM events WHERE id = $1", [order.event_id]);
  const event = eventRes.rows[0];
  if (!event) return res.status(404).json({ error: "Associated event not found." });

  const txRef = `MOYA-${orderId}-${Date.now()}`;
  const redirectUrl = (process.env.APP_BASE_URL || "http://localhost:3000") + "/payment-return";

  const { paymentLink } = await initiatePayment({
    orderId:       order.id,
    amount:        order.total,
    customerEmail: `user${order.user_id}@moya.rw`,  // phone-only users have no email
    customerName:  order.user_name,
    customerPhone: order.user_phone,
    txRef,
    redirectUrl,
  });

  // Persist the txRef so we can look up the order on webhook.
  await pool.query("UPDATE orders SET tx_ref = $1 WHERE id = $2", [txRef, orderId]);

  res.json({ paymentLink, txRef });
}));

// POST /api/payments/webhook — Flutterwave posts here after payment completes
// No JWT — this is called by Flutterwave's servers.
router.post("/webhook", asyncHandler(async (req, res) => {
  const webhookHash = process.env.FLW_WEBHOOK_HASH;
  if (webhookHash) {
    const provided = req.headers["verif-hash"];
    if (provided !== webhookHash) {
      return res.status(401).json({ error: "Invalid webhook signature." });
    }
  }

  const txRef = req.body && req.body.data && req.body.data.tx_ref;
  const flwTxId = req.body && req.body.data && req.body.data.id;

  if (!txRef || !flwTxId) {
    return res.status(400).json({ error: "Missing tx_ref or transaction id in webhook payload." });
  }

  // Find the order by txRef.
  const orderRes = await pool.query("SELECT * FROM orders WHERE tx_ref = $1", [txRef]);
  const order = orderRes.rows[0];
  if (!order) {
    // Unknown reference — acknowledge so Flutterwave doesn't keep retrying.
    return res.json({ status: "ok", note: "unknown tx_ref" });
  }

  // Verify the transaction with Flutterwave.
  let verification;
  try {
    verification = await verifyPayment(flwTxId);
  } catch (err) {
    console.error("[webhook] verifyPayment failed:", err.message);
    return res.status(502).json({ error: "Payment verification failed." });
  }

  if (verification.status === "successful") {
    await pool.query(
      "UPDATE orders SET status = 'confirmed' WHERE tx_ref = $1",
      [txRef]
    );
  }

  res.json({ status: "ok" });
}));

module.exports = router;
