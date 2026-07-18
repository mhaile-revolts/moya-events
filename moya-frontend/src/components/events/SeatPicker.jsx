import React from "react";
import { T } from "../../theme.js";

function fmtRWF(n) { return n === 0 ? "Free" : `${Number(n).toLocaleString()} RWF`; }

export default function SeatPicker({ ticketType, selected, setSelected, maxSeats = 8 }) {
  const seats = ticketType.seats || [];
  const rows = Array.from(new Set(seats.map((s) => s.seat_code[0]))).sort();

  const toggleSeat = (seatCode, status) => {
    if (status !== "available") return;
    if (selected.includes(seatCode)) {
      setSelected(selected.filter((s) => s !== seatCode));
    } else if (selected.length < maxSeats) {
      setSelected([...selected, seatCode]);
    }
  };

  return (
    <div>
      <h3 className="moya-display font-bold text-lg mb-3" style={{ color: T.text }}>Pick your seats</h3>
      <div className="rounded-xl p-4 mb-3 overflow-x-auto moya-scroll" style={{ background: T.surface, border: "1px solid #2a2652" }}>
        <div className="text-center text-xs mb-4 py-1.5 rounded" style={{ background: T.surface2, color: T.muted }}>PITCH / STAGE SIDE</div>
        <div className="flex flex-col gap-2 items-center min-w-max">
          {rows.map((row) => (
            <div key={row} className="flex items-center gap-2">
              <span className="text-xs w-4 moya-mono" style={{ color: T.muted }}>{row}</span>
              <div className="flex gap-1.5">
                {seats.filter((s) => s.seat_code[0] === row).map((s) => {
                  const isSelected = selected.includes(s.seat_code);
                  const isSold = s.status === "sold";
                  return (
                    <button key={s.seat_code} disabled={isSold} onClick={() => toggleSeat(s.seat_code, s.status)} title={s.seat_code}
                      className="w-7 h-7 rounded-md text-[10px] font-semibold flex items-center justify-center transition-colors"
                      style={{ background: isSold ? "#3a3564" : isSelected ? T.gold : T.surface2, color: isSold ? "#66618f" : isSelected ? T.ink : T.muted, cursor: isSold ? "not-allowed" : "pointer" }}>
                      {s.seat_code.slice(1)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs mb-4" style={{ color: T.muted }}>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: T.surface2 }} /> Available</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: T.gold }} /> Selected</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ background: "#3a3564" }} /> Taken</span>
      </div>
      <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: T.surface }}>
        <span className="text-sm" style={{ color: T.text }}>{selected.length === 0 ? "No seats selected" : `Selected: ${selected.slice().sort().join(", ")}`}</span>
        <span className="moya-mono font-semibold" style={{ color: T.gold }}>{fmtRWF(ticketType.price * selected.length)}</span>
      </div>
    </div>
  );
}
