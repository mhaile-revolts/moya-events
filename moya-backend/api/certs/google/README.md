# Google Wallet setup

Same idea as Apple — this is a one-time setup in your own Google account,
not something that can be done from code.

## 1. Apply for a Google Wallet Issuer account
https://pay.google.com/business/console → Google Wallet API → request
access. This requires approval from Google and isn't instant (can take a
few days). You'll be issued a numeric **Issuer ID** once approved.

## 2. Create a service account
In Google Cloud Console, for the same project linked to your Wallet
business account: **IAM & Admin → Service Accounts → Create**. Grant it
access, then in the Wallet Business Console, add that service account's
email under **Users** with Wallet Object Issuer permission.

## 3. Generate a JSON key for the service account
In the service account's page: **Keys → Add Key → Create new key → JSON**.
This downloads a `.json` file — save it as:

```
certs/google/service-account.json
```

Keep this file secret — it's a credential that can issue passes on your
behalf. It's already covered by this project's `.gitignore`-style handling
(don't commit it).

## 4. Set your issuer ID
In `docker-compose.yml`:
```yaml
GOOGLE_WALLET_ISSUER_ID: "1234567890123456789"   # from step 1
GOOGLE_WALLET_CLASS_SUFFIX: moya_event_ticket     # or whatever you'd like
```

## 5. Create the Event Ticket class (one time)
Once steps 1–4 are done:

```bash
cd api
npm install
GOOGLE_WALLET_ISSUER_ID=1234567890123456789 node scripts/create-google-wallet-class.js
```

This registers the "class" that every individual ticket references (think
of it like a template — the venue/branding-level info). You only need to
run this once, or again if you change the class definition later.

## Once all of the above is done
`GET /api/tickets/:ticketNumber/google-wallet-link` will return a real
`https://pay.google.com/gp/v/save/...` link. Until then, it returns a
clear `501` explaining what's missing.
