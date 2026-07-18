const path = require("path");
const fs = require("fs");
const { PKPass } = require("passkit-generator");

const CERT_DIR = path.join(__dirname, "../../certs/apple");
const MODEL_DIR = path.join(__dirname, "../../pass-models/event.pass");

function certsConfigured() {
  return (
    fs.existsSync(path.join(CERT_DIR, "wwdr.pem")) &&
    fs.existsSync(path.join(CERT_DIR, "signerCert.pem")) &&
    fs.existsSync(path.join(CERT_DIR, "signerKey.pem"))
  );
}

// Load cert files once at module startup rather than on every request.
let _certs = null;
function loadCerts() {
  if (!_certs) {
    _certs = {
      wwdr: fs.readFileSync(path.join(CERT_DIR, "wwdr.pem")),
      signerCert: fs.readFileSync(path.join(CERT_DIR, "signerCert.pem")),
      signerKey: fs.readFileSync(path.join(CERT_DIR, "signerKey.pem")),
    };
  }
  return _certs;
}

/**
 * Builds a signed .pkpass buffer for one ticket.
 *
 * Requires, in api/certs/apple/:
 *   - wwdr.pem        Apple's Worldwide Developer Relations intermediate certificate
 *   - signerCert.pem  Your Pass Type ID certificate (exported from Keychain as .pem)
 *   - signerKey.pem   The private key for that certificate (.pem, may be password protected)
 *
 * See api/certs/apple/README.md for exactly how to obtain and export these
 * from your Apple Developer account — this is the one step that has to
 * happen outside of code, since it requires your own enrolled account.
 */
async function generateApplePass({ ticket, event }) {
  if (!certsConfigured()) {
    const err = new Error(
      "Apple Wallet isn't configured yet — add wwdr.pem, signerCert.pem, and signerKey.pem to api/certs/apple/ (see the README in that folder)."
    );
    err.status = 501;
    throw err;
  }

  const certs = loadCerts();
  const pass = await PKPass.from(
    {
      model: MODEL_DIR,
      certificates: {
        ...certs,
        signerKeyPassphrase: process.env.APPLE_PASS_KEY_PASSPHRASE || undefined,
      },
    },
    {
      serialNumber: ticket.ticket_number,
      description: `${event.title} ticket`,
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || "pass.com.example.moya",
      teamIdentifier: process.env.APPLE_TEAM_ID || "REPLACE_WITH_YOUR_TEAM_ID",
    }
  );

  pass.primaryFields.push({ key: "event", label: "EVENT", value: event.title });
  pass.secondaryFields.push(
    { key: "date", label: "DATE", value: `${event.date_label} · ${event.time_label}` },
    { key: "venue", label: "VENUE", value: `${event.venue}, ${event.city}` }
  );
  pass.auxiliaryFields.push(
    { key: "ticketType", label: "TICKET", value: ticket.ticket_type_name || "General Admission" },
    { key: "seat", label: "SEAT", value: ticket.seat_code || "—" }
  );
  pass.setBarcodes({
    message: ticket.ticket_number,
    format: "PKBarcodeFormatQR",
    messageEncoding: "iso-8859-1",
  });

  return pass.getAsBuffer();
}

module.exports = { generateApplePass, certsConfigured };
