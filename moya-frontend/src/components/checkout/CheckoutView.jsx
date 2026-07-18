import { useState } from "react";
import { ArrowLeft, Smartphone, CreditCard, Wallet, Check, AlertTriangle } from "lucide-react";
import { T } from "../../theme.js";
import { StubDivider, PrimaryButton } from "../shared/ui.jsx";
import { apiFetch } from "../../api.js";

function fmtRWF(n) { return n === 0 ? "Free" : `${Number(n).toLocaleString()} RWF`; }

const PAYMENT_METHODS = [
  { id: "momo", label: "MTN MoMo", sub: "Mobile money", icon: Smartphone },
  { id: "airtel", label: "Airtel Money", sub: "Mobile money", icon: Smartphone },
  { id: "card", label: "Visa / Mastercard", sub: "Debit or credit", icon: CreditCard },
  { id: "wallet", label: "Moya Wallet", sub: "Balance: 12,000 RWF", icon: Wallet },
];

export default function CheckoutView({ order, token, onBack, onPaid }) {
  const [method, setMethod] = useState("momo");
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handlePay = async () => {
    setProcessing(true);
    setError(null);
    await new Promise((r) => setTimeout(r, 700)); // simulate gateway latency
    try {
      // Step 1: Reserve the order
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
      const orderId = result.order.id;

      // Step 2: Initiate payment
      let paymentData = null;
      try {
        paymentData = await apiFetch("/payments/initiate", {
          method: "POST",
          token,
          body: { orderId },
        });
      } catch (payErr) {
        if (payErr.status === 501) {
          // Flutterwave not configured — fall back to direct confirmation
          onPaid(result);
          return;
        }
        throw payErr;
      }

      // Step 3: Redirect to Flutterwave if paymentLink returned
      if (paymentData && paymentData.paymentLink) {
        window.location.href = paymentData.paymentLink;
        return;
      }

      // Fallback: no paymentLink in response, treat as confirmed
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
