import React, { useEffect, useMemo, useState } from "react";
import type { DroidBrainFilters, DroidBrainTab } from "../../api/droidbrain";

type Props = {
  activeTab: DroidBrainTab;
  filters: DroidBrainFilters;
  isRestrictedView: boolean;
  options: {
    uploader_options: string[];
    type_options: string[];
    class_options: string[];
    system_options: string[];
    planet_options: string[];
    owner_options: string[];
  };
  onChange: (patch: Record<string, string | null>) => void;
};

const DroidBrainFiltersPanel: React.FC<Props> = ({ activeTab, filters, isRestrictedView, options, onChange }) => (
  <DroidBrainFiltersPanelInner
    activeTab={activeTab}
    filters={filters}
    isRestrictedView={isRestrictedView}
    options={options}
    onChange={onChange}
  />
);

const DroidBrainFiltersPanelInner: React.FC<Props> = ({
  activeTab,
  filters,
  isRestrictedView,
  options,
  onChange,
}) => {
  const [typeQuery, setTypeQuery] = useState(filters.type);
  const [showTypeMatches, setShowTypeMatches] = useState(false);
  const [systemQuery, setSystemQuery] = useState(filters.system);
  const [showSystemMatches, setShowSystemMatches] = useState(false);
  const [classQuery, setClassQuery] = useState(filters.class);
  const [showClassMatches, setShowClassMatches] = useState(false);
  const [planetQuery, setPlanetQuery] = useState(filters.planet);
  const [showPlanetMatches, setShowPlanetMatches] = useState(false);
  const [ownerQuery, setOwnerQuery] = useState(filters.owner);
  const [showOwnerMatches, setShowOwnerMatches] = useState(false);

  useEffect(() => {
    setTypeQuery(filters.type);
  }, [filters.type]);

  useEffect(() => {
    setSystemQuery(filters.system);
  }, [filters.system]);

  useEffect(() => {
    setClassQuery(filters.class);
  }, [filters.class]);

  useEffect(() => {
    setPlanetQuery(filters.planet);
  }, [filters.planet]);

  useEffect(() => {
    setOwnerQuery(filters.owner);
  }, [filters.owner]);

  const showTypeFilter = ["ships", "stations", "vehicles", "npcs"].includes(activeTab);
  const showClassFilter = ["ships", "vehicles", "npcs"].includes(activeTab);
  const showSystemFilter = ["ships", "stations", "planets"].includes(activeTab);
  const showPlanetFilter = ["ships", "stations", "cities", "vehicles", "npcs"].includes(activeTab);
  const filteredSystemOptions = useMemo(() => {
    const query = systemQuery.trim().toLowerCase();
    if (!query) {
      return options.system_options.slice(0, 12);
    }

    return options.system_options
      .filter((option) => option.toLowerCase().includes(query))
      .slice(0, 12);
  }, [options.system_options, systemQuery]);

  const filteredTypeOptions = useMemo(() => {
    const query = typeQuery.trim().toLowerCase();
    if (!query) {
      return options.type_options.slice(0, 12);
    }

    return options.type_options
      .filter((option) => option.toLowerCase().includes(query))
      .slice(0, 12);
  }, [options.type_options, typeQuery]);

  const filteredClassOptions = useMemo(() => {
    const query = classQuery.trim().toLowerCase();
    if (!query) {
      return options.class_options.slice(0, 12);
    }

    return options.class_options
      .filter((option) => option.toLowerCase().includes(query))
      .slice(0, 12);
  }, [classQuery, options.class_options]);

  const filteredPlanetOptions = useMemo(() => {
    const query = planetQuery.trim().toLowerCase();
    if (!query) {
      return options.planet_options.slice(0, 12);
    }

    return options.planet_options
      .filter((option) => option.toLowerCase().includes(query))
      .slice(0, 12);
  }, [options.planet_options, planetQuery]);

  const filteredOwnerOptions = useMemo(() => {
    const query = ownerQuery.trim().toLowerCase();
    if (!query) {
      return options.owner_options.slice(0, 12);
    }

    return options.owner_options
      .filter((option) => option.toLowerCase().includes(query))
      .slice(0, 12);
  }, [options.owner_options, ownerQuery]);

  return (
    <div className="panel" style={{ marginBottom: 12 }}>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {activeTab !== "summary" && (
          <>
            {!isRestrictedView ? (
              <label className="small">
                Search
                <input
                  className="input"
                  value={filters.q}
                  onChange={(e) => onChange({ q: e.target.value, page: null })}
                  placeholder="Name, free text, or UID"
                />
              </label>
            ) : null}

            <label className="small">
              Exact ID
              <input
                className="input"
                value={filters.uid}
                onChange={(e) => onChange({ uid: e.target.value, page: null })}
                placeholder="123456"
              />
            </label>

          </>
        )}

        {!isRestrictedView && showTypeFilter ? (
          <div className="small">
            <label className="small" htmlFor="droidbrain-type-filter">
              {activeTab === "npcs" ? "Race / Type" : "Type"}
            </label>
            <div
              className="members-universe__typeahead"
              style={{ minWidth: 0, width: "100%", flex: "1 1 auto" }}
            >
              <input
                id="droidbrain-type-filter"
                className="input"
                value={typeQuery}
                onChange={(event) => {
                  setTypeQuery(event.target.value);
                  onChange({ type: event.target.value, page: null });
                  setShowTypeMatches(true);
                }}
                onFocus={() => setShowTypeMatches(true)}
                onBlur={() => {
                  window.setTimeout(() => setShowTypeMatches(false), 120);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onChange({ type: typeQuery.trim(), page: null });
                    setShowTypeMatches(false);
                  }
                }}
                placeholder={activeTab === "npcs" ? "Type a race or type" : "Type a type name"}
                autoComplete="off"
              />
              {showTypeMatches && filteredTypeOptions.length ? (
                <div className="members-universe__typeahead-list">
                  {filteredTypeOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`members-universe__typeahead-option${
                        option === filters.type ? " is-active" : ""
                      }`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setTypeQuery(option);
                        onChange({ type: option, page: null });
                        setShowTypeMatches(false);
                      }}
                    >
                      <strong>{option}</strong>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isRestrictedView && showClassFilter ? (
          <div className="small">
            <label className="small" htmlFor="droidbrain-class-filter">
              Class
            </label>
            <div
              className="members-universe__typeahead"
              style={{ minWidth: 0, width: "100%", flex: "1 1 auto" }}
            >
              <input
                id="droidbrain-class-filter"
                className="input"
                value={classQuery}
                onChange={(event) => {
                  setClassQuery(event.target.value);
                  onChange({ class: event.target.value, page: null });
                  setShowClassMatches(true);
                }}
                onFocus={() => setShowClassMatches(true)}
                onBlur={() => {
                  window.setTimeout(() => setShowClassMatches(false), 120);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onChange({ class: classQuery.trim(), page: null });
                    setShowClassMatches(false);
                  }
                }}
                placeholder="Type a class name"
                autoComplete="off"
              />
              {showClassMatches && filteredClassOptions.length ? (
                <div className="members-universe__typeahead-list">
                  {filteredClassOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`members-universe__typeahead-option${
                        option === filters.class ? " is-active" : ""
                      }`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setClassQuery(option);
                        onChange({ class: option, page: null });
                        setShowClassMatches(false);
                      }}
                    >
                      <strong>{option}</strong>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isRestrictedView && showSystemFilter ? (
          <div className="small">
            <label className="small" htmlFor="droidbrain-system-filter">
              System
            </label>
            <div
              className="members-universe__typeahead"
              style={{ minWidth: 0, width: "100%", flex: "1 1 auto" }}
            >
              <input
                id="droidbrain-system-filter"
                className="input"
                value={systemQuery}
                onChange={(event) => {
                  setSystemQuery(event.target.value);
                  onChange({ system: event.target.value, page: null });
                  setShowSystemMatches(true);
                }}
                onFocus={() => setShowSystemMatches(true)}
                onBlur={() => {
                  window.setTimeout(() => setShowSystemMatches(false), 120);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onChange({ system: systemQuery.trim(), page: null });
                    setShowSystemMatches(false);
                  }
                }}
                placeholder="Type a system name"
                autoComplete="off"
              />
              {showSystemMatches && filteredSystemOptions.length ? (
                <div className="members-universe__typeahead-list">
                  {filteredSystemOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`members-universe__typeahead-option${
                        option === filters.system ? " is-active" : ""
                      }`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setSystemQuery(option);
                        onChange({ system: option, page: null });
                        setShowSystemMatches(false);
                      }}
                    >
                      <strong>{option}</strong>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isRestrictedView && showPlanetFilter ? (
          <div className="small">
            <label className="small" htmlFor="droidbrain-planet-filter">
              Planet
            </label>
            <div
              className="members-universe__typeahead"
              style={{ minWidth: 0, width: "100%", flex: "1 1 auto" }}
            >
              <input
                id="droidbrain-planet-filter"
                className="input"
                value={planetQuery}
                onChange={(event) => {
                  setPlanetQuery(event.target.value);
                  onChange({ planet: event.target.value, page: null });
                  setShowPlanetMatches(true);
                }}
                onFocus={() => setShowPlanetMatches(true)}
                onBlur={() => {
                  window.setTimeout(() => setShowPlanetMatches(false), 120);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onChange({ planet: planetQuery.trim(), page: null });
                    setShowPlanetMatches(false);
                  }
                }}
                placeholder="Type a planet name"
                autoComplete="off"
              />
              {showPlanetMatches && filteredPlanetOptions.length ? (
                <div className="members-universe__typeahead-list">
                  {filteredPlanetOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`members-universe__typeahead-option${
                        option === filters.planet ? " is-active" : ""
                      }`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setPlanetQuery(option);
                        onChange({ planet: option, page: null });
                        setShowPlanetMatches(false);
                      }}
                    >
                      <strong>{option}</strong>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {!isRestrictedView ? (
        <div className="small">
          <label className="small" htmlFor="droidbrain-owner-filter">
            Owner
          </label>
          <div
            className="members-universe__typeahead"
            style={{ minWidth: 0, width: "100%", flex: "1 1 auto" }}
          >
            <input
              id="droidbrain-owner-filter"
              className="input"
              value={ownerQuery}
              onChange={(event) => {
                setOwnerQuery(event.target.value);
                onChange({ owner: event.target.value, page: null });
                setShowOwnerMatches(true);
              }}
              onFocus={() => setShowOwnerMatches(true)}
              onBlur={() => {
                window.setTimeout(() => setShowOwnerMatches(false), 120);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onChange({ owner: ownerQuery.trim(), page: null });
                  setShowOwnerMatches(false);
                }
              }}
              placeholder="Type an owner name"
              autoComplete="off"
            />
            {showOwnerMatches && filteredOwnerOptions.length ? (
              <div className="members-universe__typeahead-list">
                {filteredOwnerOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`members-universe__typeahead-option${
                      option === filters.owner ? " is-active" : ""
                    }`}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setOwnerQuery(option);
                      onChange({ owner: option, page: null });
                      setShowOwnerMatches(false);
                    }}
                  >
                    <strong>{option}</strong>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
};

export default DroidBrainFiltersPanel;
