import React, { useEffect, useRef, useState } from "react";
import {
  getStoredSectors,
  getStoredMapSystems,
  getStoredMaterialTypes,
  type StoredSectorSummary,
  type StoredMapSystem,
  type StoredMaterialTypeSummary,
} from "../../api/universe/universe";
import SearchSuggestionPicker from "../common/SearchSuggestionPicker";
import RmBrowserFactionPicker from "./RmBrowserFactionPicker";
import { BTN } from "../../utils/ui";

export type RmBrowserFilters = {
  factions: string[];
  sectorUid: string | null;
  systemUid: string | null;
  typeUid: string | null;
};

type Props = {
  filters: RmBrowserFilters;
  onChange: (next: RmBrowserFilters) => void;
  onSearch: () => void;
  loading: boolean;
};

const RmBrowserFilterBar: React.FC<Props> = ({ filters, onChange, onSearch, loading }) => {
  const [sectors, setSectors] = useState<StoredSectorSummary[]>([]);
  const [systems, setSystems] = useState<StoredMapSystem[]>([]);
  const [materialTypes, setMaterialTypes] = useState<StoredMaterialTypeSummary[]>([]);

  const [sectorQuery, setSectorQuery] = useState("");
  const [showSectorSuggestions, setShowSectorSuggestions] = useState(false);

  const [systemQuery, setSystemQuery] = useState("");
  const [showSystemSuggestions, setShowSystemSuggestions] = useState(false);

  const [typeQuery, setTypeQuery] = useState("");
  const [showTypeSuggestions, setShowTypeSuggestions] = useState(false);

  const sectorsLoaded = useRef(false);
  const systemsLoaded = useRef(false);
  const typesLoaded = useRef(false);

  function ensureSectorsLoaded() {
    if (sectorsLoaded.current) return;
    sectorsLoaded.current = true;
    getStoredSectors()
      .then((res) => setSectors(res.data ?? []))
      .catch(() => {});
  }

  function ensureSystemsLoaded() {
    if (systemsLoaded.current) return;
    systemsLoaded.current = true;
    getStoredMapSystems()
      .then((res) => setSystems(res.data ?? []))
      .catch(() => {});
  }

  function ensureTypesLoaded() {
    if (typesLoaded.current) return;
    typesLoaded.current = true;
    getStoredMaterialTypes()
      .then((res) => setMaterialTypes(res.data ?? []))
      .catch(() => {});
  }

  const filteredSectors = sectorQuery.trim()
    ? sectors.filter((s) =>
        (s.name ?? "").toLowerCase().includes(sectorQuery.toLowerCase()) ||
        s.uid.includes(sectorQuery)
      )
    : sectors.slice(0, 20);

  const filteredSystems = systemQuery.trim()
    ? systems.filter((s) =>
        (s.name ?? "").toLowerCase().includes(systemQuery.toLowerCase()) ||
        (s.uid ?? "").includes(systemQuery)
      ).slice(0, 30)
    : [];

  const filteredTypes = typeQuery.trim()
    ? materialTypes.filter((t) =>
        (t.name ?? "").toLowerCase().includes(typeQuery.toLowerCase())
      )
    : materialTypes;

  function selectSector(sector: StoredSectorSummary) {
    setSectorQuery(sector.name ?? sector.uid);
    onChange({ ...filters, sectorUid: sector.uid, systemUid: null });
    setSystemQuery("");
  }

  function clearSector() {
    setSectorQuery("");
    onChange({ ...filters, sectorUid: null });
  }

  function selectSystem(system: StoredMapSystem) {
    setSystemQuery(system.name ?? system.uid ?? "");
    onChange({ ...filters, systemUid: system.uid ?? null });
  }

  function clearSystem() {
    setSystemQuery("");
    onChange({ ...filters, systemUid: null });
  }

  function selectType(type: StoredMaterialTypeSummary) {
    setTypeQuery(type.name ?? type.uid);
    onChange({ ...filters, typeUid: type.uid });
  }

  function clearType() {
    setTypeQuery("");
    onChange({ ...filters, typeUid: null });
  }

  useEffect(() => {
    if (!filters.sectorUid) setSectorQuery("");
  }, [filters.sectorUid]);

  useEffect(() => {
    if (!filters.systemUid) setSystemQuery("");
  }, [filters.systemUid]);

  useEffect(() => {
    if (!filters.typeUid) setTypeQuery("");
  }, [filters.typeUid]);

  const canSearch = filters.factions.length > 0;

  return (
    <div className="bg-white/[0.04] border border-white/[0.08] rounded-lg p-4 mb-5 flex flex-col gap-[14px]">
      <div className="flex items-center gap-3 flex-wrap">
        <label className="small opacity-60 min-w-[52px] shrink-0">Factions</label>
        <RmBrowserFactionPicker
          selected={filters.factions}
          onChange={(factions) => onChange({ ...filters, factions })}
          disabled={loading}
        />
      </div>

      <div className="flex items-end gap-3 flex-wrap max-[767px]:flex-col max-[767px]:items-stretch">
        <div className="flex flex-col gap-1 flex-1 min-w-[160px] max-[767px]:min-w-0">
          <label className="small opacity-60">Sector</label>
          <div className="relative flex items-center [&>:first-child]:flex-1">
            <SearchSuggestionPicker
              value={sectorQuery}
              onChange={(v) => {
                setSectorQuery(v);
                if (!v) onChange({ ...filters, sectorUid: null });
              }}
              onFocus={ensureSectorsLoaded}
              placeholder="All sectors"
              suggestions={filteredSectors}
              showSuggestions={showSectorSuggestions}
              onShowSuggestions={setShowSectorSuggestions}
              getKey={(s, i) => s.uid ?? String(i)}
              isActive={(s) => s.uid === filters.sectorUid}
              onSelect={selectSector}
              renderSuggestion={(s) => (
                <>
                  <strong>{s.name ?? s.uid}</strong>
                  <span className="small">{s.uid}</span>
                </>
              )}
            />
            {filters.sectorUid && (
              <button type="button" className="absolute right-[6px] top-1/2 -translate-y-1/2 bg-none border-none text-white/40 cursor-pointer text-[1.1rem] leading-none px-1 hover:text-white/80 font-tektur" onClick={clearSector} title="Clear sector">
                ×
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[160px] max-[767px]:min-w-0">
          <label className="small opacity-60">System</label>
          <div className="relative flex items-center [&>:first-child]:flex-1">
            <SearchSuggestionPicker
              value={systemQuery}
              onChange={(v) => {
                setSystemQuery(v);
                if (!v) onChange({ ...filters, systemUid: null });
                ensureSystemsLoaded();
              }}
              onFocus={ensureSystemsLoaded}
              placeholder="All systems"
              suggestions={filteredSystems}
              showSuggestions={showSystemSuggestions}
              onShowSuggestions={setShowSystemSuggestions}
              getKey={(s, i) => s.uid ?? String(i)}
              isActive={(s) => s.uid === filters.systemUid}
              onSelect={selectSystem}
              renderSuggestion={(s) => (
                <>
                  <strong>{s.name ?? s.uid ?? "Unknown"}</strong>
                  {s.sector_name && <span className="small">{s.sector_name}</span>}
                </>
              )}
            />
            {filters.systemUid && (
              <button type="button" className="absolute right-[6px] top-1/2 -translate-y-1/2 bg-none border-none text-white/40 cursor-pointer text-[1.1rem] leading-none px-1 hover:text-white/80 font-tektur" onClick={clearSystem} title="Clear system">
                ×
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[160px] max-[767px]:min-w-0">
          <label className="small opacity-60">Type</label>
          <div className="relative flex items-center [&>:first-child]:flex-1">
            <SearchSuggestionPicker
              value={typeQuery}
              onChange={(v) => {
                setTypeQuery(v);
                if (!v) onChange({ ...filters, typeUid: null });
                ensureTypesLoaded();
              }}
              onFocus={ensureTypesLoaded}
              placeholder="All types"
              suggestions={filteredTypes}
              showSuggestions={showTypeSuggestions}
              onShowSuggestions={setShowTypeSuggestions}
              getKey={(t) => t.uid}
              isActive={(t) => t.uid === filters.typeUid}
              onSelect={selectType}
              renderSuggestion={(t) => <strong>{t.name ?? t.uid}</strong>}
            />
            {filters.typeUid && (
              <button type="button" className="absolute right-[6px] top-1/2 -translate-y-1/2 bg-none border-none text-white/40 cursor-pointer text-[1.1rem] leading-none px-1 hover:text-white/80 font-tektur" onClick={clearType} title="Clear type">
                ×
              </button>
            )}
          </div>
        </div>

        <button
          type="button"
          className={BTN + " self-end shrink-0 whitespace-nowrap max-[767px]:w-full"}
          onClick={onSearch}
          disabled={loading || !canSearch}
        >
          {loading ? "Searching…" : "Search"}
        </button>
      </div>
    </div>
  );
};

export default RmBrowserFilterBar;
