import React from "react";
import { Compass, WalletCards, LayoutDashboard } from "lucide-react";
import { T } from "../../theme.js";

export default function Header({ mode, setMode, setView, user, onLogout }) {
  const tabs = [
    { id: "attendee", label: "Discover", icon: Compass },
    { id: "wallet", label: "My tickets", icon: WalletCards },
    { id: "organizer", label: "Organizer", icon: LayoutDashboard },
  ];
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between px-5 sm:px-8 py-4"
      style={{ background: `${T.ink}ee`, backdropFilter: "blur(8px)", borderBottom: "1px solid #2a2652" }}>
      <button className="flex items-center gap-2" onClick={() => { setMode("attendee"); setView("browse"); }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center moya-display font-bold" style={{ background: T.gold, color: T.ink }}>M</div>
        <span className="moya-display text-xl font-bold hidden sm:inline" style={{ color: T.text }}>moya</span>
      </button>
      <div className="flex items-center gap-1 p-1 rounded-full" style={{ background: T.surface }}>
        {tabs.map((t) => (
          <button key={t.id} onClick={() => { setMode(t.id); setView(t.id === "attendee" ? "browse" : t.id); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors"
            style={{ background: mode === t.id ? T.surface2 : "transparent", color: mode === t.id ? T.text : T.muted }}>
            <t.icon size={15} /> <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>
      <button onClick={onLogout} className="flex items-center gap-2 text-xs" style={{ color: T.muted }} title="Log out">
        <span className="hidden sm:inline">{user?.name}</span>
        <div className="w-7 h-7 rounded-full flex items-center justify-center moya-mono font-semibold text-xs" style={{ background: T.surface2, color: T.text }}>
          {(user?.name || "?").charAt(0).toUpperCase()}
        </div>
      </button>
    </div>
  );
}
