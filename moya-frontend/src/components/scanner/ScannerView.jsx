import { useState } from "react";
import { ScanLine, Check, AlertTriangle, X } from "lucide-react";
import { T } from "../../theme.js";
import { PrimaryButton } from "../shared/ui.jsx";
import { apiFetch } from "../../api.js";

export default function ScannerView({ token }) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);

  const runCheck = async () => {
    if (!input.trim()) return;
    setChecking(true);
    setResult(null);
    try {
      const res = await apiFetch(`/tickets/${input.trim()}/checkin`, { method: "POST", token });
      setResult({ ok: true, checkedInAt: res.checkedInAt });
    } catch (e) {
      setResult({ ok: false, reason: e.code || "not_found" });
    }
    setChecking(false);
  };

  return (
    <div className="px-5 sm:px-8 py-8 max-w-lg mx-auto">
      <h1 className="moya-display font-extrabold text-2xl mb-2" style={{ color: T.text }}>Gate scanner</h1>
      <p className="text-sm mb-6" style={{ color: T.muted }}>Paste a ticket number from My Tickets to simulate a gate scan against the real backend.</p>
      <div className="flex gap-2 mb-4">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="MOYA-EV1-1234"
          className="flex-1 rounded-xl px-4 py-3 text-sm outline-none moya-mono" style={{ background: T.surface, color: T.text, border: "1px solid #2a2652" }} />
        <PrimaryButton onClick={runCheck} disabled={checking}>{checking ? "..." : <ScanLine size={18} />}</PrimaryButton>
      </div>
      {result && (
        <div className="rounded-xl p-4" style={{ background: result.ok ? `${T.green}18` : `${T.red}18`, border: `1px solid ${result.ok ? T.green : T.red}55` }}>
          {result.ok ? (
            <div className="flex items-center gap-2"><Check size={18} color={T.green} /><span className="text-sm font-medium" style={{ color: T.text }}>Valid — checked in</span></div>
          ) : result.reason === "duplicate" ? (
            <div className="flex items-center gap-2"><AlertTriangle size={18} color={T.red} /><span className="text-sm font-medium" style={{ color: T.text }}>Already used. Possible duplicate/screenshot.</span></div>
          ) : (
            <div className="flex items-center gap-2"><X size={18} color={T.red} /><span className="text-sm font-medium" style={{ color: T.text }}>Ticket number not found.</span></div>
          )}
        </div>
      )}
    </div>
  );
}
