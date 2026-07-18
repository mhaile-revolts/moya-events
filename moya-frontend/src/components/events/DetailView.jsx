import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Calendar, Clock, MapPin, Minus, Plus, ChevronRight } from "lucide-react";
import { T } from "../../theme.js";
import { CategoryTag, PrimaryButton, FullLoader, StarRow } from "../shared/ui.jsx";
import SeatPicker from "./SeatPicker.jsx";
import { apiFetch } from "../../api.js";

function fmtRWF(n) { return n === 0 ? "Free" : `${Number(n).toLocaleString()} RWF`; }
function avgRating(reviews) {
  if (!reviews || reviews.length === 0) return null;
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
}

export default function DetailView({ eventId, onBack, onBuy }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [ticketIdx, setTicketIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [selectedSeats, setSelectedSeats] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ev, rv] = await Promise.all([
        apiFetch(`/events/${eventId}`),
        apiFetch(`/events/${eventId}/reviews`),
      ]);
      setEvent(ev);
      setReviews(rv);
    } catch (e) {
      setLoadError(e.message);
    }
    setLoading(false);
  }, [eventId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setQty(1); setSelectedSeats([]); }, [ticketIdx]);

  if (loading) return <FullLoader label="Loading event..." />;
  if (loadError || !event) return <div className="text-center py-20 text-sm" style={{ color: T.coral }}>{loadError || "Couldn't load this event."}</div>;

  const ticket = event.ticketTypes[ticketIdx];
  const usesSeatMap = !!ticket.hasSeatMap;
  const total = usesSeatMap ? ticket.price * selectedSeats.length : ticket.price * qty;
  const soldOut = ticket.available <= 0;
  const canBuy = usesSeatMap ? selectedSeats.length > 0 : !soldOut;
  const rating = avgRating(reviews);

  return (
    <div className="max-w-3xl mx-auto pb-32">
      <div className="h-52 sm:h-64 w-full flex flex-col justify-between p-6" style={{ background: `linear-gradient(135deg, ${event.accent}66, ${T.ink})` }}>
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm w-fit px-3 py-1.5 rounded-full" style={{ background: `${T.ink}88`, color: T.text }}>
          <ArrowLeft size={15} /> Back
        </button>
        <div>
          <CategoryTag category={event.category} accent={event.accent} />
          <h1 className="moya-display font-extrabold text-2xl sm:text-3xl mt-2" style={{ color: T.text }}>{event.title}</h1>
          {rating !== null && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <StarRow value={rating} readOnly size={13} />
              <span className="text-xs" style={{ color: T.text }}>{rating.toFixed(1)} ({reviews.length} review{reviews.length !== 1 ? "s" : ""})</span>
            </div>
          )}
        </div>
      </div>
      <div className="px-5 sm:px-8 py-6 flex flex-col gap-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[{ icon: Calendar, label: event.date_label }, { icon: Clock, label: event.time_label }, { icon: MapPin, label: `${event.venue}, ${event.city}` }].map((it, i) => (
            <div key={i} className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: T.surface }}>
              <it.icon size={16} color={T.gold} /><span className="text-sm" style={{ color: T.text }}>{it.label}</span>
            </div>
          ))}
        </div>
        <p className="text-sm leading-relaxed" style={{ color: T.muted }}>{event.description}</p>

        <div>
          <h3 className="moya-display font-bold text-lg mb-3" style={{ color: T.text }}>Reviews</h3>
          {reviews.length === 0 ? (
            <p className="text-xs" style={{ color: T.muted }}>No reviews yet — be the first to rate this event from My Tickets after attending.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {reviews.slice(0, 5).map((r) => (
                <div key={r.id} className="rounded-xl p-3" style={{ background: T.surface, border: "1px solid #2a2652" }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: T.text }}>{r.name}</span>
                    <StarRow value={r.rating} readOnly size={13} />
                  </div>
                  {r.comment && <p className="text-xs" style={{ color: T.muted }}>{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="moya-display font-bold text-lg mb-3" style={{ color: T.text }}>Choose your ticket</h3>
          <div className="flex flex-col gap-2">
            {event.ticketTypes.map((tt, i) => {
              const out = tt.available <= 0;
              return (
                <button key={tt.id} disabled={out} onClick={() => setTicketIdx(i)}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors"
                  style={{ background: ticketIdx === i ? T.surface2 : T.surface, border: `1.5px solid ${ticketIdx === i ? T.gold : "#2a2652"}`, opacity: out ? 0.5 : 1, cursor: out ? "not-allowed" : "pointer" }}>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: T.text }}>{tt.name}{tt.hasSeatMap ? " · reserved seating" : ""}</div>
                    <div className="text-xs" style={{ color: out ? T.coral : T.muted }}>{out ? "Sold out" : `${tt.available} left`}</div>
                  </div>
                  <div className="moya-mono font-semibold" style={{ color: T.gold }}>{fmtRWF(tt.price)}</div>
                </button>
              );
            })}
          </div>
        </div>

        {usesSeatMap ? (
          !soldOut && <SeatPicker ticketType={ticket} selected={selectedSeats} setSelected={setSelectedSeats} />
        ) : (
          !soldOut && (
            <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: T.surface }}>
              <span className="text-sm font-medium" style={{ color: T.text }}>Quantity</span>
              <div className="flex items-center gap-3">
                <button onClick={() => setQty(Math.max(1, qty - 1))} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: T.surface2, color: T.text }}><Minus size={14} /></button>
                <span className="w-5 text-center font-semibold" style={{ color: T.text }}>{qty}</span>
                <button onClick={() => setQty(Math.min(ticket.available, qty + 1))} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: T.surface2, color: T.text }}><Plus size={14} /></button>
              </div>
            </div>
          )
        )}
      </div>
      <div className="fixed bottom-0 left-0 right-0 px-5 sm:px-8 py-4 flex items-center justify-between gap-4"
        style={{ background: `${T.ink}f2`, borderTop: "1px solid #2a2652", backdropFilter: "blur(8px)" }}>
        <div><div className="text-xs" style={{ color: T.muted }}>Total</div><div className="moya-mono font-bold text-lg" style={{ color: T.text }}>{fmtRWF(total)}</div></div>
        <PrimaryButton disabled={!canBuy} onClick={() => onBuy(event, ticket, usesSeatMap ? selectedSeats.length : qty, total, usesSeatMap ? selectedSeats : null)} style={{ flex: "0 0 auto" }}>
          {soldOut ? "Sold out" : <>Buy tickets <ChevronRight size={16} style={{ display: "inline", marginLeft: 4, verticalAlign: "-2px" }} /></>}
        </PrimaryButton>
      </div>
    </div>
  );
}
