import React, { useEffect, useMemo, useState } from "react";
import { getFleetRosterMatrix, type FleetRosterMatrixRow } from "../../api/fleetCommander";
import type { SwcAuthorizationStatus } from "../../api/swcAuthorization";

type Props = {
  onBack: () => void;
  swcAuth: SwcAuthorizationStatus | null;
  onRequestSwcResync: () => void;
};

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
  swcAuth,
  onRequestSwcResync,
}) => {
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [filter, setFilter] = useState("");
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [matrixRows, setMatrixRows] = useState<FleetRosterMatrixRow[]>([]);
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [metricMins, setMetricMins] = useState<Partial<Record<MetricKey, string>>>({});
  const [categoryExpanded, setCategoryExpanded] = useState<Record<CategoryKey, boolean>>(initialCategoryExpanded);

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

  const filteredMatrixRows = useMemo(() => {
    const query = filter.trim().toLowerCase();

    const list = matrixRows.filter((row) => {
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

  async function loadMembers() {
    try {
      setMembersLoading(true);
      setSkillsError(null);
      const response = await getFleetRosterMatrix();
      const rows = response.data ?? [];
      setMatrixRows(rows);
      setMembersLoaded(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load member skills.";
      setSkillsError(message);
    } finally {
      setMembersLoading(false);
    }
  }

  return (
    <>
      <div className="members-tool-back">
        <button className="btn" type="button" onClick={onBack}>
          Back to Overview
        </button>
      </div>

      <section className="panel">
        <h2 style={{ marginTop: 0 }}>Biometrics</h2>
        <p className="small" style={{ marginTop: 0 }}>
          Filter members, open a pilot profile, and review live SWC skill groups for command planning.
        </p>

        {!hasSkillsAccess ? (
          <div className="admin-card" style={{ marginBottom: 12 }}>
            <p className="small" style={{ margin: 0 }}>
              SWC scope <strong>character_skills</strong> is missing for your account.
            </p>
            <div style={{ marginTop: 10 }}>
              <button className="btn" type="button" onClick={onRequestSwcResync}>
                Connect Biometrics Access
              </button>
            </div>
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={loadMembers}
            disabled={membersLoading}
          >
            {membersLoading ? "Loading skills..." : membersLoaded ? "Refresh Skills" : "Load Skills"}
          </button>
          <input
            type="text"
            className="input"
            placeholder="Filter by member name"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            style={{ minWidth: 260, flex: "1 1 300px" }}
          />
        </div>

        {skillsError ? (
          <p className="small" style={{ color: "#ff9f9f" }}>{skillsError}</p>
        ) : null}

        {hasMatrix ? (
          <section className="admin-card biometrics-sheet">
            <h3 style={{ marginTop: 0 }}>Member Skills</h3>
            <p className="small biometrics-sheet__subtitle">
              Expand only the categories you need and keep the sheet compact.
            </p>

            <div className="biometrics-sheet__toggle-row">
              {metricGroups.map((group) => {
                const open = categoryExpanded[group.key];
                return (
                  <button
                    key={group.key}
                    type="button"
                    className={`btn biometrics-sheet__toggle ${open ? "is-active" : ""}`}
                    onClick={() => toggleCategory(group.key)}
                  >
                    {open ? `Hide ${group.label}` : `Show ${group.label}`}
                  </button>
                );
              })}
              <button type="button" className="btn btn-secondary" onClick={() => setAllCategories(true)}>
                Show All
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setAllCategories(false)}>
                Hide All
              </button>
            </div>

            <div className="biometrics-sheet__sort-row">
              <select
                className="input"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as SortKey)}
                style={{ width: 220, maxWidth: "100%" }}
              >
                <option value="name">Sort: Member</option>
                {visibleMetrics.map((metric) => (
                  <option key={metric.key} value={metric.key}>{`Sort: ${metric.label}`}</option>
                ))}
              </select>
              <select
                className="input"
                value={sortDir}
                onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
                style={{ width: 120 }}
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
              <button type="button" className="btn btn-secondary" onClick={clearMetricFilters}>
                Clear Stat Filters
              </button>
            </div>

            <div className="biometrics-sheet__filters-grid">
              {metricGroups.map((group) => {
                const open = categoryExpanded[group.key];
                if (!open) {
                  return null;
                }

                return (
                  <div key={group.key} className="biometrics-filter-card">
                    <p className="small biometrics-filter-card__title">{group.label} Filters</p>
                    <div className="biometrics-filter-card__inputs">
                      {group.metrics.map((metric) => (
                        <label key={metric.key} className="small biometrics-filter-card__input-wrap">
                          <span>{metric.label}</span>
                          <input
                            className="input"
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
              <div className="biometrics-sheet__empty">
                <p className="small" style={{ margin: 0 }}>
                  No stat categories are visible. Use the category buttons above to show filters and columns.
                </p>
              </div>
            ) : (
              <div className="biometrics-sheet__table-wrap">
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: `${Math.max(700, 280 + (visibleMetrics.length * 140))}px` }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>Member</th>
                      {visibleMetrics.map((metric) => (
                        <th key={metric.key} style={{ textAlign: "right", padding: "8px 10px" }}>
                          {metric.label}
                        </th>
                      ))}
                      <th style={{ textAlign: "left", padding: "8px 10px" }}>Snapshot</th>
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
                        <td style={{ padding: "8px 10px" }} className="small">
                          {row.fetched_at ? "Fresh" : (row.snapshot_error ? "Error" : "Pending")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}
      </section>
    </>
  );
};

export default MemberFleetCommandPanel;
