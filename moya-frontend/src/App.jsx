import { useState, useEffect, useCallback } from "react";
import { T, FONTS } from "./theme.js";
import { loadSession, clearSession } from "./session.js";
import { apiFetch } from "./api.js";
import { FullLoader, Pill } from "./components/shared/ui.jsx";
import Header from "./components/shared/Header.jsx";
import BackendUnreachable from "./components/auth/BackendUnreachable.jsx";
import AuthGate from "./components/auth/AuthGate.jsx";
import BrowseView from "./components/events/BrowseView.jsx";
import DetailView from "./components/events/DetailView.jsx";
import CheckoutView from "./components/checkout/CheckoutView.jsx";
import ConfirmationView from "./components/checkout/ConfirmationView.jsx";
import PaymentReturn from "./components/checkout/PaymentReturn.jsx";
import WalletView from "./components/wallet/WalletView.jsx";
import OrganizerDashboard from "./components/organizer/OrganizerDashboard.jsx";
import ScannerView from "./components/scanner/ScannerView.jsx";

export default function App() {
  // Show PaymentReturn immediately for the /payment-return route
  if (window.location.pathname === "/payment-return") {
    return <PaymentReturn />;
  }

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
