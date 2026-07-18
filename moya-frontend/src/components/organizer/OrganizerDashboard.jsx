import { useState, useEffect } from "react";
import { TrendingUp, Users, Ticket as TicketIcon, Star, RotateCcw } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import { T } from "../../theme.js";
import { FullLoader, PrimaryButton } from "../shared/ui.jsx";
import { apiFetch } from "../../api.js";
import CreateEventModal from "./CreateEventModal.jsx";

function avgRating(reviews) {
  if (!reviews || reviews.length === 0) return null;
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: T.surface, border: "1px solid #2a2652" }}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${accent}22` }}><Icon size={15} color={accent} /></div>
        <span className="text-xs" style={{ color: T.muted }}>{label}</span>
      </div>
      <span className="moya-display font-bold text-xl" style={{ color: T.text }}>{value}</span>
    </div>
  );
}

export default function OrganizerDashboard({ token, events, loading, onRefresh }) {
  const [showModal, setShowModal] = useState(false);
  const [ratingsByEvent, setRatingsByEvent] = useState({});

  useEffect(() => {
    if (loading || events.length === 0) return;
    let cancelled = false;
    Promise.all(events.map(async (e) => [e.id, await apiFetch(`/events/${e.id}/reviews`)]))
      .then((entries) => { if (!cancelled) setRatingsByEvent(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [loading, events]);

  if (loading) return <FullLoader label="Loading live sales data..." />;

  const totalRevenue = events.reduce((s, e) => s + e.ticketTypes.reduce((s2, t) => s2 + t.price * t.sold, 0), 0);
  const totalSold = events.reduce((s, e) => s + e.ticketTypes.reduce((s2, t) => s2 + t.sold, 0), 0);
  const chartData = events.map((e) => ({ name: e.title.split(":")[0].slice(0, 14), sold: e.ticketTypes.reduce((s, t) => s + t.sold, 0) }));
  const allReviews = Object.values(ratingsByEvent).flat();
  const overallRating = avgRating(allReviews);

  return (
    <div className="px-5 sm:px-8 py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="moya-display font-extrabold text-2xl sm:text-3xl" style={{ color: T.text }}>Organizer dashboard</h1>
          <p className="text-sm mt-1" style={{ color: T.muted }}>Live from your local database — refresh anytime.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onRefresh} className="flex items-center gap-1.5 rounded-xl px-4 py-3 text-sm" style={{ background: T.surface, color: T.text, border: "1px solid #2a2652" }}><RotateCcw size={14} /> Refresh</button>
          <PrimaryButton onClick={() => setShowModal(true)}>+ Create event</PrimaryButton>
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-8">
        <StatCard icon={TrendingUp} label="Total revenue" value={`${(totalRevenue / 1000).toFixed(0)}k RWF`} accent={T.gold} />
        <StatCard icon={TicketIcon} label="Tickets sold" value={totalSold.toLocaleString()} accent={T.coral} />
        <StatCard icon={Users} label="Events live" value={events.length} accent={T.gold} />
        <StatCard icon={Star} label="Sell-through" value={`${Math.round((totalSold / Math.max(1, events.reduce((s, e) => s + e.ticketTypes.reduce((s2, t) => s2 + t.capacity, 0), 0))) * 100)}%`} accent={T.coral} />
        <StatCard icon={Star} label="Avg. rating" value={overallRating !== null ? `${overallRating.toFixed(1)} / 5` : "No reviews yet"} accent={T.gold} />
      </div>
      <div className="rounded-xl p-5 mb-8" style={{ background: T.surface, border: "1px solid #2a2652" }}>
        <h3 className="moya-display font-bold text-base mb-4" style={{ color: T.text }}>Tickets sold by event</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData}>
            <XAxis dataKey="name" tick={{ fill: T.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: T.muted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: T.surface2, border: "1px solid #3a3564", borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="sold" fill={T.gold} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-xl overflow-hidden mb-6" style={{ background: T.surface, border: "1px solid #2a2652" }}>
        <h3 className="moya-display font-bold text-base p-5 pb-3" style={{ color: T.text }}>Your events</h3>
        <div className="flex flex-col">
          {events.map((e) => {
            const cap = e.ticketTypes.reduce((s, t) => s + t.capacity, 0);
            const sold = e.ticketTypes.reduce((s, t) => s + t.sold, 0);
            const pct = cap ? Math.round((sold / cap) * 100) : 0;
            const eRating = avgRating(ratingsByEvent[e.id]);
            return (
              <div key={e.id} className="flex items-center justify-between px-5 py-3 gap-3" style={{ borderTop: "1px solid #2a2652" }}>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate" style={{ color: T.text }}>{e.title}</div>
                  <div className="text-xs" style={{ color: T.muted }}>{e.category} · {e.venue} · {sold}/{cap} sold{eRating !== null ? ` · ${eRating.toFixed(1)}★` : ""}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="w-28 h-1.5 rounded-full hidden sm:block" style={{ background: T.surface2 }}><div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: T.gold }} /></div>
                  <span className="text-xs w-10 text-right" style={{ color: T.muted }}>{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {showModal && <CreateEventModal token={token} onClose={() => setShowModal(false)} onCreated={onRefresh} />}
    </div>
  );
}
