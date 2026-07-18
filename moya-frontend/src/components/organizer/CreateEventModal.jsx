import { useState } from "react";
import { X } from "lucide-react";
import { T } from "../../theme.js";
import { PrimaryButton } from "../shared/ui.jsx";
import { apiFetch } from "../../api.js";

const CATEGORIES_FALLBACK = ["Music", "Business", "Comedy", "Sports"];

export default function CreateEventModal({ token, onClose, onCreated }) {
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
              {CATEGORIES_FALLBACK.map((c) => <option key={c}>{c}</option>)}
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
