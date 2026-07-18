import React from "react";
import { Calendar, MapPin } from "lucide-react";
import { T } from "../../theme.js";
import { StubDivider, CategoryTag } from "../shared/ui.jsx";

function fmtRWF(n) { return n === 0 ? "Free" : `${Number(n).toLocaleString()} RWF`; }

export default function EventCard({ event, onOpen }) {
  const totalCap = event.ticketTypes.reduce((s, t) => s + t.capacity, 0);
  const totalSold = event.ticketTypes.reduce((s, t) => s + t.sold, 0);
  const pctSold = totalCap ? Math.round((totalSold / totalCap) * 100) : 0;
  const fromPrice = event.ticketTypes.length ? Math.min(...event.ticketTypes.map((t) => t.price)) : 0;
  const soldOut = event.ticketTypes.length > 0 && event.ticketTypes.every((t) => t.available <= 0);

  return (
    <button onClick={() => onOpen(event)} className="text-left rounded-2xl overflow-hidden flex flex-col transition-transform hover:-translate-y-1"
      style={{ background: T.surface, border: "1px solid #2a2652" }}>
      <div className="h-28 w-full flex items-end p-4" style={{ background: `linear-gradient(135deg, ${event.accent}55, ${T.ink})` }}>
        <CategoryTag category={event.category} accent={event.accent} />
      </div>
      <div className="p-4 flex flex-col gap-2">
        <h3 className="moya-display font-bold text-base leading-snug" style={{ color: T.text }}>{event.title}</h3>
        <div className="flex items-center gap-2 text-xs" style={{ color: T.muted }}><Calendar size={13} /> {event.date_label} · {event.time_label}</div>
        <div className="flex items-center gap-2 text-xs" style={{ color: T.muted }}><MapPin size={13} /> {event.venue}, {event.city}</div>
      </div>
      <StubDivider bg={T.surface} />
      <div className="p-4 pt-3 flex items-center justify-between">
        <span className="moya-mono font-semibold text-sm" style={{ color: T.gold }}>from {fmtRWF(fromPrice)}</span>
        <span className="text-xs" style={{ color: soldOut ? T.coral : T.muted }}>{soldOut ? "Sold out" : `${pctSold}% sold`}</span>
      </div>
    </button>
  );
}
