# Apple Wallet setup

This has to happen once, in your own Apple Developer account — nothing
here can be done from code alone.

## 1. Enroll in the Apple Developer Program
https://developer.apple.com/programs/ ($99/year, real identity verification required).

## 2. Create a Pass Type ID
In the Developer portal: **Certificates, Identifiers & Profiles → Identifiers → +**
→ choose "Pass Type IDs" → give it something like `pass.com.yourcompany.moya`.

## 3. Create a Pass Type ID Certificate
Still in the portal, under your new Pass Type ID → **Create Certificate**.
This walks you through generating a Certificate Signing Request (CSR) on
your Mac via Keychain Access, uploading it, and downloading the resulting
`.cer` file.

## 4. Export signerCert.pem and signerKey.pem
On a Mac, double-click the downloaded `.cer` to import it into Keychain
Access (it'll be paired with the private key you generated in step 3).
Then, in Keychain Access, select both the certificate and its key,
right-click → **Export 2 items...** → save as `Certificates.p12` (you'll
set an export password).

Then, in Terminal, convert that into the two PEM files this project needs:

```bash
openssl pkcs12 -in Certificates.p12 -clcerts -nokeys -out signerCert.pem
openssl pkcs12 -in Certificates.p12 -nocerts -out signerKey.pem
```

You'll be prompted for the export password from the `.p12`, and then
asked to set a new passphrase for `signerKey.pem` — put that passphrase in
the `APPLE_PASS_KEY_PASSPHRASE` environment variable in `docker-compose.yml`.

## 5. Download Apple's WWDR intermediate certificate
https://www.apple.com/certificateauthority/ → "Worldwide Developer Relations - G4"
(or whichever is current) → convert similarly if it downloads as `.cer`:

```bash
openssl x509 -inform der -in AppleWWDRCAG4.cer -out wwdr.pem
```

## 6. Place the three files here
```
certs/google/service-account.json   <- (Google, see the other README)
certs/apple/
  wwdr.pem
  signerCert.pem
  signerKey.pem
```

## 7. Set your identifiers
In `docker-compose.yml`, set:
```yaml
APPLE_PASS_TYPE_ID: pass.com.yourcompany.moya   # from step 2
APPLE_TEAM_ID: YOUR10CHARTEAMID                 # found in the Developer portal, top right
APPLE_PASS_KEY_PASSPHRASE: whatever-you-set-in-step-4
```

## 8. Replace the placeholder images
`pass-models/event.pass/icon.png`, `icon@2x.png`, `logo.png`, `logo@2x.png`
are currently 1x1 placeholder pixels. Replace them with real branded PNGs
at Apple's specified dimensions (icon 29x29 / 58x58, logo ~160x50 / ~320x100)
before shipping this to real users — Apple's Wallet app will render broken
or blank artwork otherwise.

## Once all of the above is done
`GET /api/tickets/:ticketNumber/apple-pass` will return a signed `.pkpass`
file. Until then, it returns a clear `501` explaining what's missing.
