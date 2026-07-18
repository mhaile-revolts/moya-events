import React from "react";
import { Check } from "lucide-react";
import { T, FONTS } from "../../theme.js";
import { PrimaryButton } from "../shared/ui.jsx";

export default function PaymentReturn() {
  const goToTickets = () => {
    window.location.href = "/";
  };

  return (
    <div className="moya-root min-h-screen flex items-center justify-center px-5" style={{ background: T.ink }}>
      {FONTS}
      <div className="max-w-sm text-center">
        <div className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: `${T.gold}22` }}>
          <Check size={26} color={T.gold} />
        </div>
        <h1 className="moya-display font-bold text-xl mb-2" style={{ color: T.text }}>Payment received</h1>
        <p className="text-sm mb-6" style={{ color: T.muted }}>
          Your tickets are on their way. Head to My Tickets to view them.
        </p>
        <PrimaryButton onClick={goToTickets}>Go to My Tickets</PrimaryButton>
      </div>
    </div>
  );
}
