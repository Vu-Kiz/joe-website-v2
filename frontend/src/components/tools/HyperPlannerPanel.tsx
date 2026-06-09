import React, { useEffect, useMemo, useState } from "react";
import {
  deleteHyperPlan,
  getHyperPlannerRoute,
  getHyperPlans,
  getStoredMapSystems,
  getStoredShipTypes,
  refreshStoredSystem,
  saveHyperPlan,
  type HyperPlan,
  type HyperPlannerRoute,
  type HyperPlannerResult,
  type StoredMapSystem,
  type StoredShipTypeSummary,
} from "../../api/universe/universe";
import { BTN, BTN_SM, INPUT } from "../../utils/ui";
import ReportBugButton from "../support/ReportBugButton";

function formatCoords(galx: number | null | undefined, galy: number | null | undefined) {
  if (!Number.isFinite(galx) || !Number.isFinite(galy)) {
    return "Unknown";
  }

  return `${galx}, ${galy}`;
}

function formatSystemDisplay(system: Pick<StoredMapSystem, "name" | "identifier" | "uid" | "galx" | "galy" | "sector_name">) {
  const primary = system.name ?? system.identifier ?? system.uid ?? "Unknown system";
  const coords = formatCoords(system.galx, system.galy);
  const sector = system.sector_name ? ` · ${system.sector_name}` : "";

  return `${primary} (${coords})${sector}`;
}

function systemIdentifier(system: { identifier: string | null; uid: string | null }) {
  return system.identifier ?? system.uid ?? "";
}

function systemRefreshIdentifier(system: Pick<StoredMapSystem, "identifier" | "name">) {
  if (system.identifier && !system.identifier.includes(":")) {
    return system.identifier;
  }

  return system.name ?? system.identifier ?? "";
}

function formatRoundedNumber(value: number | null | undefined, digits = 2, fallback = "Unknown") {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return fallback;
  }

  return Number(value).toFixed(digits).replace(/\.00$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
}

function formatShipDisplay(ship: Pick<StoredShipTypeSummary, "name" | "class_name" | "hyperdrive">) {
  const name = ship.name ?? "Unknown ship";
  const shipClass = ship.class_name ? ` · ${ship.class_name}` : "";
  const hyper = ship.hyperdrive != null ? ` · Hyper ${Math.round(ship.hyperdrive)}` : " · No hyper";

  return `${name}${shipClass}${hyper}`;
}

function resolveShipHyperspeed(ship: Pick<StoredShipTypeSummary, "hyperdrive"> | null): number | null {
  if (!ship || ship.hyperdrive == null || Number.isNaN(ship.hyperdrive)) {
    return null;
  }

  return Math.max(1, Math.round(ship.hyperdrive));
}

function buildSwcDirectedTravelUrl(
  endpoint: { galx: number | null | undefined; galy: number | null | undefined } | null | undefined
) {
  if (!endpoint || !Number.isFinite(endpoint.galx) || !Number.isFinite(endpoint.galy)) {
    return null;
  }

  const params = new URLSearchParams({
    travelClass: "2",
    supplied: "1",
    galX: String(endpoint.galx),
    galY: String(endpoint.galy),
  });

  return `https://www.swcombine.com/members/cockpit/travel/directed.php?${params.toString()}`;
}

function formatHopTooltip(
  hop: HyperPlannerResult["hops"][number] | null | undefined,
  hopNumber: number
) {
  if (!hop) {
    return "Start point";
  }

  const hopLabel =
    hop.hop_type === "direct" || !hop.lane_name || hop.lane_name.toLowerCase().startsWith("direct jump")
      ? `Hop ${hopNumber}: Direct jump`
      : `Hop ${hopNumber}: ${hop.lane_name}`;

  return `${hopLabel}\nTime: ${hop.formatted_time}`;
}

type HyperPlannerPanelProps = {
  onBack: () => void;
  canRefreshStoredHyperlanes?: boolean;
};

const HyperPlannerPanel: React.FC<HyperPlannerPanelProps> = ({
  onBack,
  canRefreshStoredHyperlanes = false,
}) => {
  const [systems, setSystems] = useState<StoredMapSystem[]>([]);
  const [loadingSystems, setLoadingSystems] = useState(true);
  const [systemsError, setSystemsError] = useState<string | null>(null);
  const [ships, setShips] = useState<StoredShipTypeSummary[]>([]);
  const [loadingShips, setLoadingShips] = useState(true);
  const [shipsError, setShipsError] = useState<string | null>(null);
  const [fromQuery, setFromQuery] = useState("");
  const [toQuery, setToQuery] = useState("");
  const [shipQuery, setShipQuery] = useState("");
  const [fromSystem, setFromSystem] = useState<StoredMapSystem | null>(null);
  const [toSystem, setToSystem] = useState<StoredMapSystem | null>(null);
  const [selectedShip, setSelectedShip] = useState<StoredShipTypeSummary | null>(null);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [plan, setPlan] = useState<HyperPlannerResult | null>(null);
  const [pilotingSkill, setPilotingSkill] = useState(0);
  const [planName, setPlanName] = useState("");
  const [savedPlans, setSavedPlans] = useState<HyperPlan[]>([]);
  const [loadingSavedPlans, setLoadingSavedPlans] = useState(true);
  const [savedPlansError, setSavedPlansError] = useState<string | null>(null);
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
  const [savedPlansOpen, setSavedPlansOpen] = useState(!isMobile);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [showPlannerInputs, setShowPlannerInputs] = useState(false);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [routesExpanded, setRoutesExpanded] = useState(false);
  const [planningLabel, setPlanningLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingSystems(true);
        const response = await getStoredMapSystems();
        if (cancelled) {
          return;
        }
        setSystems(Array.isArray(response?.data) ? response.data : []);
        setSystemsError(null);
      } catch (error: any) {
        if (!cancelled) {
          setSystems([]);
          setSystemsError(error?.message ?? "Failed to load stored systems.");
        }
      } finally {
        if (!cancelled) {
          setLoadingSystems(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingSavedPlans(true);
        const response = await getHyperPlans();
        if (cancelled) {
          return;
        }
        setSavedPlans(Array.isArray(response?.data) ? response.data : []);
        setSavedPlansError(null);
      } catch (error: any) {
        if (!cancelled) {
          setSavedPlans([]);
          setSavedPlansError(error?.message ?? "Failed to load saved hyper plans.");
        }
      } finally {
        if (!cancelled) {
          setLoadingSavedPlans(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoadingShips(true);
        const response = await getStoredShipTypes();
        if (cancelled) {
          return;
        }
        setShips(
          Array.isArray(response?.data)
            ? response.data.filter((ship) => ship.hyperdrive != null && Number(ship.hyperdrive) > 0)
            : []
        );
        setShipsError(null);
      } catch (error: any) {
        if (!cancelled) {
          setShips([]);
          setShipsError(error?.message ?? "Failed to load stored ship types.");
        }
      } finally {
        if (!cancelled) {
          setLoadingShips(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const normalizedSystems = useMemo(
    () =>
      systems.map((system) => ({
        system,
        searchKey: [
          system.name ?? "",
          system.identifier ?? "",
          system.uid ?? "",
          system.sector_name ?? "",
          Number.isFinite(system.galx) ? String(system.galx) : "",
          Number.isFinite(system.galy) ? String(system.galy) : "",
        ]
          .join(" ")
          .toLowerCase(),
      })),
    [systems]
  );

  const fromSuggestions = useMemo(() => {
    const query = fromQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return normalizedSystems
      .filter((entry) => entry.searchKey.includes(query))
      .slice(0, 8)
      .map((entry) => entry.system);
  }, [fromQuery, normalizedSystems]);

  const toSuggestions = useMemo(() => {
    const query = toQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return normalizedSystems
      .filter((entry) => entry.searchKey.includes(query))
      .slice(0, 8)
      .map((entry) => entry.system);
  }, [toQuery, normalizedSystems]);

  const normalizedShips = useMemo(
    () =>
      ships.map((ship) => ({
        ship,
        searchKey: [
          ship.name ?? "",
          ship.class_name ?? "",
          ship.uid ?? "",
          ship.hyperdrive != null ? String(ship.hyperdrive) : "",
        ]
          .join(" ")
          .toLowerCase(),
      })),
    [ships]
  );

  const shipSuggestions = useMemo(() => {
    const query = shipQuery.trim().toLowerCase();
    if (!query) {
      return [];
    }

    return normalizedShips
      .filter((entry) => entry.searchKey.includes(query))
      .slice(0, 8)
      .map((entry) => entry.ship);
  }, [normalizedShips, shipQuery]);

  function handleSelectFrom(system: StoredMapSystem) {
    setFromSystem(system);
    setFromQuery(formatSystemDisplay(system));
  }

  function handleSelectTo(system: StoredMapSystem) {
    setToSystem(system);
    setToQuery(formatSystemDisplay(system));
  }

  function handleSelectShip(ship: StoredShipTypeSummary) {
    setSelectedShip(ship);
    setShipQuery(formatShipDisplay(ship));
  }

  function applySavedPlan(planToLoad: HyperPlan) {
    const nextFromSystem =
      systems.find(
        (system) =>
          system.identifier === planToLoad.from_system_identifier || system.uid === planToLoad.from_system_identifier
      ) ?? null;
    const nextToSystem =
      systems.find(
        (system) =>
          system.identifier === planToLoad.to_system_identifier || system.uid === planToLoad.to_system_identifier
      ) ?? null;
    const nextShip =
      ships.find((ship) => ship.uid === planToLoad.ship_uid) ??
      ships.find((ship) => ship.name === planToLoad.ship_name) ??
      null;

    setFromSystem(nextFromSystem);
    setFromQuery(
      nextFromSystem
        ? formatSystemDisplay(nextFromSystem)
        : (planToLoad.from_system_name ?? planToLoad.from_system_identifier)
    );
    setToSystem(nextToSystem);
    setToQuery(
      nextToSystem
        ? formatSystemDisplay(nextToSystem)
        : (planToLoad.to_system_name ?? planToLoad.to_system_identifier)
    );
    setSelectedShip(nextShip);
    setShipQuery(
      nextShip
        ? formatShipDisplay(nextShip)
        : [planToLoad.ship_name ?? "Unknown ship", planToLoad.ship_class_name, `Hyper ${planToLoad.hyperspeed}`]
            .filter(Boolean)
            .join(" · ")
    );
    setPilotingSkill(planToLoad.piloting_skill);
    setPlanName(planToLoad.name);
    setPlan(null);
    setSelectedRouteIndex(0);
    setRoutesExpanded(false);
    setPlanError(null);
    setSaveMessage(`Loaded saved plan: ${planToLoad.name}`);
  }

  async function handleSavePlan() {
    const fromInput = fromSystem ? systemIdentifier(fromSystem) : fromQuery.trim();
    const toInput = toSystem ? systemIdentifier(toSystem) : toQuery.trim();

    if (!fromInput || !toInput || !selectedShip) {
      setSaveMessage("Pick the route and ship before saving a plan.");
      return;
    }

    const resolvedHyperspeed = resolveShipHyperspeed(selectedShip);
    if (resolvedHyperspeed == null) {
      setSaveMessage("The selected ship does not have a valid hyperdrive value.");
      return;
    }

    const trimmedName = planName.trim();
    if (!trimmedName) {
      setSaveMessage("Give the plan a name before saving it.");
      return;
    }

    try {
      const response = await saveHyperPlan({
        name: trimmedName,
        from_system_identifier: fromInput,
        from_system_name: fromSystem?.name ?? fromInput,
        to_system_identifier: toInput,
        to_system_name: toSystem?.name ?? toInput,
        ship_uid: selectedShip.uid,
        ship_name: selectedShip.name,
        ship_class_name: selectedShip.class_name ?? null,
        hyperspeed: resolvedHyperspeed,
        piloting_skill: pilotingSkill,
      });

      setSavedPlans((current) => [response.data, ...current]);
      setSaveMessage(`Saved plan: ${response.data.name}`);
      setSavedPlansError(null);
    } catch (error: any) {
      setSaveMessage(error?.message ?? "Failed to save hyper plan.");
    }
  }

  async function handleDeletePlan(planId: number) {
    try {
      await deleteHyperPlan(planId);
      setSavedPlans((current) => current.filter((planEntry) => planEntry.id !== planId));
      setSaveMessage("Saved plan deleted.");
    } catch (error: any) {
      setSaveMessage(error?.message ?? "Failed to delete hyper plan.");
    }
  }

  async function handlePlan() {
    const fromInput = fromSystem ? systemIdentifier(fromSystem) : fromQuery.trim();
    const toInput = toSystem ? systemIdentifier(toSystem) : toQuery.trim();

    if (!fromInput || !toInput) {
      setPlan(null);
      setPlanError("Pick both a starting system and a destination first.");
      return;
    }

    if (!selectedShip || selectedShip.hyperdrive == null) {
      setPlan(null);
      setPlanError("Pick a ship with a stored hyperdrive before plotting.");
      return;
    }

    const resolvedHyperspeed = resolveShipHyperspeed(selectedShip);
    if (resolvedHyperspeed == null) {
      setPlan(null);
      setPlanError("The selected ship does not have a valid integer hyperdrive value.");
      return;
    }

    try {
      setPlanning(true);
      setPlanError(null);

      if (canRefreshStoredHyperlanes) {
        setPlanningLabel("Refreshing Hyperlanes...");

        const refreshIdentifiers = Array.from(
          new Set(
            [
              fromSystem ? systemRefreshIdentifier(fromSystem) : null,
              toSystem ? systemRefreshIdentifier(toSystem) : null,
            ].filter((value): value is string => Boolean(value && value.trim()))
          )
        );

        for (const identifier of refreshIdentifiers) {
          await refreshStoredSystem(identifier);
        }
      }

      setPlanningLabel("Plotting Fastest Route...");
      const response = await getHyperPlannerRoute(fromInput, toInput, {
        pilotingSkill,
        hyperspeed: resolvedHyperspeed,
      });
      setPlan(response.data ?? null);
      setSelectedRouteIndex(0);
      setRoutesExpanded(false);
    } catch (error: any) {
      setPlan(null);
      setPlanError(error?.message ?? "Failed to calculate a stored hyperlane route.");
    } finally {
      setPlanningLabel(null);
      setPlanning(false);
    }
  }

  const availableRoutes = useMemo<HyperPlannerRoute[]>(() => {
    if (!plan) {
      return [];
    }

    if (Array.isArray(plan.routes) && plan.routes.length > 0) {
      return plan.routes.slice(0, 3);
    }

    return [
      {
        route_index: 0,
        route_label: "Route 1",
        from: plan.from,
        to: plan.to,
        summary: plan.summary,
        systems: plan.systems,
        hops: plan.hops,
      },
    ];
  }, [plan]);

  const selectedRoute = useMemo<HyperPlannerRoute | null>(() => {
    if (availableRoutes.length === 0) {
      return null;
    }

    return availableRoutes.find((route) => route.route_index === selectedRouteIndex) ?? availableRoutes[0];
  }, [availableRoutes, selectedRouteIndex]);

  const FIELD_CLS = "flex flex-col gap-2";
  const SUGGESTIONS_CLS = "grid gap-[0.45rem] max-h-[22rem] overflow-auto";
  const SUGGESTION_BASE = "grid gap-[0.2rem] p-[0.8rem_0.9rem] text-left border border-white/[0.12] rounded-[12px] bg-white/[0.03] text-inherit cursor-pointer transition-[border-color,transform,background] duration-[150ms] ease hover:border-[rgba(246,163,0,0.55)] hover:bg-[rgba(246,163,0,0.08)] hover:-translate-y-px focus-visible:border-[rgba(246,163,0,0.55)] focus-visible:bg-[rgba(246,163,0,0.08)] focus-visible:-translate-y-px";
  const suggestionCls = (active: boolean) => SUGGESTION_BASE + (active ? " !border-[rgba(246,163,0,0.75)] !bg-[rgba(246,163,0,0.85)] !text-[#111]" : "");
  const SAVED_PLAN_CLS = SUGGESTION_BASE + " flex justify-between items-start gap-[0.85rem] cursor-default hover:!border-white/[0.12] hover:!bg-white/[0.03] hover:![transform:none] focus-visible:!border-white/[0.12] focus-visible:!bg-white/[0.03]";
  const CONTROLS_CLS = "grid grid-cols-[repeat(2,minmax(0,1fr))] gap-4 max-[960px]:grid-cols-1";
  const SYSTEM_PILL_CLS = "grid gap-[0.15rem] p-[0.7rem_0.85rem] min-w-[11rem] border border-white/[0.12] rounded-[12px] bg-white/[0.04] text-inherit no-underline hover:border-[rgba(246,163,0,0.55)] focus-visible:border-[rgba(246,163,0,0.55)]";
  const CHAIN_ARROW_CLS = "inline-flex items-center justify-center w-[1.9rem] h-[1.9rem] rounded-full border border-[rgba(246,163,0,0.28)] bg-[rgba(246,163,0,0.1)] text-[rgba(246,163,0,0.9)] text-[1.1rem] font-bold leading-none flex-none";

  return (
    <section className="grid gap-4">
      <div className="flex items-center gap-3 mb-4">
        <button className={BTN} type="button" onClick={onBack}>
          Back to Overview
        </button>
        <ReportBugButton toolKey="hyper_planner" toolLabel="Hyper Planner" />
      </div>

      <p className="m-0 opacity-[0.85]">
        Pick two stored systems and calculate the fastest stored hyperlane route between them.
      </p>

      <article className="panel flex flex-col gap-4">
        <div className="flex justify-between items-start gap-4 max-[960px]:flex-col max-[960px]:items-stretch">
          <div>
            <h3 className="m-0">Route Setup</h3>
            <p className="small">From, to, ship, and piloting skill.</p>
          </div>
          <button className={BTN} type="button" onClick={() => setShowPlannerInputs((current) => !current)}>
            {showPlannerInputs ? "Hide Setup" : "Show Setup"}
          </button>
        </div>

        {showPlannerInputs ? (
          <>
            <section className={CONTROLS_CLS}>
              <article className="panel flex flex-col gap-4">
                <label className={FIELD_CLS}>
                  <span className="small">From</span>
                  <input
                    className={INPUT}
                    value={fromQuery}
                    onChange={(event) => {
                      setFromQuery(event.target.value);
                      setFromSystem(null);
                    }}
                    placeholder="Search a stored system or enter x, y"
                  />
                </label>
                <div className={SUGGESTIONS_CLS}>
                  {fromSuggestions.map((system) => (
                    <button
                      key={`from-${system.uid ?? system.identifier ?? system.name}`}
                      type="button"
                      className={suggestionCls(!!fromSystem && systemIdentifier(system) === systemIdentifier(fromSystem))}
                      onClick={() => handleSelectFrom(system)}
                    >
                      <strong>{system.name ?? system.identifier ?? system.uid ?? "Unknown system"}</strong>
                      <span className="small">
                        {formatCoords(system.galx, system.galy)}
                        {system.sector_name ? ` · ${system.sector_name}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </article>

              <article className="panel flex flex-col gap-4">
                <label className={FIELD_CLS}>
                  <span className="small">To</span>
                  <input
                    className={INPUT}
                    value={toQuery}
                    onChange={(event) => {
                      setToQuery(event.target.value);
                      setToSystem(null);
                    }}
                    placeholder="Search a stored destination or enter x, y"
                  />
                </label>
                <div className={SUGGESTIONS_CLS}>
                  {toSuggestions.map((system) => (
                    <button
                      key={`to-${system.uid ?? system.identifier ?? system.name}`}
                      type="button"
                      className={suggestionCls(!!toSystem && systemIdentifier(system) === systemIdentifier(toSystem))}
                      onClick={() => handleSelectTo(system)}
                    >
                      <strong>{system.name ?? system.identifier ?? system.uid ?? "Unknown system"}</strong>
                      <span className="small">
                        {formatCoords(system.galx, system.galy)}
                        {system.sector_name ? ` · ${system.sector_name}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </article>

              <article className="panel flex flex-col gap-4">
                <label className={FIELD_CLS}>
                  <span className="small">Ship</span>
                  <input
                    className={INPUT}
                    value={shipQuery}
                    onChange={(event) => {
                      setShipQuery(event.target.value);
                      setSelectedShip(null);
                    }}
                    placeholder="Search a stored ship type"
                  />
                </label>
                <div className={SUGGESTIONS_CLS}>
                  {shipSuggestions.map((ship) => (
                    <button
                      key={`ship-${ship.uid}`}
                      type="button"
                      className={suggestionCls(selectedShip?.uid === ship.uid)}
                      onClick={() => handleSelectShip(ship)}
                    >
                      <strong>{ship.name ?? ship.uid ?? "Unknown ship"}</strong>
                      <span className="small">
                        {ship.class_name ?? "Unknown class"}
                        {ship.hyperdrive != null ? ` · Hyper ${Math.round(ship.hyperdrive)}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              </article>
            </section>

            <section className={CONTROLS_CLS}>
              <article className="panel flex flex-col gap-4">
                <label className={FIELD_CLS}>
                  <span className="small">Piloting Skill</span>
                  <select
                    className={INPUT}
                    value={pilotingSkill}
                    onChange={(event) => setPilotingSkill(Number(event.target.value))}
                  >
                    {[0, 1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedShip ? (
                  <div className={FIELD_CLS}>
                    <span className="small">Selected Ship</span>
                    <div className={SYSTEM_PILL_CLS}>
                      <strong>{selectedShip.name ?? selectedShip.uid ?? "Unknown ship"}</strong>
                      <span className="small">
                        {selectedShip.class_name ?? "Unknown class"}
                        {selectedShip.hyperdrive != null ? ` · Hyper ${Math.round(selectedShip.hyperdrive)}` : ""}
                      </span>
                    </div>
                  </div>
                ) : null}
              </article>
            </section>
          </>
        ) : null}
      </article>

      <div className="flex">
        <button className={BTN} type="button" onClick={handlePlan} disabled={planning || loadingSystems}>
          {planning ? (planningLabel ?? "Plotting Fastest Route...") : "Plot Fastest Route"}
        </button>
      </div>

      <section className={CONTROLS_CLS}>
        <article className="panel flex flex-col gap-4">
          <label className={FIELD_CLS}>
            <span className="small">Plan Name</span>
            <input
              className={INPUT}
              value={planName}
              onChange={(event) => setPlanName(event.target.value)}
              placeholder="Corellian Run Courier"
            />
          </label>
          <div className="flex">
            <button className={BTN} type="button" onClick={handleSavePlan}>
              Save Plan
            </button>
          </div>
          {saveMessage ? <p className="small">{saveMessage}</p> : null}
        </article>

        <article className="panel flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3 mb-1">
            <h3 className="m-0">Saved Plans</h3>
            {isMobile ? (
              <button
                type="button"
                className={BTN_SM + " all"}
                onClick={() => setSavedPlansOpen((o) => !o)}
              >
                {savedPlansOpen ? "Hide" : "Show"}
              </button>
            ) : null}
          </div>
          {loadingSavedPlans ? <p className="small">Loading saved plans…</p> : null}
          {savedPlansError ? <p className="small" style={{ color: "salmon" }}>{savedPlansError}</p> : null}
          {!loadingSavedPlans && savedPlans.length === 0 ? (
            <p className="small">No saved hyper plans yet.</p>
          ) : null}
          {savedPlansOpen ? (
            <div className={SUGGESTIONS_CLS}>
              {savedPlans.map((savedPlan) => (
                <div key={savedPlan.id} className={SAVED_PLAN_CLS}>
                  <div className="grid gap-[0.45rem] min-w-0">
                    <strong>{savedPlan.name}</strong>
                    <div className="flex flex-wrap items-center gap-[0.45rem]">
                      <span className="small">{savedPlan.from_system_name ?? savedPlan.from_system_identifier}</span>
                      <span className={CHAIN_ARROW_CLS} aria-hidden="true">→</span>
                      <span className="small">{savedPlan.to_system_name ?? savedPlan.to_system_identifier}</span>
                    </div>
                    <div className="flex flex-wrap gap-[0.45rem_0.9rem]">
                      <span className="small"><strong>Ship:</strong> {savedPlan.ship_name ?? "Unknown ship"}</span>
                      <span className="small"><strong>Hyper:</strong> {savedPlan.hyperspeed}</span>
                      <span className="small"><strong>Piloting:</strong> {savedPlan.piloting_skill}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end max-[640px]:justify-start">
                    <button className={BTN} type="button" onClick={() => applySavedPlan(savedPlan)}>Load</button>
                    <button className={BTN} type="button" onClick={() => handleDeletePlan(savedPlan.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </article>
      </section>

      {loadingSystems ? <p className="small">Loading stored systems…</p> : null}
      {loadingShips ? <p className="small">Loading stored ship types…</p> : null}
      {systemsError ? (
        <p className="small" style={{ color: "salmon" }}>
          {systemsError}
        </p>
      ) : null}
      {shipsError ? (
        <p className="small" style={{ color: "salmon" }}>
          {shipsError}
        </p>
      ) : null}
      {planError ? (
        <p className="small" style={{ color: "salmon" }}>
          {planError}
        </p>
      ) : null}

      {plan && selectedRoute ? (
        <section className="grid gap-4">
          <div className="flex">
            {buildSwcDirectedTravelUrl(selectedRoute.to ?? null) ? (
              <a
                className={BTN}
                href={buildSwcDirectedTravelUrl(selectedRoute.to ?? null) ?? "#"}
                target="_blank"
                rel="noreferrer"
              >
                Open SWC Directed Travel
              </a>
            ) : null}
          </div>

          <article className="panel flex flex-col gap-4">
            <div className="flex justify-between items-start gap-[0.9rem] flex-wrap">
              <div>
                <h3 className="m-0">Routes Faster Than Direct</h3>
                <p className="small">
                  Showing every stored route that beats a direct A to B jump, ordered fastest to slowest.
                </p>
              </div>
              <button
                className={BTN}
                type="button"
                onClick={() => setRoutesExpanded((current) => !current)}
                aria-expanded={routesExpanded}
              >
                {routesExpanded ? "Hide Routes" : `Show Routes (${availableRoutes.length})`}
              </button>
            </div>
            {routesExpanded ? (
              <div className={SUGGESTIONS_CLS}>
                {availableRoutes.map((route) => (
                  <button
                    key={route.route_index}
                    type="button"
                    className={suggestionCls(route.route_index === selectedRoute.route_index)}
                    onClick={() => setSelectedRouteIndex(route.route_index)}
                  >
                    <strong>
                      {route.route_label} · {route.summary.formatted_time}
                    </strong>
                    <span className="small">
                      Saves {route.summary.time_saved_formatted} · {route.summary.hop_count} hop{route.summary.hop_count === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </article>

          <div className="grid [grid-template-columns:repeat(4,minmax(0,1fr))] gap-4 max-[960px]:grid-cols-2 max-[640px]:grid-cols-1">
            <article className="panel flex flex-col gap-4">
              <h3 className="m-0">Route</h3>
              <p className="small">
                {(selectedRoute.from?.name ?? selectedRoute.from?.identifier ?? selectedRoute.from?.uid ?? "Unknown")} to{" "}
                {(selectedRoute.to?.name ?? selectedRoute.to?.identifier ?? selectedRoute.to?.uid ?? "Unknown")}
              </p>
            </article>
            <article className="panel flex flex-col gap-4">
              <h3 className="m-0">Fastest Time</h3>
              <p className="small">{selectedRoute.summary.formatted_time}</p>
            </article>
            <article className="panel flex flex-col gap-4">
              <h3 className="m-0">Time Saved</h3>
              <p className="small">{selectedRoute.summary.time_saved_formatted}</p>
            </article>
            <article className="panel flex flex-col gap-4">
              <h3 className="m-0">Hops</h3>
              <p className="small">{selectedRoute.summary.hop_count}</p>
            </article>
          </div>

          <article className="panel flex flex-col gap-4">
            <h3 className="m-0">Timing Inputs</h3>
            <div className="flex flex-wrap gap-[0.6rem] items-center">
              <span className={SYSTEM_PILL_CLS}>
                <strong>Piloting</strong>
                <span className="small">{selectedRoute.summary.piloting_skill}</span>
              </span>
              <span className={SYSTEM_PILL_CLS}>
                <strong>Ship Hyper</strong>
                <span className="small">{formatRoundedNumber(selectedRoute.summary.hyperspeed, 0)}</span>
              </span>
            </div>
          </article>

          <article className="panel flex flex-col gap-4">
            <h3 className="m-0">Route Systems</h3>
            <div className="flex flex-wrap gap-[0.6rem] items-center">
              {selectedRoute.systems.map((system, index) => {
                const identifier = system.identifier ?? system.uid ?? "";
                const incomingHop = index > 0 ? selectedRoute.hops[index - 1] : null;
                return (
                  <React.Fragment key={`${identifier}-${index}`}>
                    <a
                      className={SYSTEM_PILL_CLS}
                      href={buildSwcDirectedTravelUrl(system) ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      title={formatHopTooltip(incomingHop, index)}
                    >
                      <strong>{system.name ?? identifier}</strong>
                      <span className="small">{formatCoords(system.galx, system.galy)}</span>
                    </a>
                    {index < selectedRoute.systems.length - 1 ? (
                      <span className={CHAIN_ARROW_CLS} aria-hidden="true">→</span>
                    ) : null}
                  </React.Fragment>
                );
              })}
            </div>
          </article>

        </section>
      ) : null}
    </section>
  );
};

export default HyperPlannerPanel;
