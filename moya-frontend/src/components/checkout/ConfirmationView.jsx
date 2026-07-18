import React from "react";
import { Check } from "lucide-react";
import { T } from "../../theme.js";
import { PrimaryButton } from "../shared/ui.jsx";
import TicketStub from "./TicketStub.jsx";
import AddToWalletButtons from "./AddToWalletButtons.jsx";

export default function ConfirmationView({ event, result, token, onDone }) {
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
