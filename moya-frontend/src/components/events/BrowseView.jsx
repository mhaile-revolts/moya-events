import { useState } from "react";
import { Search } from "lucide-react";
import { T } from "../../theme.js";
import { Pill } from "../shared/ui.jsx";
import EventCard from "./EventCard.jsx";

export default function BrowseView({ events, onOpen }) {
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
