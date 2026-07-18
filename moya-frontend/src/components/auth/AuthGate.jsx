import { useState } from "react";
import { T, FONTS } from "../../theme.js";
import { PrimaryButton } from "../shared/ui.jsx";
import { apiFetch } from "../../api.js";
import { saveSession } from "../../session.js";

export default function AuthGate({ onDone }) {
  const [step, setStep] = useState("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState(null);
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    if (!name.trim() || !phone.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/auth/register", { method: "POST", body: { name: name.trim(), phone: phone.trim() } });
      setCode(res.devCode);
      setStep("otp");
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/auth/verify", { method: "POST", body: { name: name.trim(), phone: phone.trim(), code: entered.trim() } });
      await saveSession(res);
      onDone(res);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="moya-root min-h-screen flex items-center justify-center px-5" style={{ background: T.ink }}>
      {FONTS}
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center moya-display font-bold" style={{ background: T.gold, color: T.ink }}>M</div>
          <span className="moya-display text-2xl font-bold" style={{ color: T.text }}>moya</span>
        </div>
        <div className="rounded-2xl p-6" style={{ background: T.surface, border: "1px solid #2a2652" }}>
          {step === "form" ? (
            <>
              <h2 className="moya-display font-bold text-lg mb-1" style={{ color: T.text }}>Create your account</h2>
              <p className="text-xs mb-5" style={{ color: T.muted }}>We'll text you a one-time code to verify your number.</p>
              <div className="flex flex-col gap-3 mb-5">
                <div>
                  <label className="text-xs" style={{ color: T.muted }}>Full name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aline Uwase"
                    className="w-full mt-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: T.surface2, color: T.text }} />
                </div>
                <div>
                  <label className="text-xs" style={{ color: T.muted }}>Mobile number</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="078 000 0000"
                    className="w-full mt-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: T.surface2, color: T.text }} />
                </div>
              </div>
              {error && <p className="text-xs mb-3" style={{ color: T.coral }}>{error}</p>}
              <PrimaryButton full disabled={!name.trim() || !phone.trim() || busy} onClick={sendCode}>
                {busy ? "Sending code..." : "Send verification code"}
              </PrimaryButton>
            </>
          ) : (
            <>
              <h2 className="moya-display font-bold text-lg mb-1" style={{ color: T.text }}>Enter your code</h2>
              <p className="text-xs mb-4" style={{ color: T.muted }}>Sent to {phone}</p>
              {code && (
                <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}55`, color: T.text }}>
                  Dev mode — code returned by backend (no SMS sent): <span className="moya-mono font-semibold">{code}</span>.
                </div>
              )}
              <input value={entered} onChange={(e) => setEntered(e.target.value)} placeholder="6-digit code" maxLength={6}
                className="w-full mb-2 rounded-lg px-3 py-2.5 text-sm outline-none moya-mono tracking-widest text-center"
                style={{ background: T.surface2, color: T.text }} />
              {error && <p className="text-xs mb-3" style={{ color: T.coral }}>{error}</p>}
              <PrimaryButton full disabled={entered.length < 6 || busy} onClick={verify} style={{ marginTop: 8 }}>
                {busy ? "Verifying..." : "Verify & continue"}
              </PrimaryButton>
              <button onClick={() => setStep("form")} className="w-full text-center text-xs mt-4" style={{ color: T.muted }}>
                Use a different number
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
