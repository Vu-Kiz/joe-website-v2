import React, { useEffect, useMemo, useRef, useState } from "react";
import SlideTabNav, { type TabItem } from "../common/SlideTabNav";
import {
  getArchiveFactions,
  getArchivePlanet,
  getArchivePlanets,
  getArchiveSystems,
  getStoredSector,
  getStoredSectors,
  getStoredSystem,
  type ArchiveFactionSummary,
  type ArchivePlanetDetail,
  type ArchivePlanetSummary,
  type StoredMapSystem,
  type StoredSectorDetail,
  type StoredSectorSummary,
  type StoredSystemDetail,
} from "../../api/universe/universe";
import { BTN, BTN_SM, INPUT } from "../../utils/ui";
import ReportBugButton from "../support/ReportBugButton";

type ArchiveTab = "sectors" | "systems" | "planets" | "factions" | "system_ids";

type Props = {
  onBack: () => void;
  isAdmin?: boolean;
};

const tabLabels: Record<ArchiveTab, string> = {
  sectors: "Sectors",
  systems: "Systems",
  planets: "Planets",
  factions: "Factions",
  system_ids: "System Index",
};

const formatNumber = (value: number | null | undefined) =>
  typeof value === "number" ? value.toLocaleString() : "Unknown";

const formatPopulationChange = (current: number | null | undefined, previous: number | null | undefined) => {
  if (typeof current !== "number" || typeof previous !== "number") {
    return null;
  }

  const delta = current - previous;
  if (delta === 0) {
    return "No change";
  }

  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toLocaleString()}`;
};

const formatTimestamp = (value: string | null | undefined) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const formatSwcId = (value: string | null | undefined) => {
  if (!value) return "Unknown";
  const [prefix, rest] = String(value).split(":", 2);
  if (rest && /^\d+$/.test(prefix)) {
    return rest;
  }

  return String(value);
};

const buildSearchBlob = (values: Array<string | number | null | undefined>) =>
  values
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== "")
    .map((value) => String(value).toLowerCase())
    .join(" ");

const MemberGalacticArchivePanel: React.FC<Props> = ({ onBack, isAdmin = false }) => {
  const [activeTab, setActiveTab] = useState<ArchiveTab>("sectors");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sectors, setSectors] = useState<StoredSectorSummary[]>([]);
  const [systems, setSystems] = useState<StoredMapSystem[]>([]); // full list — always unfiltered, used by system_ids tab
  const [systemSearchResults, setSystemSearchResults] = useState<StoredMapSystem[] | null>(null); // non-null when Meilisearch results active
  const [planets, setPlanets] = useState<ArchivePlanetSummary[]>([]);
  const [factions, setFactions] = useState<ArchiveFactionSummary[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedSector, setSelectedSector] = useState<StoredSectorDetail | null>(null);
  const [selectedSystem, setSelectedSystem] = useState<StoredSystemDetail | null>(null);
  const [selectedPlanet, setSelectedPlanet] = useState<ArchivePlanetDetail | null>(null);
  const [selectedFaction, setSelectedFaction] = useState<ArchiveFactionSummary | null>(null);

  const [selectedSectorKey, setSelectedSectorKey] = useState<string | null>(null);
  const [selectedSystemKey, setSelectedSystemKey] = useState<string | null>(null);
  const [selectedPlanetKey, setSelectedPlanetKey] = useState<string | null>(null);
  const [showIdGaps, setShowIdGaps] = useState(false);
  const [selectedFactionKey, setSelectedFactionKey] = useState<string | null>(null);

  // Initial load per tab (no query)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        if (activeTab === "sectors" && sectors.length === 0) {
          const response = await getStoredSectors();
          if (cancelled) return;
          setSectors(response.data);
        }

        if ((activeTab === "systems" || activeTab === "system_ids") && systems.length === 0) {
          const response = await getArchiveSystems();
          if (cancelled) return;
          setSystems(response.data);
        }

        if (activeTab === "planets" && planets.length === 0) {
          const response = await getArchivePlanets();
          if (cancelled) return;
          setPlanets(response.data);
        }

        if (activeTab === "factions" && factions.length === 0) {
          const response = await getArchiveFactions();
          if (cancelled) return;
          setFactions(response.data);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Failed to load Galactic Archive.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [activeTab, factions.length, planets.length, sectors.length, systems.length]);

  // Debounced Meilisearch for systems and planets
  useEffect(() => {
    const needle = query.trim();

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!needle) {
      setSystemSearchResults(null);
      return;
    }

    searchTimerRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        if (activeTab === "systems" || activeTab === "system_ids") {
          const res = await getArchiveSystems(needle);
          setSystemSearchResults(res.data);
        }
        if (activeTab === "planets") {
          const res = await getArchivePlanets(needle);
          setPlanets(res.data);
        }
      } catch {
        // silently ignore search errors
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [query, activeTab]);

  const filteredSectors = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sectors;
    return sectors.filter((sector) =>
      buildSearchBlob([
        sector.uid,
        sector.name,
        sector.owner_name,
        sector.population,
        sector.known_systems,
      ]).includes(needle)
    );
  }, [query, sectors]);

  const filteredSystems = useMemo(() => {
    if (systemSearchResults !== null) return systemSearchResults;
    const needle = query.trim().toLowerCase();
    if (!needle) return systems;
    return systems.filter((system) =>
      buildSearchBlob([system.uid, system.name, system.sector_name, system.galx, system.galy]).includes(needle)
    );
  }, [query, systems, systemSearchResults]);

  const systemsByNumber = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? systems.filter((s) =>
          buildSearchBlob([(s.uid ?? "").split(":")[1], s.name, s.sector_name, s.galx, s.galy]).includes(needle)
        )
      : systems;
    return [...filtered].sort((a, b) => {
      const na = parseInt((a.uid ?? "").split(":")[1] ?? "", 10);
      const nb = parseInt((b.uid ?? "").split(":")[1] ?? "", 10);
      if (isNaN(na) && isNaN(nb)) return 0;
      if (isNaN(na)) return 1;
      if (isNaN(nb)) return -1;
      return na - nb;
    });
  }, [query, systems]);

  const idGaps = useMemo(() => {
    const ids = systems
      .map((s) => parseInt((s.uid ?? "").split(":")[1] ?? "", 10))
      .filter((n) => !isNaN(n))
      .sort((a, b) => a - b);
    const gaps: Array<{ start: number; end: number }> = [];
    for (let i = 1; i < ids.length; i++) {
      if (ids[i] - ids[i - 1] > 1) {
        gaps.push({ start: ids[i - 1] + 1, end: ids[i] - 1 });
      }
    }
    const needle = query.trim();
    if (!needle) return gaps;
    return gaps.filter((g) => {
      for (let n = g.start; n <= g.end; n++) {
        if (String(n).includes(needle)) return true;
      }
      return false;
    });
  }, [query, systems]);

  const filteredPlanets = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return planets;
    return planets.filter((planet) =>
      buildSearchBlob([
        planet.uid,
        planet.identifier,
        planet.name,
        planet.system_name,
        planet.sector_name,
        planet.owner_name,
        planet.planet_type_name,
      ]).includes(needle)
    );
  }, [planets, query]);

  const filteredFactions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return factions;
    return factions.filter((faction) =>
      buildSearchBlob([
        faction.name,
        faction.abbreviation,
        faction.swc_uid,
      ]).includes(needle)
    );
  }, [factions, query]);

  const handleSelectSector = async (sector: StoredSectorSummary) => {
    const key = sector.uid;
    if (!key) return;
    setSelectedSectorKey(key);
    setSelectedSector(null);
    setError(null);
    try {
      setLoading(true);
      const response = await getStoredSector(key);
      setSelectedSector(response.data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load sector detail.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSystem = async (system: StoredMapSystem) => {
    const key = system.uid ?? system.name;
    if (!key) return;
    setSelectedSystemKey(key);
    setSelectedSystem(null);
    setError(null);
    try {
      setLoading(true);
      const response = await getStoredSystem(key);
      setSelectedSystem(response.data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load system detail.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlanet = async (planet: ArchivePlanetSummary) => {
    const key = planet.identifier ?? planet.uid ?? planet.name;
    if (!key) return;
    setSelectedPlanetKey(key);
    setSelectedPlanet(null);
    setError(null);
    try {
      setLoading(true);
      const response = await getArchivePlanet(key);
      setSelectedPlanet(response.data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load planet detail.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFaction = (faction: ArchiveFactionSummary) => {
    setSelectedFactionKey(faction.owner_uid ?? (faction.swc_uid != null ? `20:${faction.swc_uid}` : String(faction.id)));
    setSelectedFaction(faction);
    setError(null);
  };

  const currentResultsCount = {
    sectors: filteredSectors.length,
    systems: filteredSystems.length,
    planets: filteredPlanets.length,
    factions: filteredFactions.length,
    system_ids: systemsByNumber.length,
  }[activeTab];

  const hasSelection =
    (activeTab === "sectors" && !!selectedSector) ||
    ((activeTab === "systems" || activeTab === "system_ids") && !!selectedSystem) ||
    (activeTab === "planets" && !!selectedPlanet) ||
    (activeTab === "factions" && !!selectedFaction);

  const clearSelection = () => {
    setSelectedSector(null);
    setSelectedSectorKey(null);
    setSelectedSystem(null);
    setSelectedSystemKey(null);
    setSelectedPlanet(null);
    setSelectedPlanetKey(null);
    setSelectedFaction(null);
    setSelectedFactionKey(null);
  };

  const archiveItemCls = (active: boolean) =>
    "grid gap-1 text-left text-inherit border rounded-[14px] p-[12px_14px] cursor-pointer transition-[border-color,background,transform] duration-200 hover:border-[rgba(255,176,0,0.6)] hover:bg-[rgba(255,176,0,0.11)] hover:-translate-y-px " +
    (active
      ? "border-[rgba(255,176,0,0.92)] bg-[rgba(255,176,0,0.14)] shadow-[inset_0_0_0_1px_rgba(255,176,0,0.2)]"
      : "border-[rgba(255,176,0,0.28)] bg-[rgba(255,176,0,0.06)]");

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <button className={BTN} type="button" onClick={onBack}>
          Back to Overview
        </button>
        <ReportBugButton toolKey="galactic_archive" toolLabel="Galactic Archive" />
      </div>

      <div className="panel grid gap-4">
        <div className="grid gap-3">
          <div>
            <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
              <h2 className="h2 m-0">Galactic Archive</h2>
            </div>
            <p className="small" style={{ margin: 0 }}>
              Browse pulled SWC reference data for sectors, systems, planets, and factions inside the members SPA.
            </p>
          </div>
          <div className="overflow-x-auto -mx-1 px-1">
            <SlideTabNav
              items={(Object.entries(tabLabels) as [ArchiveTab, string][])
                .filter(([key]) => key !== "system_ids" || isAdmin)
                .map(([key, label]): TabItem<ArchiveTab> => ({ key, label }))}
              activeKey={activeTab}
              onChange={(key) => {
                setActiveTab(key);
                setQuery("");
                setSystemSearchResults(null);
                setError(null);
                setShowIdGaps(false);
                clearSelection();
              }}
            />
          </div>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          <input
            className={INPUT + " rounded-full pl-4 min-w-[min(100%,320px)]"}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Search ${tabLabels[activeTab].toLowerCase()}...`}
          />
          {activeTab === "system_ids" && (
            <button
              type="button"
              className={showIdGaps ? BTN_SM + " border-[rgba(245,213,70,0.7)] bg-[rgba(245,213,70,0.18)] text-white" : BTN_SM}
              onClick={() => { setShowIdGaps((v) => !v); setQuery(""); }}
            >
              {showIdGaps ? "Show Systems" : "Show Gaps"}
            </button>
          )}
          <p className="small" style={{ margin: 0 }}>
            {loading ? "Loading archive data..." : `${showIdGaps && activeTab === "system_ids" ? idGaps.length : currentResultsCount} result(s)`}
          </p>
        </div>

        {error ? <p className="small" style={{ color: "salmon" }}>{error}</p> : null}

        <div className="grid grid-cols-[minmax(260px,340px)_minmax(0,1fr)] gap-4 max-[768px]:grid-cols-1">
          <div className={`grid gap-2.5 max-h-[70vh] overflow-y-auto pr-1 max-[768px]:max-h-none ${hasSelection ? "max-[768px]:hidden" : ""}`}>
            {activeTab === "sectors" &&
              filteredSectors.map((sector) => (
                <button
                  key={sector.uid}
                  type="button"
                  className={archiveItemCls(selectedSectorKey === sector.uid)}
                  onClick={() => void handleSelectSector(sector)}
                >
                  <strong>{sector.name ?? sector.uid}</strong>
                  <span className="small">{sector.owner_name ?? "Unknown owner"} · {formatNumber(sector.system_count)} systems</span>
                </button>
              ))}

            {activeTab === "systems" &&
              filteredSystems.map((system) => {
                const key = system.uid ?? system.name ?? "system";
                return (
                  <button
                    key={key}
                    type="button"
                    className={archiveItemCls(selectedSystemKey === key)}
                    onClick={() => void handleSelectSystem(system)}
                  >
                    <strong>{system.name ?? key}</strong>
                    <span className="small">{system.sector_name ?? "Unknown sector"} · {system.galx}, {system.galy}</span>
                  </button>
                );
              })}

            {activeTab === "planets" &&
              filteredPlanets.map((planet) => {
                const key = planet.identifier ?? planet.uid ?? planet.name ?? "planet";
                return (
                  <button
                    key={key}
                    type="button"
                    className={archiveItemCls(selectedPlanetKey === key)}
                    onClick={() => void handleSelectPlanet(planet)}
                  >
                    <strong>{planet.name ?? key}</strong>
                    <span className="small">
                      {planet.system_name ?? "Unknown system"} · {planet.planet_type_name ?? "Unknown type"}
                    </span>
                    {formatPopulationChange(planet.population, planet.previous_population) ? (
                      <span className="small">
                        Population change: {formatPopulationChange(planet.population, planet.previous_population)}
                      </span>
                    ) : null}
                  </button>
                );
              })}

            {activeTab === "system_ids" && !showIdGaps &&
              systemsByNumber.map((system) => {
                const numericId = (system.uid ?? "").split(":")[1] ?? system.uid ?? "";
                const key = system.uid ?? system.name ?? numericId;
                return (
                  <button
                    key={key}
                    type="button"
                    className={archiveItemCls(selectedSystemKey === (system.uid ?? system.name ?? "system"))}
                    onClick={() => void handleSelectSystem(system)}
                  >
                    <strong>#{numericId}{system.name ? ` — ${system.name}` : ""}</strong>
                    <span className="small">{system.sector_name ?? "Unknown sector"} · {system.galx}, {system.galy}</span>
                  </button>
                );
              })}

            {activeTab === "system_ids" && showIdGaps &&
              idGaps.map((gap) => (
                <div key={`${gap.start}-${gap.end}`} className={archiveItemCls(false)}>
                  {gap.start === gap.end
                    ? <strong>#{gap.start}</strong>
                    : <strong>#{gap.start} — #{gap.end}</strong>
                  }
                  <span className="small">
                    {gap.end - gap.start + 1} missing ID{gap.end - gap.start > 0 ? "s" : ""}
                  </span>
                </div>
              ))}

            {activeTab === "factions" &&
              filteredFactions.map((faction) => (
                <button
                  key={faction.owner_uid ?? String(faction.id)}
                  type="button"
                  className={archiveItemCls(selectedFactionKey === (faction.owner_uid ?? (faction.swc_uid != null ? `20:${faction.swc_uid}` : String(faction.id))))}
                  onClick={() => handleSelectFaction(faction)}
                >
                  <strong>{faction.name ?? `Faction ${faction.id}`}</strong>
                  <span className="small">
                    {faction.abbreviation ?? "No abbreviation"} · {faction.owner_uid ?? `UID ${faction.swc_uid ?? "Unknown"}`}
                  </span>
                </button>
              ))}
          </div>

          <div className={`grid gap-4 content-start min-h-70 ${!hasSelection ? "max-[768px]:hidden" : ""}`}>
            {hasSelection && (
              <button
                type="button"
                className={BTN_SM + " justify-self-start hidden max-[768px]:flex"}
                onClick={clearSelection}
              >
                ← Back to list
              </button>
            )}
            {activeTab === "sectors" && selectedSector && (
              <>
                <h3 className="m-0 text-[rgba(246,163,0,0.95)]">{selectedSector.sector.name ?? selectedSector.sector.uid}</h3>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>UID</span><strong>{formatSwcId(selectedSector.sector.uid)}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Owner</span><strong>{selectedSector.sector.owner_name ?? "Unknown"}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Population</span><strong>{formatNumber(selectedSector.sector.population)}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Known Systems</span><strong>{formatNumber(selectedSector.sector.known_systems)}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Grid Cells</span><strong>{formatNumber(selectedSector.coordinates.length)}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Last Pulled</span><strong>{formatTimestamp(sectors.find((row) => row.uid === selectedSector.sector.uid)?.last_pulled_at ?? null)}</strong></div>
                </div>
                <div className="grid gap-3 [&_h4]:m-0">
                  <h4>Systems</h4>
                  <div className="flex flex-wrap gap-[0.6rem]">
                    {selectedSector.systems.slice(0, 40).map((system) => (
                      <span key={system.uid ?? system.name} className="inline-flex py-[0.45rem] px-[0.65rem] rounded-full border border-white/8 bg-white/4">
                        {system.name ?? system.uid}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {(activeTab === "systems" || activeTab === "system_ids") && selectedSystem && (
              <>
                <h3 className="m-0 text-[rgba(246,163,0,0.95)]">{selectedSystem.system.name ?? selectedSystem.system.uid}</h3>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>UID</span><strong>{formatSwcId(selectedSystem.system.uid)}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Sector</span><strong>{selectedSystem.system.sector_name ?? "Unknown"}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5">
                    <span>Faction</span>
                    <strong>{selectedSystem.system.owner_name ?? "Unclaimed"}</strong>
                    {selectedSystem.system.owner_uid && (
                      <span className="text-[0.72rem] opacity-50">{formatSwcId(selectedSystem.system.owner_uid)}</span>
                    )}
                  </div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Galaxy</span><strong>{selectedSystem.system.galx}, {selectedSystem.system.galy}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Last Pulled</span><strong>{formatTimestamp(selectedSystem.system.last_pulled_at)}</strong></div>
                </div>
                <div className="grid gap-3 [&_h4]:m-0">
                  <h4>Planets</h4>
                  <div className="flex flex-wrap gap-[0.6rem]">
                    {selectedSystem.planets.map((planet) => (
                      <span key={planet.uid ?? planet.name} className="inline-flex py-[0.45rem] px-[0.65rem] rounded-full border border-white/8 bg-white/4">
                        {planet.name ?? planet.uid}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 [&_h4]:m-0">
                  <h4>Hyperlanes</h4>
                  <div className="flex flex-wrap gap-[0.6rem]">
                    {selectedSystem.hyperlanes.map((lane) => (
                      <span key={lane.uid ?? lane.name} className="inline-flex py-[0.45rem] px-[0.65rem] rounded-full border border-white/8 bg-white/4">
                        {lane.destination_name ?? lane.name ?? lane.uid}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === "planets" && selectedPlanet && (
              <>
                <h3 className="m-0 text-[rgba(246,163,0,0.95)]">{selectedPlanet.name ?? selectedPlanet.identifier ?? selectedPlanet.uid}</h3>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>UID</span><strong>{formatSwcId(selectedPlanet.uid)}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>System</span><strong>{selectedPlanet.system_name ?? "Unknown"}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Sector</span><strong>{selectedPlanet.sector_name ?? "Unknown"}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Owner</span><strong>{selectedPlanet.owner_name ?? "Unknown"}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Type</span><strong>{selectedPlanet.planet_type_name ?? "Unknown"}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Population</span><strong>{formatNumber(selectedPlanet.population)}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Population Change</span><strong>{formatPopulationChange(selectedPlanet.population, selectedPlanet.previous_population) ?? "Unknown"}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Size</span><strong>{formatNumber(selectedPlanet.size)}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Galaxy</span><strong>{selectedPlanet.galx}, {selectedPlanet.galy}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Previous Recorded</span><strong>{formatTimestamp(selectedPlanet.previous_population_recorded_at)}</strong></div>
                </div>
              </>
            )}

            {activeTab === "factions" && selectedFaction && (
              <>
                <h3 className="m-0 text-[rgba(246,163,0,0.95)]">{selectedFaction.name ?? `Faction ${selectedFaction.id}`}</h3>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Population</span><strong>{formatNumber(selectedFaction.population)}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Population Change</span><strong>{selectedFaction.population_change === null ? "Unknown" : formatPopulationChange(selectedFaction.population_change, 0) ?? "Unknown"}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Systems Owned</span><strong>{selectedFaction.systems_owned.toLocaleString()}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Planets Owned</span><strong>{selectedFaction.planets_owned.toLocaleString()}</strong></div>
                  <div className="grid gap-[0.35rem] p-[0.85rem] border border-white/8 rounded-[10px] bg-white/2.5"><span>Stations Owned</span><strong>{selectedFaction.stations_owned.toLocaleString()}</strong></div>
                </div>
              </>
            )}

            {!selectedSector && activeTab === "sectors" ? <p className="small">Select a sector to view archive details.</p> : null}
            {!selectedSystem && (activeTab === "systems" || activeTab === "system_ids") ? <p className="small">Select a system to view archive details.</p> : null}
            {!selectedPlanet && activeTab === "planets" ? <p className="small">Select a planet to view archive details.</p> : null}
            {!selectedFaction && activeTab === "factions" ? <p className="small">Select a faction to view archive details.</p> : null}
          </div>
        </div>
      </div>
    </>
  );
};

export default MemberGalacticArchivePanel;
