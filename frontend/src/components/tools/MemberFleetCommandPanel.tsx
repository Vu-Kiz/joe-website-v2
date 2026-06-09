import React, { useEffect, useMemo, useState } from "react";
import { getFleetRosterMatrix, getMySkills, getSkillPlan, saveSkillPlan, type FleetRosterMatrixRow } from "../../api/universe/fleetCommander";
import type { SwcAuthorizationStatus } from "../../api/members/swcAuthorization";
import type { SwcUser } from "../../api/core/auth";
import { BTN, INPUT } from "../../utils/ui";
import ReportBugButton from "../support/ReportBugButton";

type Props = {
  onBack: () => void;
  viewer: SwcUser | null;
  canSeeRoster: boolean;
  swcAuth: SwcAuthorizationStatus | null;
  onRequestSwcResync: () => void;
};

type BiometricsTab = "roster" | "planner";

// Step costs: 0→1=1, 1→2=1, 2→3=2, 3→4=3, 4→5=4. Total to max = 11.
const STEP_COSTS = [1, 1, 2, 3, 4] as const;

function skillCost(level: number): number {
  let total = 0;
  for (let i = 0; i < level && i < STEP_COSTS.length; i++) {
    total += STEP_COSTS[i];
  }
  return total;
}

function SortArrow({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <span className="opacity-25 ml-1">↕</span>;
  return <span className="ml-1">{dir === "asc" ? "↑" : "↓"}</span>;
}

type MetricKey =
  | "strength"
  | "dexterity"
  | "speed"
  | "dodge"
  | "projectile"
  | "non_projectile"
  | "fighter_piloting"
  | "fighter_combat"
  | "capital_piloting"
  | "capital_combat"
  | "space_command"
  | "vehicle_piloting"
  | "vehicle_combat"
  | "infantry_command"
  | "vehicle_command"
  | "heavy_weapons"
  | "medical"
  | "diplomacy"
  | "crafting"
  | "management"
  | "perception"
  | "stealth"
  | "rnd_hull"
  | "rnd_electronics"
  | "rnd_engines"
  | "rnd_weapons"
  | "repair"
  | "comp_ops";

type CategoryKey = "general" | "space" | "ground" | "social" | "science";

type SortKey = "name" | MetricKey;

type MetricDefinition = {
  key: MetricKey;
  label: string;
};

type MetricGroup = {
  key: CategoryKey;
  label: string;
  metrics: MetricDefinition[];
};

const metricGroups: MetricGroup[] = [
  {
    key: "general",
    label: "General",
    metrics: [
      { key: "strength", label: "Strength" },
      { key: "dexterity", label: "Dexterity" },
      { key: "speed", label: "Speed" },
      { key: "dodge", label: "Dodge" },
      { key: "projectile", label: "Projectile Weapons" },
      { key: "non_projectile", label: "Non Projectile Weapons" },
    ],
  },
  {
    key: "space",
    label: "Space",
    metrics: [
      { key: "fighter_piloting", label: "Fighter/Freighter Piloting" },
      { key: "fighter_combat", label: "Fighter/Freighter Combat" },
      { key: "capital_piloting", label: "Capital Ship Piloting" },
      { key: "capital_combat", label: "Capital Ship Combat" },
      { key: "space_command", label: "Space Command" },
    ],
  },
  {
    key: "ground",
    label: "Ground",
    metrics: [
      { key: "vehicle_piloting", label: "Vehicle Piloting" },
      { key: "vehicle_combat", label: "Vehicle Combat" },
      { key: "infantry_command", label: "Infantry Command" },
      { key: "vehicle_command", label: "Vehicle Command" },
      { key: "heavy_weapons", label: "Heavy Weapons" },
    ],
  },
  {
    key: "social",
    label: "Social",
    metrics: [
      { key: "medical", label: "Medical Treatment" },
      { key: "diplomacy", label: "Diplomacy/Trading" },
      { key: "crafting", label: "Crafting/Slicing" },
      { key: "management", label: "Management" },
      { key: "perception", label: "Perception" },
      { key: "stealth", label: "Stealth" },
    ],
  },
  {
    key: "science",
    label: "Science",
    metrics: [
      { key: "rnd_hull", label: "R&D Metallurgy" },
      { key: "rnd_electronics", label: "R&D Electronics" },
      { key: "rnd_engines", label: "R&D Engines" },
      { key: "rnd_weapons", label: "R&D Weapons" },
      { key: "repair", label: "Repair" },
      { key: "comp_ops", label: "Computer Operations" },
    ],
  },
];

const allMetrics = metricGroups.flatMap((group) => group.metrics);

const initialCategoryExpanded: Record<CategoryKey, boolean> = {
  general: false,
  space: false,
  ground: false,
  social: false,
  science: false,
};

const MemberFleetCommandPanel: React.FC<Props> = ({
  onBack,
  viewer,
  canSeeRoster,
  swcAuth,
  onRequestSwcResync,
}) => {
  const [activeTab, setActiveTab] = useState<BiometricsTab>(canSeeRoster ? "roster" : "planner");
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [filter, setFilter] = useState("");
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [matrixRows, setMatrixRows] = useState<FleetRosterMatrixRow[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [metricMins, setMetricMins] = useState<Partial<Record<MetricKey, string>>>({});
  const [categoryExpanded, setCategoryExpanded] = useState<Record<CategoryKey, boolean>>(initialCategoryExpanded);

  const [planSaving, setPlanSaving] = useState(false);
  const [planSaveError, setPlanSaveError] = useState<string | null>(null);
  const [serverPlan, setServerPlan] = useState<Record<MetricKey, number> | null>(null);
  const [planLoaded, setPlanLoaded] = useState(false);

  // Planner state — baseline is the loaded snapshot (treated as free)
  const [plannerBaseline, setPlannerBaseline] = useState<Record<MetricKey, number>>(
    () => Object.fromEntries(allMetrics.map((m) => [m.key, 0])) as Record<MetricKey, number>
  );
  const [plannerLevels, setPlannerLevels] = useState<Record<MetricKey, number>>(
    () => Object.fromEntries(allMetrics.map((m) => [m.key, 0])) as Record<MetricKey, number>
  );

  const hasSkillsAccess = Boolean(swcAuth?.has_character_skills_access);

  const visibleMetrics = useMemo(
    () => metricGroups.filter((group) => categoryExpanded[group.key]).flatMap((group) => group.metrics),
    [categoryExpanded],
  );

  useEffect(() => {
    if (sortBy === "name") {
      return;
    }

    const isStillVisible = visibleMetrics.some((metric) => metric.key === sortBy);
    if (!isStillVisible) {
      setSortBy("name");
    }
  }, [sortBy, visibleMetrics]);

  useEffect(() => {
    getSkillPlan().then((response) => {
      if (response.skill_plan && typeof response.skill_plan === "object") {
        setServerPlan(response.skill_plan as Record<MetricKey, number>);
      }
    }).catch(() => {});
  }, []);

  const errorRows = useMemo(() => matrixRows.filter((row) => row.snapshot_error), [matrixRows]);

  const filteredMatrixRows = useMemo(() => {
    const query = filter.trim().toLowerCase();

    const list = matrixRows.filter((row) => {
      if (row.snapshot_error) return false;

      const name = String(row.handle ?? "").toLowerCase();
      if (query && !name.includes(query)) {
        return false;
      }

      for (const metric of allMetrics) {
        const raw = String(metricMins[metric.key] ?? "").trim();
        if (raw === "") {
          continue;
        }

        const minValue = Number(raw);
        if (Number.isNaN(minValue)) {
          continue;
        }

        const value = row[metric.key];
        if (value === null || value < minValue) {
          return false;
        }
      }

      return true;
    });

    const compareNumber = (a: number | null, b: number | null): number => {
      const av = a ?? -999;
      const bv = b ?? -999;
      return av - bv;
    };

    return list.slice().sort((left, right) => {
      const leftName = String(left.handle ?? "");
      const rightName = String(right.handle ?? "");

      const base = sortBy === "name"
        ? leftName.localeCompare(rightName)
        : compareNumber(left[sortBy], right[sortBy]);

      if (base !== 0) {
        return sortDir === "asc" ? base : -base;
      }

      return leftName.localeCompare(rightName);
    });
  }, [filter, matrixRows, metricMins, sortBy, sortDir]);

  const hasMatrix = matrixRows.length > 0;

  function handleSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("desc");
    }
  }

  function clearMetricFilters() {
    setMetricMins({});
  }

  function updateMetricMin(metricKey: MetricKey, value: string) {
    setMetricMins((previous) => ({
      ...previous,
      [metricKey]: value,
    }));
  }

  function toggleCategory(categoryKey: CategoryKey) {
    setCategoryExpanded((previous) => ({
      ...previous,
      [categoryKey]: !previous[categoryKey],
    }));
  }

  function setAllCategories(expanded: boolean) {
    setCategoryExpanded({
      general: expanded,
      space: expanded,
      ground: expanded,
      social: expanded,
      science: expanded,
    });
  }

  // Only count points spent above the loaded baseline
  const plannerSpent = useMemo(
    () => allMetrics.reduce((sum, m) => sum + Math.max(0, skillCost(plannerLevels[m.key]) - skillCost(plannerBaseline[m.key])), 0),
    [plannerLevels, plannerBaseline]
  );

  function setPlannerSkill(key: MetricKey, level: number) {
    setPlannerLevels((prev) => ({ ...prev, [key]: Math.min(5, Math.max(0, level)) }));
  }

  function resetPlanner() {
    setPlannerLevels({ ...plannerBaseline });
  }

  async function handleSavePlan() {
    setPlanSaving(true);
    setPlanSaveError(null);
    try {
      await saveSkillPlan(plannerLevels);
      setServerPlan({ ...plannerLevels });
      setPlanLoaded(true);
    } catch (error: unknown) {
      setPlanSaveError(error instanceof Error ? error.message : "Failed to save plan.");
    } finally {
      setPlanSaving(false);
    }
  }

  function handleLoadPlan() {
    if (!serverPlan) return;
    const restored = Object.fromEntries(
      allMetrics.map((m) => [m.key, Math.min(5, Math.max(plannerBaseline[m.key], Number(serverPlan[m.key] ?? plannerBaseline[m.key])))])
    ) as Record<MetricKey, number>;
    setPlannerLevels(restored);
    setPlanLoaded(true);
  }

  async function loadMembers() {
    try {
      setMembersLoading(true);
      setSkillsError(null);

      let myRow: FleetRosterMatrixRow | null = null;
      let fetchedPlan: Record<string, number> | null = null;

      if (canSeeRoster) {
        const response = await getFleetRosterMatrix();
        const rows = response.data ?? [];
        setMatrixRows(rows);
        setMembersLoaded(true);
        myRow = viewer?.swc_character_id
          ? (rows.find((r) => r.swc_character_id === viewer.swc_character_id) ?? null)
          : null;
      } else {
        const response = await getMySkills();
        myRow = response.data ?? null;
        fetchedPlan = response.skill_plan ?? null;
      }

      if (myRow) {
        const snapshot = Object.fromEntries(
          allMetrics.map((m) => [m.key, myRow![m.key] ?? 0])
        ) as Record<MetricKey, number>;
        setPlannerBaseline(snapshot);
        setPlannerLevels({ ...snapshot });
      }

      if (fetchedPlan && typeof fetchedPlan === "object") {
        setServerPlan(fetchedPlan as Record<MetricKey, number>);
      }
      setPlanLoaded(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load member skills.";
      setSkillsError(message);
    } finally {
      setMembersLoading(false);
    }
  }

  const toggleBtnCls = (active: boolean) =>
    BTN + " border-[rgba(246,163,0,0.3)] bg-[rgba(0,0,0,0.22)] text-[rgba(255,236,184,0.96)]" +
    (active ? " !border-[rgba(246,163,0,0.62)] bg-[linear-gradient(180deg,rgba(246,163,0,0.24),rgba(246,163,0,0.14))] shadow-[inset_0_0_0_1px_rgba(246,163,0,0.2)]" : "");

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <button className={BTN} type="button" onClick={onBack}>
          Back to Overview
        </button>
        <ReportBugButton toolKey="fleet_command" toolLabel="Fleet Command" />
      </div>

      <section className="panel">
        <div className="flex items-center justify-between gap-4 flex-wrap mb-3">
          <h2 className="h2 m-0">Biometrics</h2>
        </div>

        {canSeeRoster && (
          <div className="flex flex-wrap gap-[0.45rem] mb-4">
            <button type="button" className={toggleBtnCls(activeTab === "roster")} onClick={() => setActiveTab("roster")}>
              Roster
            </button>
            <button type="button" className={toggleBtnCls(activeTab === "planner")} onClick={() => setActiveTab("planner")}>
              Stat Planner
            </button>
          </div>
        )}

        {activeTab === "planner" && (
          <>
            <p className="small" style={{ marginTop: 0 }}>
              Plan a skill build. Each skill costs 1, 1, 2, 3, 4 points per level (max 5, total 11 to max).
            </p>

            <div className="flex items-center flex-wrap gap-[0.55rem] mb-4">
              <button
                className={BTN}
                type="button"
                onClick={loadMembers}
                disabled={membersLoading}
              >
                {membersLoading ? "Loading…" : "Load My Skills"}
              </button>
              <span className="small" style={{ opacity: 0.85 }}>
                Level increases planned: <strong>{plannerSpent}</strong>
              </span>
              <button type="button" className={BTN} onClick={resetPlanner}>
                Reset
              </button>
              {serverPlan && !planLoaded ? (
                <button type="button" className={BTN} onClick={handleLoadPlan}>
                  Load Plan
                </button>
              ) : (
                <button
                  type="button"
                  className={BTN}
                  onClick={handleSavePlan}
                  disabled={planSaving}
                >
                  {planSaving ? "Saving…" : planLoaded ? "Overwrite Plan" : "Save Plan"}
                </button>
              )}
              {planSaveError && (
                <span className="small" style={{ color: "#ff9f9f" }}>{planSaveError}</span>
              )}
            </div>

            <div className="grid grid-cols-[repeat(3,1fr)] gap-[0.7rem] mb-[0.85rem] max-[768px]:grid-cols-[repeat(2,1fr)] max-[480px]:grid-cols-1">
              {metricGroups.map((group) => (
                <div key={group.key} className="p-[0.7rem_0.8rem] rounded-[10px] border border-white/[0.08] bg-white/[0.025]">
                  <p className="small m-0 mb-[0.45rem] font-bold tracking-[0.02em] text-[rgba(255,220,138,0.95)]">{group.label}</p>
                  <div className="flex flex-col gap-[0.1rem]">
                    {group.metrics.map((metric) => {
                      const level = plannerLevels[metric.key];
                      const baseline = plannerBaseline[metric.key];
                      const deltaCost = Math.max(0, skillCost(level) - skillCost(baseline));
                      return (
                        <div key={metric.key} className="flex items-center gap-[0.5rem] py-[0.2rem]">
                          <span className="flex-1 min-w-0 text-[0.8rem] opacity-90 whitespace-nowrap overflow-hidden text-ellipsis">{metric.label}</span>
                          <div className="flex items-center gap-[0.3rem] flex-shrink-0">
                            <button
                              type="button"
                              className={BTN + " !min-h-[26px] !min-w-[26px] !p-0 leading-none text-base"}
                              onClick={() => setPlannerSkill(metric.key, level - 1)}
                              disabled={level <= baseline}
                              aria-label={`Decrease ${metric.label}`}
                            >
                              −
                            </button>
                            <span className="min-w-[1.1rem] text-center font-bold text-sm">{level}</span>
                            <button
                              type="button"
                              className={BTN + " !min-h-[26px] !min-w-[26px] !p-0 leading-none text-base"}
                              onClick={() => setPlannerSkill(metric.key, level + 1)}
                              disabled={level === 5}
                              aria-label={`Increase ${metric.label}`}
                            >
                              +
                            </button>
                            <span className="min-w-[2.6rem] text-[0.72rem] opacity-65 text-right">
                              {deltaCost > 0 ? `+${deltaCost}` : ""}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeTab === "roster" && (
          <>
            <p className="small" style={{ marginTop: 0 }}>
              Filter members, open a pilot profile, and review live SWC skill groups for command planning.
            </p>

        {!hasSkillsAccess ? (
          <div className="flex flex-col gap-4" style={{ marginBottom: 12 }}>
            <p className="small" style={{ margin: 0 }}>
              SWC scope <strong>character_skills</strong> is missing for your account.
            </p>
            <div style={{ marginTop: 10 }}>
              <button className={BTN} type="button" onClick={onRequestSwcResync}>
                Connect Biometrics Access
              </button>
            </div>
          </div>
        ) : null}

        <div className="flex gap-[10px] flex-wrap mb-[10px]">
          <button
            className={BTN}
            type="button"
            onClick={loadMembers}
            disabled={membersLoading}
          >
            {membersLoading ? "Loading skills..." : membersLoaded ? "Refresh Skills" : "Load Skills"}
          </button>
          <input
            type="text"
            className={INPUT + " min-w-[260px] flex-[1_1_300px]"}
            placeholder="Filter by member name"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
        </div>

        {skillsError ? (
          <p className="small" style={{ color: "#ff9f9f" }}>{skillsError}</p>
        ) : null}

        {hasMatrix ? (
          <section className="flex flex-col gap-4 mb-3">
            <h3 className="h3" style={{ marginTop: 0 }}>Member Skills</h3>
            <p className="small m-0 mb-[0.9rem] opacity-[0.88]">
              Expand only the categories you need and keep the sheet compact.
            </p>

            <div className="flex flex-wrap gap-[0.45rem] mb-[0.8rem]">
              {metricGroups.map((group) => {
                const open = categoryExpanded[group.key];
                return (
                  <button
                    key={group.key}
                    type="button"
                    className={toggleBtnCls(open)}
                    onClick={() => toggleCategory(group.key)}
                  >
                    {open ? `Hide ${group.label}` : `Show ${group.label}`}
                  </button>
                );
              })}
              <button type="button" className={BTN} onClick={() => setAllCategories(true)}>Show All</button>
              <button type="button" className={BTN} onClick={() => setAllCategories(false)}>Hide All</button>
            </div>

            <div className="flex items-center flex-wrap gap-[0.55rem] mb-[0.95rem]">
              <button type="button" className={BTN} onClick={clearMetricFilters}>Clear Stat Filters</button>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-[0.7rem] mb-[0.85rem]">
              {metricGroups.map((group) => {
                const open = categoryExpanded[group.key];
                if (!open) return null;
                return (
                  <div key={group.key} className="p-[0.7rem_0.8rem] rounded-[10px] border border-white/[0.08] bg-white/[0.025]">
                    <p className="small m-0 mb-[0.45rem] font-bold tracking-[0.02em] text-[rgba(255,220,138,0.95)]">{group.label} Filters</p>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-[0.5rem]">
                      {group.metrics.map((metric) => (
                        <label key={metric.key} className="grid gap-[0.3rem]">
                          <span className="opacity-90 text-[0.76rem]">{metric.label}</span>
                          <input
                            className={INPUT + " !min-h-[34px] !border-[rgba(255,255,255,0.15)] !bg-[rgba(0,0,0,0.28)]"}
                            type="number"
                            placeholder="Min"
                            value={metricMins[metric.key] ?? ""}
                            onChange={(event) => updateMetricMin(metric.key, event.target.value)}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {visibleMetrics.length === 0 ? (
              <div className="p-[0.75rem_0.8rem] rounded-[10px] border border-dashed border-white/[0.18] bg-white/[0.03] mb-[0.85rem]">
                <p className="small m-0">
                  No stat categories are visible. Use the category buttons above to show filters and columns.
                </p>
              </div>
            ) : (
              <>
              <div className="overflow-x-auto p-[0.55rem] rounded-[12px] border border-white/12 bg-[rgba(0,0,0,0.22)] [&_table_thead_tr]:bg-[rgba(246,163,0,0.13)] [&_table_tbody_tr:nth-child(even)]:bg-[rgba(255,255,255,0.018)] [&_table_tbody_tr:hover]:bg-[rgba(246,163,0,0.08)]">
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: `${Math.max(700, 280 + (visibleMetrics.length * 140))}px` }}>
                  <thead>
                    <tr>
                      <th
                        className="cursor-pointer select-none whitespace-nowrap"
                        style={{ textAlign: "left", padding: "8px 10px" }}
                        onClick={() => handleSort("name")}
                      >
                        Member <SortArrow active={sortBy === "name"} dir={sortDir} />
                      </th>
                      {visibleMetrics.map((metric) => (
                        <th
                          key={metric.key}
                          className="cursor-pointer select-none whitespace-nowrap"
                          style={{ textAlign: "right", padding: "8px 10px" }}
                          onClick={() => handleSort(metric.key)}
                        >
                          {metric.label} <SortArrow active={sortBy === metric.key} dir={sortDir} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMatrixRows.map((row) => (
                      <tr key={row.id}>
                        <td style={{ padding: "8px 10px" }}>
                          <strong>{row.handle ?? `Member #${row.id}`}</strong>
                        </td>
                        {visibleMetrics.map((metric) => (
                          <td key={`${row.id}_${metric.key}`} style={{ textAlign: "right", padding: "8px 10px" }}>
                            {row[metric.key] ?? "-"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {errorRows.length > 0 && (
                <div className="mt-3 p-[0.7rem_0.8rem] rounded-[10px] border border-[rgba(255,100,100,0.2)] bg-[rgba(255,60,60,0.06)]">
                  <p className="small m-0 mb-[0.4rem] font-bold text-[rgba(255,160,160,0.95)]">Missing member stats ({errorRows.length})</p>
                  <p className="small m-0 opacity-75">{errorRows.map((r) => r.handle ?? `Member #${r.id}`).join(", ")}</p>
                </div>
              )}
              </>
            )}
          </section>
        ) : null}
          </>
        )}
      </section>
    </>
  );
};

export default MemberFleetCommandPanel;
