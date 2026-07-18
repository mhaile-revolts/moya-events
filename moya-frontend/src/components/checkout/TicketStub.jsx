import React from "react";
import { T } from "../../theme.js";
import { StubDivider, CategoryTag } from "../shared/ui.jsx";
import FakeQR from "../shared/FakeQR.jsx";

export default function TicketStub({ event, ticketTypeName, ticketNumber, seatCode }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: T.surface, border: "1px solid #2a2652" }}>
      <div className="p-5" style={{ background: `linear-gradient(135deg, ${event.accent}55, ${T.ink})` }}>
        <CategoryTag category={event.category} accent={event.accent} />
        <h2 className="moya-display font-bold text-lg mt-2" style={{ color: T.text }}>{event.title}</h2>
        <div className="text-xs mt-1" style={{ color: T.muted }}>{event.date_label} · {event.time_label}</div>
        <div className="text-xs" style={{ color: T.muted }}>{event.venue}, {event.city}</div>
      </div>
      <StubDivider bg={T.surface} />
      <div className="p-5 flex flex-col items-center gap-3">
        <FakeQR value={ticketNumber} />
        <div className="moya-mono text-xs tracking-wider" style={{ color: T.muted }}>{ticketNumber}</div>
        <div className="grid grid-cols-2 gap-3 w-full mt-2 text-center">
          <div className="rounded-lg py-2" style={{ background: T.surface2 }}><div className="text-xs" style={{ color: T.muted }}>Ticket</div><div className="text-sm font-semibold" style={{ color: T.text }}>{ticketTypeName}</div></div>
          <div className="rounded-lg py-2" style={{ background: T.surface2 }}><div className="text-xs" style={{ color: T.muted }}>Seat</div><div className="text-sm font-semibold" style={{ color: T.text }}>{seatCode || "General"}</div></div>
        </div>
      </div>
    </div>
  );
}
