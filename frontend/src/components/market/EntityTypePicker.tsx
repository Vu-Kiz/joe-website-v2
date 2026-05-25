import React, { useEffect, useRef, useState } from "react";
import { searchEntityTypes, type EntityTypeResult } from "../../api/market/market";
import { BTN_GHOST, INPUT} from "../../utils/ui";

type Props = {
  value: EntityTypeResult | null;
  onChange: (v: EntityTypeResult | null) => void;
  placeholder?: string;
};

const CATEGORY_LABELS: Record<string, string> = {
  ship: "Ship", vehicle: "Vehicle", station: "Station", facility: "Facility",
  droid: "Droid", item: "Item", npc: "NPC", creature: "Creature",
  material: "Material", weapon: "Weapon",
};

const EntityTypePicker: React.FC<Props> = ({ value, onChange, placeholder = "Search entity type…" }) => {
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<EntityTypeResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setQuery(value.name);
  }, [value]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.length < 2) { setResults([]); return; }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await searchEntityTypes(query);
        setResults(res.results ?? []);
        setOpen(true);
      } catch { /* ignore */ } finally { setLoading(false); }
    }, 250);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (r: EntityTypeResult) => {
    onChange(r);
    setQuery(r.name);
    setOpen(false);
    setResults([]);
  };

  const clear = () => { onChange(null); setQuery(""); setResults([]); };

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-2">
        {value?.image_url && (
          <img src={value.image_url} alt="" className="rounded-[4px] h-8 w-8 object-contain shrink-0" />
        )}
        <input
          type="text"
          className={INPUT}
          value={query}
          placeholder={placeholder}
          onChange={(e) => { setQuery(e.target.value); if (value) onChange(null); }}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {value && (
          <button type="button" className={BTN_GHOST + " shrink-0"} onClick={clear}>×</button>
        )}
      </div>
      {value && (
        <p className="muted small mt-1">
          {CATEGORY_LABELS[value.category] ?? value.category}: {value.name}
        </p>
      )}
      {loading && <p className="muted small">Searching…</p>}
      {open && results.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-50 m-0 mt-1 max-h-[280px] overflow-y-auto rounded-[6px] border border-white/[0.12] bg-[#1a1a2e] p-[0.25rem_0] list-none">
          {results.map((r) => (
            <li
              key={`${r.category}:${r.uid}`}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/[0.07]"
              onMouseDown={() => select(r)}
            >
              {r.image_url && <img src={r.image_url} alt="" className="shrink-0 h-7 w-7 rounded-[3px] object-contain" />}
              <span className="flex-1 text-[0.875rem]">{r.name}</span>
              <span className="shrink-0 muted small">{CATEGORY_LABELS[r.category] ?? r.category}</span>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && results.length === 0 && query.length >= 2 && (
        <p className="muted small px-3 py-2">No matches found.</p>
      )}
    </div>
  );
};

export default EntityTypePicker;
