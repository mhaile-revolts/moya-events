import { useState } from "react";
import { Wallet, Loader2 } from "lucide-react";
import { T } from "../../theme.js";
import { downloadApplePass, openGoogleWalletLink } from "../../api.js";

export default function AddToWalletButtons({ ticketNumber, token }) {
  const [status, setStatus] = useState(null); // { platform, error } | { platform, loading }

  const handleApple = async () => {
    setStatus({ platform: "apple", loading: true });
    try {
      await downloadApplePass(ticketNumber, token);
      setStatus(null);
    } catch (e) {
      setStatus({ platform: "apple", error: e.message });
    }
  };

  const handleGoogle = async () => {
    setStatus({ platform: "google", loading: true });
    try {
      await openGoogleWalletLink(ticketNumber, token);
      setStatus(null);
    } catch (e) {
      setStatus({ platform: "google", error: e.message });
    }
  };

  return (
    <div className="flex flex-col gap-2 mt-3">
      <div className="flex gap-2">
        <button onClick={handleApple} disabled={status?.loading}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium"
          style={{ background: T.surface2, color: T.text, border: "1px solid #2a2652" }}>
          {status?.platform === "apple" && status.loading ? <Loader2 className="moya-spin" size={13} /> : <Wallet size={13} />}
          Add to Apple Wallet
        </button>
        <button onClick={handleGoogle} disabled={status?.loading}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-medium"
          style={{ background: T.surface2, color: T.text, border: "1px solid #2a2652" }}>
          {status?.platform === "google" && status.loading ? <Loader2 className="moya-spin" size={13} /> : <Wallet size={13} />}
          Add to Google Wallet
        </button>
      </div>
      {status?.error && (
        <p className="text-xs" style={{ color: T.coral }}>{status.error}</p>
      )}
    </div>
  );
}
