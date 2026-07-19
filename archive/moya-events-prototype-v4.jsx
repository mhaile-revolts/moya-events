import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Search, MapPin, Calendar, Clock, ArrowLeft, Minus, Plus, Smartphone,
  CreditCard, Wallet, Check, TrendingUp, Users, Ticket as TicketIcon,
  Download, LayoutDashboard, Compass, X, ChevronRight, Star, ScanLine,
  AlertTriangle, RotateCcw, Loader2, WalletCards, WifiOff
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar
} from "recharts";

/* ---------------------------------------------------------------
   This version calls the real local backend (Express + Postgres,
   from the moya-backend docker-compose project) instead of the
   artifact's window.storage. It runs entirely in your browser, so
   as long as `docker compose up` is running on your machine, these
   fetch() calls go straight to your own containers on localhost.

   The only thing still kept in window.storage is the JWT session
   token — just so you don't have to re-verify by phone every time
   you reopen this artifact.
----------------------------------------------------------------*/
const API_BASE = "http://localhost:4000/api";

const T = {
  ink: "#14122B", surface: "#1E1B3A", surface2: "#272248",
  gold: "#F5B942", coral: "#FF6B5E", text: "#F5F3FF", muted: "#9691B8",
  green: "#4ADE9C", red: "#FF6B5E",
};

const FONTS = (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600&display=swap');
    .moya-root { font-family: 'Inter', sans-serif; }
    .moya-display { font-family: 'Bricolage Grotesque', sans-serif; }
    .moya-mono { font-family: 'IBM Plex Mono', monospace; }
    .moya-scroll::-webkit-scrollbar { height: 6px; width: 6px; }
    .moya-scroll::-webkit-scrollbar-thumb { background: #3a3564; border-radius: 4px; }
    .moya-spin { animation: moya-spin 0.9s linear infinite; }
    @keyframes moya-spin { to { transform: rotate(360deg); } }
  `}</style>
);

const CATEGORIES_FALLBACK = ["All", "Music", "Business", "Comedy", "Sports"];
function fmtRWF(n) { return n === 0 ? "Free" : `${Number(n).toLocaleString()} RWF`; }

/* ---------------------------------------------------------------
   API CLIENT
----------------------------------------------------------------*/
async function apiFetch(path, { method = "GET", body, token } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (e) {
    const err = new Error("Can't reach the backend. Is `docker compose up` running on your machine?");
    err.network = true;
    throw err;
  }
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty body */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data && data.code;
    throw err;
  }
  return data;
}

/* Session token is the one thing still kept in the artifact's own
   storage — purely so you don't have to re-verify by phone every
   time you reopen this artifact. The token itself, and everything
   it unlocks, is validated server-side by the real backend. */
async function loadSession() {
  try {
    const res = await window.storage.get("session", false);
    return JSON.parse(res.value);
  } catch (e) {
    return null;
  }
}
async function saveSession(session) {
  await window.storage.set("session", JSON.stringify(session), false);
}
async function clearSession() {
  try { await window.storage.delete("session", false); } catch (e) { /* already gone */ }
}

async function downloadApplePass(ticketNumber, token) {
  const res = await fetch(`${API_BASE}/tickets/${ticketNumber}/apple-pass`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ticketNumber}.pkpass`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function openGoogleWalletLink(ticketNumber, token) {
  const data = await apiFetch(`/tickets/${ticketNumber}/google-wallet-link`, { token });
  window.open(data.url, "_blank");
}

function avgRating(reviews) {
  if (!reviews || reviews.length === 0) return null;
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
}

/* ---------------------------------------------------------------
   FAKE QR — purely visual; the real backend issues the actual
   unique ticket_number this is generated from
----------------------------------------------------------------*/
function seededGrid(seedStr, size) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const grid = [];
  for (let r = 0; r < size; r++) {
    const row = [];
    for (let c = 0; c < size; c++) row.push(rand() > 0.56);
    grid.push(row);
  }
  return grid;
}

function FakeQR({ value, size = 128 }) {
  const modules = 21;
  const grid = useMemo(() => seededGrid(String(value), modules), [value]);
  const cell = size / modules;
  const finder = (x, y) => (
    <g key={`${x}-${y}`}>
      <rect x={x * cell} y={y * cell} width={cell * 7} height={cell * 7} fill={T.ink} />
      <rect x={(x + 1) * cell} y={(y + 1) * cell} width={cell * 5} height={cell * 5} fill="#fff" />
      <rect x={(x + 2) * cell} y={(y + 2) * cell} width={cell * 3} height={cell * 3} fill={T.ink} />
    </g>
  );
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ borderRadius: 8 }}>
      <rect width={size} height={size} fill="#fff" />
      {grid.map((row, r) => row.map((on, c) => {
        const inFinderZone = (r < 8 && c < 8) || (r < 8 && c > modules - 9) || (r > modules - 9 && c < 8);
        if (!on || inFinderZone) return null;
        return <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill={T.ink} />;
      }))}
      {finder(0, 0)}{finder(modules - 7, 0)}{finder(0, modules - 7)}
    </svg>
  );
}

/* ---------------------------------------------------------------
   SHARED UI BITS
----------------------------------------------------------------*/
function StubDivider({ bg = T.ink }) {
  return (
    <div style={{ position: "relative", height: 1 }}>
      <div style={{ position: "absolute", left: -14, top: -10, width: 20, height: 20, borderRadius: "50%", background: bg }} />
      <div style={{ position: "absolute", right: -14, top: -10, width: 20, height: 20, borderRadius: "50%", background: bg }} />
      <div style={{ borderTop: "2px dashed #3a3564", margin: "0 6px" }} />
    </div>
  );
}

function Pill({ children, active, onClick }) {
  return (
    <button onClick={onClick} className="px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors"
      style={{ background: active ? T.gold : T.surface, color: active ? T.ink : T.muted, border: `1px solid ${active ? T.gold : "#332e5c"}` }}>
      {children}
    </button>
  );
}

function CategoryTag({ category, accent }) {
  return (
    <span className="text-xs font-semibold px-2.5 py-1 rounded-full moya-mono"
      style={{ color: accent, background: `${accent}22`, border: `1px solid ${accent}55` }}>
      {(category || "").toUpperCase()}
    </span>
  );
}

function PrimaryButton({ children, onClick, disabled, style = {}, full }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`font-semibold rounded-xl px-6 py-3 transition-transform active:scale-[0.98] ${full ? "w-full" : ""}`}
      style={{ background: disabled ? "#4a4470" : T.gold, color: T.ink, opacity: disabled ? 0.6 : 1, cursor: disabled ? "not-allowed" : "pointer", ...style }}>
      {children}
    </button>
  );
}

function FullLoader({ label }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <Loader2 className="moya-spin" size={24} color={T.gold} />
      <span className="text-sm" style={{ color: T.muted }}>{label}</span>
    </div>
  );
}

function StarRow({ value, onChange, size = 16, readOnly = false }) {
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

/* ---------------------------------------------------------------
   CONNECTION ERROR SCREEN
----------------------------------------------------------------*/
function BackendUnreachable({ onRetry }) {
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

/* ---------------------------------------------------------------
   AUTH GATE — registration + OTP verification against the real API
----------------------------------------------------------------*/
function AuthGate({ onDone }) {
  const [step, setStep] = useState("form");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState(null);
  const [entered, setEntered] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const sendCode = async () => {
    if (!name.trim() || !phone.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/auth/register", { method: "POST", body: { name: name.trim(), phone: phone.trim() } });
      setCode(res.devCode); // the real backend generated this — see api/src/routes/auth.js
      setStep("otp");
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch("/auth/verify", { method: "POST", body: { name: name.trim(), phone: phone.trim(), code: entered.trim() } });
      await saveSession(res);
      onDone(res);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="moya-root min-h-screen flex items-center justify-center px-5" style={{ background: T.ink }}>
      {FONTS}
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center moya-display font-bold" style={{ background: T.gold, color: T.ink }}>M</div>
          <span className="moya-display text-2xl font-bold" style={{ color: T.text }}>moya</span>
        </div>
        <div className="rounded-2xl p-6" style={{ background: T.surface, border: "1px solid #2a2652" }}>
          {step === "form" ? (
            <>
              <h2 className="moya-display font-bold text-lg mb-1" style={{ color: T.text }}>Create your account</h2>
              <p className="text-xs mb-5" style={{ color: T.muted }}>We'll text you a one-time code to verify your number.</p>
              <div className="flex flex-col gap-3 mb-5">
                <div>
                  <label className="text-xs" style={{ color: T.muted }}>Full name</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aline Uwase"
                    className="w-full mt-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: T.surface2, color: T.text }} />
                </div>
                <div>
                  <label className="text-xs" style={{ color: T.muted }}>Mobile number</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="078 000 0000"
                    className="w-full mt-1 rounded-lg px-3 py-2.5 text-sm outline-none" style={{ background: T.surface2, color: T.text }} />
                </div>
              </div>
              {error && <p className="text-xs mb-3" style={{ color: T.coral }}>{error}</p>}
              <PrimaryButton full disabled={!name.trim() || !phone.trim() || busy} onClick={sendCode}>
                {busy ? "Sending code..." : "Send verification code"}
              </PrimaryButton>
            </>
          ) : (
            <>
              <h2 className="moya-display font-bold text-lg mb-1" style={{ color: T.text }}>Enter your code</h2>
              <p className="text-xs mb-4" style={{ color: T.muted }}>Sent to {phone}</p>
              {code && (
                <div className="rounded-lg p-3 mb-4 text-xs" style={{ background: `${T.gold}18`, border: `1px solid ${T.gold}55`, color: T.text }}>
                  Dev mode — code returned by backend (no SMS sent): <span className="moya-mono font-semibold">{code}</span>.
                </div>
              )}
              <input value={entered} onChange={(e) => setEntered(e.target.value)} placeholder="6-digit code" maxLength={6}
                className="w-full mb-2 rounded-lg px-3 py-2.5 text-sm outline-none moya-mono tracking-widest text-center"
                style={{ background: T.surface2, color: T.text }} />
              {error && <p className="text-xs mb-3" style={{ color: T.coral }}>{error}</p>}
              <PrimaryButton full disabled={entered.length < 6 || busy} onClick={verify} style={{ marginTop: 8 }}>
                {busy ? "Verifying..." : "Verify & continue"}
              </PrimaryButton>
              <button onClick={() => setStep("form")} className="w-full text-center text-xs mt-4" style={{ color: T.muted }}>
                Use a different number
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   HEADER / NAV
----------------------------------------------------------------*/
function Header({ mode, setMode, setView, user, onLogout }) {
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

/* ---------------------------------------------------------------
   EVENT CARD
----------------------------------------------------------------*/
function EventCard({ event, onOpen }) {
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

/* ---------------------------------------------------------------
   BROWSE VIEW
----------------------------------------------------------------*/
function BrowseView({ events, onOpen }) {
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("All");
  const categories = ["All", ...Array.from(new Set(events.map((e) => e.category)))];
  const filtered = events.filter((e) => {
    const matchesCat = cat === "All" || e.category === cat;
    const matchesQuery = e.title.toLowerCase().includes(query.toLowerCase()) || e.venue.toLowerCase().includes(query.toLowerCase());
    return matchesCat && matchesQuery;
  });
  return (
    <div className="px-5 sm:px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="moya-display font-extrabold text-3xl sm:text-4xl mb-2" style={{ color: T.text }}>What's on in Kigali</h1>
        <p className="text-sm" style={{ color: T.muted }}>Live from your local Postgres database — open this in two tabs and try buying the last ticket in both.</p>
      </div>
      <div className="flex items-center gap-2 mb-5 rounded-xl px-4 py-3" style={{ background: T.surface, border: "1px solid #2a2652" }}>
        <Search size={18} color={T.muted} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search events or venues..."
          className="bg-transparent outline-none flex-1 text-sm" style={{ color: T.text }} />
      </div>
      <div className="flex gap-2 overflow-x-auto moya-scroll pb-2 mb-8">
        {categories.map((c) => <Pill key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Pill>)}
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-20" style={{ color: T.muted }}>No events match that search.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((e) => <EventCard key={e.id} event={e} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   SEAT PICKER — seats come straight from the event-detail API call
----------------------------------------------------------------*/
function SeatPicker({ ticketType, selected, setSelected, maxSeats = 8 }) {
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

/* ---------------------------------------------------------------
   EVENT DETAIL VIEW — fetches its own fresh copy (incl. seats)
----------------------------------------------------------------*/
function DetailView({ eventId, onBack, onBuy }) {
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

/* ---------------------------------------------------------------
   CHECKOUT — single atomic call to POST /api/orders/reserve
----------------------------------------------------------------*/
const PAYMENT_METHODS = [
  { id: "momo", label: "MTN MoMo", sub: "Mobile money", icon: Smartphone },
  { id: "airtel", label: "Airtel Money", sub: "Mobile money", icon: Smartphone },
  { id: "card", label: "Visa / Mastercard", sub: "Debit or credit", icon: CreditCard },
  { id: "wallet", label: "Moya Wallet", sub: "Balance: 12,000 RWF", icon: Wallet },
];
function CheckoutView({ order, token, onBack, onPaid }) {
  const [method, setMethod] = useState("momo");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handlePay = async () => {
    setProcessing(true);
    setError(null);
    await new Promise((r) => setTimeout(r, 700)); // simulate gateway latency
    try {
      const result = await apiFetch("/orders/reserve", {
        method: "POST",
        token,
        body: {
          ticketTypeId: order.ticket.id,
          qty: order.qty,
          seatCodes: order.seatCodes || undefined,
          paymentMethod: method,
        },
      });
      onPaid(result);
    } catch (e) {
      setError(
        e.code === "sold_out" ? "Someone else just bought the last one — this ticket type is now sold out."
        : e.code === "seats_taken" ? e.message
        : e.message
      );
    }
    setProcessing(false);
  };

  return (
    <div className="max-w-xl mx-auto px-5 sm:px-8 py-8 pb-32">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-6" style={{ color: T.muted }}><ArrowLeft size={15} /> Back to event</button>
      <h1 className="moya-display font-extrabold text-2xl mb-6" style={{ color: T.text }}>Checkout</h1>
      <div className="rounded-xl p-4 mb-6" style={{ background: T.surface, border: "1px solid #2a2652" }}>
        <div className="flex justify-between text-sm mb-1"><span style={{ color: T.muted }}>{order.event.title}</span><span style={{ color: T.text }}>x{order.qty}</span></div>
        <div className="flex justify-between text-sm mb-3" style={{ color: T.muted }}>
          <span>{order.ticket.name}{order.seatCodes ? ` (${order.seatCodes.slice().sort().join(", ")})` : ""}</span>
          <span>{fmtRWF(order.ticket.price)} each</span>
        </div>
        <StubDivider bg={T.surface} />
        <div className="flex justify-between font-semibold mt-3"><span style={{ color: T.text }}>Total</span><span className="moya-mono" style={{ color: T.gold }}>{fmtRWF(order.total)}</span></div>
      </div>
      <h3 className="moya-display font-bold text-base mb-3" style={{ color: T.text }}>Pay with</h3>
      <div className="flex flex-col gap-2 mb-6">
        {PAYMENT_METHODS.map((m) => (
          <button key={m.id} onClick={() => setMethod(m.id)} className="flex items-center justify-between rounded-xl px-4 py-3 transition-colors"
            style={{ background: method === m.id ? T.surface2 : T.surface, border: `1.5px solid ${method === m.id ? T.gold : "#2a2652"}` }}>
            <div className="flex items-center gap-3">
              <m.icon size={18} color={method === m.id ? T.gold : T.muted} />
              <div className="text-left"><div className="text-sm font-medium" style={{ color: T.text }}>{m.label}</div><div className="text-xs" style={{ color: T.muted }}>{m.sub}</div></div>
            </div>
            {method === m.id && <Check size={16} color={T.gold} />}
          </button>
        ))}
      </div>
      {error && (
        <div className="flex items-start gap-2 rounded-xl p-3 mb-4" style={{ background: `${T.coral}18`, border: `1px solid ${T.coral}55` }}>
          <AlertTriangle size={16} color={T.coral} style={{ flexShrink: 0, marginTop: 2 }} />
          <span className="text-sm" style={{ color: T.text }}>{error}</span>
        </div>
      )}
      <div className="fixed bottom-0 left-0 right-0 px-5 sm:px-8 py-4" style={{ background: `${T.ink}f2`, borderTop: "1px solid #2a2652", backdropFilter: "blur(8px)" }}>
        <div className="max-w-xl mx-auto">
          <PrimaryButton onClick={handlePay} disabled={processing} full>{processing ? "Confirming with the backend..." : `Pay ${fmtRWF(order.total)}`}</PrimaryButton>
          <p className="text-center text-xs mt-2" style={{ color: T.muted }}>Simulated payment charge — the order and inventory are real, in your local database.</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   ADD TO WALLET — real Apple/Google Wallet integration, once the
   backend has real certs and keys configured (see the READMEs under
   api/certs in the backend project). Until then, these surface the
   backend's own "not configured yet" message rather than failing
   silently or pretending to work.
----------------------------------------------------------------*/
function AddToWalletButtons({ ticketNumber, token }) {
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

/* ---------------------------------------------------------------
   A single ticket-stub card — reused for confirmation + wallet
----------------------------------------------------------------*/
function TicketStub({ event, ticketTypeName, ticketNumber, seatCode }) {
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

/* ---------------------------------------------------------------
   POST-PURCHASE CONFIRMATION — shows every ticket the order issued
----------------------------------------------------------------*/
function ConfirmationView({ event, result, token, onDone }) {
  const tickets = result.tickets || [];
  return (
    <div className="max-w-md mx-auto px-5 sm:px-8 py-10">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ background: `${T.gold}22` }}><Check size={26} color={T.gold} /></div>
        <h1 className="moya-display font-extrabold text-2xl" style={{ color: T.text }}>You're going!</h1>
        <p className="text-sm mt-1" style={{ color: T.muted }}>{tickets.length} ticket{tickets.length !== 1 ? "s" : ""} saved to your account — issued by the backend.</p>
      </div>
      <div className="flex flex-col gap-4">
        {tickets.map((t) => (
          <div key={t.ticket_number}>
            <TicketStub event={event} ticketTypeName={event.ticketTypes.find((tt) => tt.id === result.order.ticket_type_id)?.name} ticketNumber={t.ticket_number} seatCode={t.seat_code} />
            <AddToWalletButtons ticketNumber={t.ticket_number} token={token} />
          </div>
        ))}
      </div>
      <div className="flex gap-3 mt-6">
        <PrimaryButton onClick={onDone} full>Back to Discover</PrimaryButton>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------
   MY TICKETS (WALLET)
----------------------------------------------------------------*/
function WalletView({ token, user }) {
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

/* ---------------------------------------------------------------
   GATE SCANNER
----------------------------------------------------------------*/
function ScannerView({ token }) {
  const [input, setInput] = useState("");
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);

  const runCheck = async () => {
    if (!input.trim()) return;
    setChecking(true);
    setResult(null);
    try {
      const res = await apiFetch(`/tickets/${input.trim()}/checkin`, { method: "POST", token });
      setResult({ ok: true, checkedInAt: res.checkedInAt });
    } catch (e) {
      setResult({ ok: false, reason: e.code || "not_found" });
    }
    setChecking(false);
  };

  return (
    <div className="px-5 sm:px-8 py-8 max-w-lg mx-auto">
      <h1 className="moya-display font-extrabold text-2xl mb-2" style={{ color: T.text }}>Gate scanner</h1>
      <p className="text-sm mb-6" style={{ color: T.muted }}>Paste a ticket number from My Tickets to simulate a gate scan against the real backend.</p>
      <div className="flex gap-2 mb-4">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="MOYA-EV1-1234"
          className="flex-1 rounded-xl px-4 py-3 text-sm outline-none moya-mono" style={{ background: T.surface, color: T.text, border: "1px solid #2a2652" }} />
        <PrimaryButton onClick={runCheck} disabled={checking}>{checking ? "..." : <ScanLine size={18} />}</PrimaryButton>
      </div>
      {result && (
        <div className="rounded-xl p-4" style={{ background: result.ok ? `${T.green}18` : `${T.red}18`, border: `1px solid ${result.ok ? T.green : T.red}55` }}>
          {result.ok ? (
            <div className="flex items-center gap-2"><Check size={18} color={T.green} /><span className="text-sm font-medium" style={{ color: T.text }}>Valid — checked in</span></div>
          ) : result.reason === "duplicate" ? (
            <div className="flex items-center gap-2"><AlertTriangle size={18} color={T.red} /><span className="text-sm font-medium" style={{ color: T.text }}>Already used. Possible duplicate/screenshot.</span></div>
          ) : (
            <div className="flex items-center gap-2"><X size={18} color={T.red} /><span className="text-sm font-medium" style={{ color: T.text }}>Ticket number not found.</span></div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------
   ORGANIZER DASHBOARD
----------------------------------------------------------------*/
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

function CreateEventModal({ token, onClose, onCreated }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Music");
  const [price, setPrice] = useState("");
  const [capacity, setCapacity] = useState("50");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch("/events", { method: "POST", token, body: { title, category, price: Number(price) || 0, capacity: Number(capacity) || 50 } });
      onCreated();
      onClose();
    } catch (e) {
      setError(e.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-5" style={{ background: "#000000aa" }}>
      <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: T.surface, border: "1px solid #332e5c" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="moya-display font-bold text-lg" style={{ color: T.text }}>New event</h3>
          <button onClick={onClose}><X size={18} color={T.muted} /></button>
        </div>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs" style={{ color: T.muted }}>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Rooftop Jazz Evening"
              className="w-full mt-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: T.surface2, color: T.text }} />
          </div>
          <div>
            <label className="text-xs" style={{ color: T.muted }}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full mt-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: T.surface2, color: T.text }}>
              {CATEGORIES_FALLBACK.filter((c) => c !== "All").map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs" style={{ color: T.muted }}>Price (RWF)</label>
              <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="10000" type="number" className="w-full mt-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: T.surface2, color: T.text }} />
            </div>
            <div>
              <label className="text-xs" style={{ color: T.muted }}>Tickets available</label>
              <input value={capacity} onChange={(e) => setCapacity(e.target.value)} type="number" className="w-full mt-1 rounded-lg px-3 py-2 text-sm outline-none" style={{ background: T.surface2, color: T.text }} />
            </div>
          </div>
        </div>
        {error && <p className="text-xs mt-3" style={{ color: T.coral }}>{error}</p>}
        <PrimaryButton full style={{ marginTop: 20 }} disabled={!title || saving} onClick={submit}>{saving ? "Publishing..." : "Publish event"}</PrimaryButton>
        <p className="text-center text-xs mt-3" style={{ color: T.muted }}>This actually saves to your local Postgres database.</p>
      </div>
    </div>
  );
}

function OrganizerDashboard({ token, events, loading, onRefresh }) {
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

/* ---------------------------------------------------------------
   ROOT APP
----------------------------------------------------------------*/
export default function MoyaApp() {
  const [sessionLoading, setSessionLoading] = useState(true);
  const [session, setSession] = useState(null); // { token, user }
  const [mode, setMode] = useState("attendee");
  const [view, setView] = useState("browse");
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [order, setOrder] = useState(null);
  const [confirmResult, setConfirmResult] = useState(null);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [backendDown, setBackendDown] = useState(false);
  const [orgSubView, setOrgSubView] = useState("dashboard");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await loadSession();
      if (!cancelled) { setSession(s); setSessionLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const refreshEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const ev = await apiFetch("/events");
      setEvents(ev);
      setBackendDown(false);
    } catch (e) {
      setBackendDown(true);
    }
    setEventsLoading(false);
  }, []);

  useEffect(() => { refreshEvents(); }, [refreshEvents]);

  const handleLogout = async () => { await clearSession(); setSession(null); setMode("attendee"); setView("browse"); };
  const openEvent = (e) => { setSelectedEventId(e.id); setView("detail"); };
  const buy = (event, ticket, qty, total, seatCodes) => { setOrder({ event, ticket, qty, total, seatCodes }); setView("checkout"); };
  const paid = (result) => { setConfirmResult(result); setView("ticket"); refreshEvents(); };
  const doneWithTicket = () => { setView("browse"); setOrder(null); setConfirmResult(null); setSelectedEventId(null); };

  if (backendDown) return <BackendUnreachable onRetry={refreshEvents} />;
  if (sessionLoading || eventsLoading) {
    return <div className="moya-root min-h-screen" style={{ background: T.ink }}>{FONTS}<FullLoader label="Connecting to your local backend..." /></div>;
  }
  if (!session) return <AuthGate onDone={(s) => setSession(s)} />;

  return (
    <div className="moya-root min-h-screen" style={{ background: T.ink }}>
      {FONTS}
      <Header mode={mode} setMode={(m) => { setMode(m); setOrgSubView("dashboard"); }} setView={setView} user={session.user} onLogout={handleLogout} />

      {mode === "attendee" && view === "browse" && <BrowseView events={events} onOpen={openEvent} />}
      {mode === "attendee" && view === "detail" && selectedEventId && (
        <DetailView eventId={selectedEventId} onBack={() => setView("browse")} onBuy={buy} />
      )}
      {mode === "attendee" && view === "checkout" && order && (
        <CheckoutView order={order} token={session.token} onBack={() => setView("detail")} onPaid={paid} />
      )}
      {mode === "attendee" && view === "ticket" && confirmResult && order && (
        <ConfirmationView event={order.event} result={confirmResult} token={session.token} onDone={doneWithTicket} />
      )}

      {mode === "wallet" && <WalletView token={session.token} user={session.user} />}

      {mode === "organizer" && (
        <>
          <div className="px-5 sm:px-8 pt-6 max-w-6xl mx-auto flex gap-2">
            <Pill active={orgSubView === "dashboard"} onClick={() => setOrgSubView("dashboard")}>Dashboard</Pill>
            <Pill active={orgSubView === "scanner"} onClick={() => setOrgSubView("scanner")}>Gate scanner</Pill>
          </div>
          {orgSubView === "dashboard"
            ? <OrganizerDashboard token={session.token} events={events} loading={eventsLoading} onRefresh={refreshEvents} />
          : <ScannerView token={session.token} />}
        </>
      )}
    </div>
  );
}
