import React, { useEffect, useRef, useState } from "react";
import { searchEntityTypes, type EntityTypeResult } from "../../api/market";

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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
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

  const clear = () => {
    onChange(null);
    setQuery("");
    setResults([]);
  };

  return (
    <div className="entity-type-picker" ref={containerRef}>
      <div className="entity-type-picker__input-wrap">
        {value?.image_url && (
          <img src={value.image_url} alt="" className="entity-type-picker__thumb" />
        )}
        <input
          type="text"
          className="input"
          value={query}
          placeholder={placeholder}
          onChange={(e) => { setQuery(e.target.value); if (value) onChange(null); }}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {value && (
          <button type="button" className="entity-type-picker__clear btn btn--ghost btn--sm" onClick={clear}>×</button>
        )}
      </div>
      {value && (
        <p className="entity-type-picker__selected-label muted small">
          {CATEGORY_LABELS[value.category] ?? value.category}: {value.name}
        </p>
      )}
      {loading && <p className="muted small">Searching…</p>}
      {open && results.length > 0 && (
        <ul className="entity-type-picker__dropdown">
          {results.map((r) => (
            <li key={`${r.category}:${r.uid}`} className="entity-type-picker__option" onMouseDown={() => select(r)}>
              {r.image_url && <img src={r.image_url} alt="" className="entity-type-picker__option-img" />}
              <span className="entity-type-picker__option-name">{r.name}</span>
              <span className="entity-type-picker__option-cat muted small">{CATEGORY_LABELS[r.category] ?? r.category}</span>
            </li>
          ))}
        </ul>
      )}
      {open && !loading && results.length === 0 && query.length >= 2 && (
        <p className="entity-type-picker__empty muted small">No matches found.</p>
      )}
    </div>
  );
};

export default EntityTypePicker;
