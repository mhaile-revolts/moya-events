import React from "react";
import { Loader2, Star } from "lucide-react";
import { T } from "../../theme.js";

export function StubDivider({ bg = T.ink }) {
  return (
    <div style={{ position: "relative", height: 1 }}>
      <div style={{ position: "absolute", left: -14, top: -10, width: 20, height: 20, borderRadius: "50%", background: bg }} />
      <div style={{ position: "absolute", right: -14, top: -10, width: 20, height: 20, borderRadius: "50%", background: bg }} />
      <div style={{ borderTop: "2px dashed #3a3564", margin: "0 6px" }} />
    </div>
  );
}

export function Pill({ children, active, onClick }) {
  return (
    <button onClick={onClick} className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors"
      style={{ background: active ? T.gold : T.surface, color: active ? T.ink : T.muted, border: `1px solid ${active ? T.gold : "#332e5c"}` }}>
      {children}
    </button>
  );
}

export function CategoryTag({ category, accent }) {
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full moya-mono"
      style={{ color: accent, background: `${accent}22`, border: `1px solid ${accent}55` }}>
      {(category || "").toUpperCase()}
    </span>
  );
}

export function PrimaryButton({ children, onClick, disabled, style = {}, full }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`font-semibold rounded-xl px-6 py-3 transition-transform active:scale-[0.98] ${full ? "w-full" : ""}`}
      style={{ background: disabled ? "#4a4470" : T.gold, color: T.ink, opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer", ...style }}>
      {children}
    </button>
  );
}

export function FullLoader({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <Loader2 className="moya-spin" size={24} color={T.gold} />
      <span className="text-sm" style={{ color: T.muted }}>{label}</span>
    </div>
  );
}

export function StarRow({ value, onChange, size = 16, readOnly = false }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (value || 0) >= n;
        return (
          <button key={n} type="button" disabled={readOnly} onClick={() => onChange && onChange(n)} style={{ cursor: readOnly ? "default" : "pointer", lineHeight: 0 }}>
            <Star size={size} color={T.gold} fill={filled ? T.gold : "none"} strokeWidth={1.5} />
          </button>
        );
      })}
    </div>
  );
}
