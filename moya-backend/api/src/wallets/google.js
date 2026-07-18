const fs = require("fs");
const path = require("path");
const jwt = require("jsonwebtoken");

const KEY_PATH = path.join(__dirname, "../../certs/google/service-account.json");

function serviceAccountConfigured() {
  return fs.existsSync(KEY_PATH);
}

// Cache the parsed service account key after the first read.
let _serviceAccount = null;
function loadServiceAccount() {
  if (!_serviceAccount) {
    _serviceAccount = JSON.parse(fs.readFileSync(KEY_PATH, "utf8"));
  }
  return _serviceAccount;
}

/**
 * Builds an "Add to Google Wallet" link for one ticket.
 *
 * Requires:
 *   - A Google Wallet Issuer account (apply at https://pay.google.com/business/console —
 *     approval isn't instant, budget a few days)
 *   - An Event Ticket class created once under your issuer ID (see
 *     scripts/create-google-wallet-class.js in this project — run that one
 *     time after your issuer account is approved)
 *   - A service account JSON key with Wallet Object Issuer permission,
 *     saved to api/certs/google/service-account.json
 *
 * See api/certs/google/README.md for the full one-time setup — same idea
 * as Apple, this part has to happen in your own Google Cloud/Wallet console.
 */
function buildGoogleWalletLink({ ticket, event }) {
  if (!serviceAccountConfigured()) {
    const err = new Error(
      "Google Wallet isn't configured yet — add your service account key to api/certs/google/service-account.json (see the README in that folder)."
    );
    err.status = 501;
    throw err;
  }

  const serviceAccount = loadServiceAccount();
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const classSuffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX || "moya_event_ticket";
  if (!issuerId) {
    const err = new Error("GOOGLE_WALLET_ISSUER_ID is not set in the environment.");
    err.status = 501;
    throw err;
  }

  const objectId = `${issuerId}.${ticket.ticket_number.replace(/[^A-Za-z0-9_-]/g, "")}`;

  const eventTicketObject = {
    id: objectId,
    classId: `${issuerId}.${classSuffix}`,
    state: "ACTIVE",
    ticketHolderName: ticket.holder_name || undefined,
    ticketNumber: ticket.ticket_number,
    seatInfo: ticket.seat_code
      ? { seat: { defaultValue: { language: "en-US", value: ticket.seat_code } } }
      : undefined,
    barcode: { type: "QR_CODE", value: ticket.ticket_number },
  };

  const claims = {
    iss: serviceAccount.client_email,
    aud: "google",
    typ: "savetowallet",
    iat: Math.floor(Date.now() / 1000),
    payload: { eventTicketObjects: [eventTicketObject] },
  };

  const token = jwt.sign(claims, serviceAccount.private_key, { algorithm: "RS256" });
  return `https://pay.google.com/gp/v/save/${token}`;
}

module.exports = { buildGoogleWalletLink, serviceAccountConfigured };
