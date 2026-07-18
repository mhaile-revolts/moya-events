/**
 * Run this ONCE, after your Google Wallet Issuer account is approved and
 * you have a service account key saved at certs/google/service-account.json.
 * It creates (or updates) the EventTicketClass that every ticket "object"
 * (the actual pass a specific attendee gets) will reference.
 *
 * Usage:
 *   GOOGLE_WALLET_ISSUER_ID=your_issuer_id node scripts/create-google-wallet-class.js
 */
const fs = require("fs");
const path = require("path");
const { GoogleAuth } = require("google-auth-library");

const KEY_PATH = path.join(__dirname, "../certs/google/service-account.json");

async function main() {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const classSuffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX || "moya_event_ticket";
  if (!issuerId) {
    console.error("Set GOOGLE_WALLET_ISSUER_ID before running this script.");
    process.exit(1);
  }
  if (!fs.existsSync(KEY_PATH)) {
    console.error(`Missing ${KEY_PATH} — add your service account key first.`);
    process.exit(1);
  }

  const auth = new GoogleAuth({
    keyFile: KEY_PATH,
    scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
  });
  const client = await auth.getClient();

  const classId = `${issuerId}.${classSuffix}`;
  const eventTicketClass = {
    id: classId,
    issuerName: "Moya",
    reviewStatus: "UNDER_REVIEW", // Google reviews new classes before they go live publicly
    eventName: { defaultValue: { language: "en-US", value: "Moya Event" } },
  };

  const url = `https://walletobjects.googleapis.com/walletobjects/v1/eventTicketClass/${classId}`;

  // Try to update first; if it doesn't exist yet, create it.
  try {
    await client.request({ url, method: "PUT", data: eventTicketClass });
    console.log(`Updated existing class: ${classId}`);
  } catch (e) {
    if (e.response && e.response.status === 404) {
      await client.request({
        url: "https://walletobjects.googleapis.com/walletobjects/v1/eventTicketClass",
        method: "POST",
        data: eventTicketClass,
      });
      console.log(`Created new class: ${classId}`);
    } else {
      console.error("Failed to create/update class:", e.response ? e.response.data : e.message);
      process.exit(1);
    }
  }
}

main();
