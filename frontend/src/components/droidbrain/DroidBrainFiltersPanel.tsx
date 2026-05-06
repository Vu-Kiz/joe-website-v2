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
  onSubmit: (filters: DroidBrainFilters) => void;
  onReset: () => void;
};

const DroidBrainFiltersPanel: React.FC<Props> = ({ activeTab, filters, isRestrictedView, options, onSubmit, onReset }) => (
  <DroidBrainFiltersPanelInner
    activeTab={activeTab}
    filters={filters}
    isRestrictedView={isRestrictedView}
    options={options}
    onSubmit={onSubmit}
    onReset={onReset}
  />
);

const DroidBrainFiltersPanelInner: React.FC<Props> = ({
  activeTab,
  filters,
  isRestrictedView,
  options,
  onSubmit,
  onReset,
}) => {
  const [searchQuery, setSearchQuery] = useState(filters.q);
  const [uidQuery, setUidQuery] = useState(filters.uid);
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
    setSearchQuery(filters.q);
  }, [filters.q]);

  useEffect(() => {
    setUidQuery(filters.uid);
  }, [filters.uid]);

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

  const applyFilters = () => {
    onSubmit({
      q: searchQuery.trim(),
      uid: uidQuery.trim(),
      uploader: filters.uploader,
      type: typeQuery.trim(),
      class: classQuery.trim(),
      system: systemQuery.trim(),
      planet: planetQuery.trim(),
      owner: ownerQuery.trim(),
    });
  };

  const handleReset = () => {
    setSearchQuery("");
    setUidQuery("");
    setTypeQuery("");
    setClassQuery("");
    setSystemQuery("");
    setPlanetQuery("");
    setOwnerQuery("");
    onReset();
  };

  return (
    <div
      className="panel"
      style={{ marginBottom: 12 }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          applyFilters();
        }
      }}
    >
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        {activeTab !== "summary" && (
          <>
            {!isRestrictedView ? (
              <label className="small">
                Search
                <input
                  className="input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Name, free text, or UID"
                />
              </label>
            ) : null}

            <label className="small">
              Exact ID
              <input
                className="input"
                value={uidQuery}
                onChange={(e) => setUidQuery(e.target.value)}
                placeholder="Exact UID match"
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
                  setShowTypeMatches(true);
                }}
                onFocus={() => setShowTypeMatches(true)}
                onBlur={() => {
                  window.setTimeout(() => setShowTypeMatches(false), 120);
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
                  setShowClassMatches(true);
                }}
                onFocus={() => setShowClassMatches(true)}
                onBlur={() => {
                  window.setTimeout(() => setShowClassMatches(false), 120);
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
                  setShowSystemMatches(true);
                }}
                onFocus={() => setShowSystemMatches(true)}
                onBlur={() => {
                  window.setTimeout(() => setShowSystemMatches(false), 120);
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
                  setShowPlanetMatches(true);
                }}
                onFocus={() => setShowPlanetMatches(true)}
                onBlur={() => {
                  window.setTimeout(() => setShowPlanetMatches(false), 120);
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
                setShowOwnerMatches(true);
              }}
              onFocus={() => setShowOwnerMatches(true)}
              onBlur={() => {
                window.setTimeout(() => setShowOwnerMatches(false), 120);
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
      {activeTab !== "summary" ? (
        <div className="payments-actions" style={{ marginTop: 12 }}>
          <button className="btn" type="button" onClick={applyFilters}>
            Search
          </button>
          <button className="btn btn-secondary" type="button" onClick={handleReset}>
            Clear
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default DroidBrainFiltersPanel;
