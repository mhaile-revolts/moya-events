import { useState, useEffect } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { T } from "../../theme.js";
import { FullLoader, PrimaryButton, StarRow } from "../shared/ui.jsx";
import TicketStub from "../checkout/TicketStub.jsx";
import AddToWalletButtons from "../checkout/AddToWalletButtons.jsx";
import { apiFetch } from "../../api.js";

export default function WalletView({ token, user }) {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [openTicket, setOpenTicket] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/tickets/me", { token })
      .then((t) => { if (!cancelled) { setTickets(t); setLoading(false); } })
      .catch((e) => { if (!cancelled) { setLoadError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [token]);

  const openDetail = async (t) => {
    setOpenTicket(t);
    setReviews([]);
    setReviewError(null);
    try {
      const rv = await apiFetch(`/events/${t.event_id}/reviews`);
      setReviews(rv);
      const mine = rv.find((r) => r.user_id === user.id);
      setReviewRating(mine ? mine.rating : 0);
      setReviewComment(mine ? (mine.comment || "") : "");
    } catch (e) {
      // Reviews failed to load — non-fatal, ticket stub still shown.
    }
  };

  const myReview = reviews.find((r) => r.user_id === user.id);

  const submitReview = async () => {
    if (!reviewRating) return;
    setSubmitting(true);
    setReviewError(null);
    try {
      await apiFetch(`/events/${openTicket.event_id}/reviews`, { method: "POST", token, body: { rating: reviewRating, comment: reviewComment.trim() } });
      const rv = await apiFetch(`/events/${openTicket.event_id}/reviews`);
      setReviews(rv);
    } catch (e) {
      setReviewError(e.message);
    }
    setSubmitting(false);
  };

  if (loading) return <FullLoader label="Loading your tickets..." />;
  if (loadError) return <div className="text-center py-20 text-sm" style={{ color: T.coral }}>{loadError}</div>;

  if (openTicket) {
    return (
      <div className="max-w-md mx-auto px-5 sm:px-8 py-8">
        <button onClick={() => setOpenTicket(null)} className="flex items-center gap-1.5 text-sm mb-6" style={{ color: T.muted }}><ArrowLeft size={15} /> All tickets</button>
        <TicketStub
          event={{ title: openTicket.event_title, date_label: openTicket.date_label, time_label: openTicket.time_label, venue: openTicket.venue, city: openTicket.city, accent: openTicket.accent, category: openTicket.category }}
          ticketTypeName={openTicket.ticket_type_name}
          ticketNumber={openTicket.ticket_number}
          seatCode={openTicket.seat_code}
        />
        <AddToWalletButtons ticketNumber={openTicket.ticket_number} token={token} />
        <div className="rounded-xl p-4 mt-4" style={{ background: T.surface, border: "1px solid #2a2652" }}>
          {myReview ? (
            <>
              <h3 className="moya-display font-bold text-sm mb-2" style={{ color: T.text }}>Your review</h3>
              <StarRow value={myReview.rating} readOnly size={16} />
              {myReview.comment && <p className="text-xs mt-2" style={{ color: T.muted }}>{myReview.comment}</p>}
            </>
          ) : (
            <>
              <h3 className="moya-display font-bold text-sm mb-3" style={{ color: T.text }}>Rate this event</h3>
              <StarRow value={reviewRating} onChange={setReviewRating} size={22} />
              <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Optional comment..." rows={2}
                className="w-full mt-3 rounded-lg px-3 py-2 text-sm outline-none resize-none" style={{ background: T.surface2, color: T.text }} />
              <PrimaryButton full style={{ marginTop: 12 }} disabled={!reviewRating || submitting} onClick={submitReview}>{submitting ? "Submitting..." : "Submit review"}</PrimaryButton>
              {reviewError && <p className="text-xs mt-2" style={{ color: T.coral }}>{reviewError}</p>}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 sm:px-8 py-8 max-w-2xl mx-auto">
      <h1 className="moya-display font-extrabold text-3xl mb-2" style={{ color: T.text }}>My tickets</h1>
      <p className="text-sm mb-6" style={{ color: T.muted }}>Pulled live from the backend for your account.</p>
      {tickets.length === 0 ? (
        <div className="text-center py-20 rounded-xl" style={{ background: T.surface, color: T.muted, border: "1px solid #2a2652" }}>No tickets yet — head to Discover to buy one.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {tickets.map((t) => (
            <button key={t.ticket_number} onClick={() => openDetail(t)} className="flex items-center justify-between rounded-xl p-4 text-left" style={{ background: T.surface, border: "1px solid #2a2652" }}>
              <div>
                <div className="text-sm font-semibold" style={{ color: T.text }}>{t.event_title}</div>
                <div className="text-xs mt-0.5" style={{ color: T.muted }}>{t.date_label} · {t.ticket_type_name}{t.seat_code ? ` · seat ${t.seat_code}` : ""}{t.used ? " · checked in" : ""}</div>
              </div>
              <ChevronRight size={16} color={T.muted} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
