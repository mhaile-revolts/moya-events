/**
 * Flutterwave payment service.
 *
 * Uses the built-in fetch available in Node 18+.
 * Requires FLW_SECRET_KEY to be set in the environment.
 */

function getSecretKey() {
  const key = process.env.FLW_SECRET_KEY;
  if (!key) {
    const err = new Error(
      "Flutterwave is not configured. Set the FLW_SECRET_KEY environment variable."
    );
    err.status = 501;
    throw err;
  }
  return key;
}

/**
 * Initiate a Flutterwave Standard payment (hosted payment page).
 *
 * @param {object} opts
 * @param {number|string} opts.orderId
 * @param {number}        opts.amount          — in the event's currency (smallest denomination OK for FLW)
 * @param {string}        opts.customerEmail
 * @param {string}        opts.customerName
 * @param {string}        opts.customerPhone
 * @param {string}        opts.txRef           — unique reference for this transaction
 * @param {string}        opts.redirectUrl     — where Flutterwave redirects after payment
 * @returns {Promise<{ paymentLink: string, txRef: string }>}
 */
async function initiatePayment({ orderId, amount, customerEmail, customerName, customerPhone, txRef, redirectUrl }) {
  const secretKey = getSecretKey();

  const payload = {
    tx_ref:       txRef,
    amount,
    currency:     "RWF",
    redirect_url: redirectUrl,
    customer: {
      email:       customerEmail || "noemail@moya.rw",
      name:        customerName  || "Moya Customer",
      phonenumber: customerPhone || "",
    },
    meta: { order_id: orderId },
    customizations: {
      title:       "Moya Events",
      description: "Ticket payment",
    },
  };

  const response = await fetch("https://api.flutterwave.com/v3/payments", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      Authorization:   `Bearer ${secretKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok || data.status !== "success") {
    const err = new Error(data.message || "Flutterwave initiate payment failed.");
    err.status = response.status || 502;
    throw err;
  }

  return { paymentLink: data.data.link, txRef };
}

/**
 * Verify a Flutterwave transaction by its numeric transaction ID.
 *
 * @param {number|string} transactionId — Flutterwave transaction ID (from webhook or redirect)
 * @returns {Promise<object>}           — the data object from the Flutterwave verify response
 */
async function verifyPayment(transactionId) {
  const secretKey = getSecretKey();

  const response = await fetch(
    `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    }
  );

  const data = await response.json();

  if (!response.ok || data.status !== "success") {
    const err = new Error(data.message || "Flutterwave verify payment failed.");
    err.status = response.status || 502;
    throw err;
  }

  return data.data;
}

module.exports = { initiatePayment, verifyPayment };
