import React from "react";
import { WifiOff, RotateCcw } from "lucide-react";
import { T, FONTS } from "../../theme.js";
import { PrimaryButton } from "../shared/ui.jsx";

const API_BASE = import.meta.env.VITE_API_BASE;

export default function BackendUnreachable({ onRetry }) {
  return (
    <div className="moya-root min-h-screen flex items-center justify-center px-5" style={{ background: T.ink }}>
      {FONTS}
      <div className="max-w-sm text-center">
        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: `${T.coral}22` }}>
          <WifiOff size={26} color={T.coral} />
        </div>
        <h1 className="moya-display font-bold text-xl mb-2" style={{ color: T.text }}>Can't reach the backend</h1>
        <p className="text-sm mb-1" style={{ color: T.muted }}>
          This prototype now calls a real API at <span className="moya-mono">{API_BASE}</span>.
        </p>
        <p className="text-sm mb-6" style={{ color: T.muted }}>
          Make sure the local backend is running: <span className="moya-mono">docker compose up</span> from the moya-backend folder.
        </p>
        <PrimaryButton onClick={onRetry}><RotateCcw size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />Retry</PrimaryButton>
      </div>
    </div>
  );
}
