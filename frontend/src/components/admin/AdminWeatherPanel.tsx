import React, { useEffect, useMemo, useState } from "react";
import {
  getAdminWeather,
  updateWeatherSettings,
  createWeatherAdjective,
  updateWeatherAdjective,
  deleteWeatherAdjective,
  createWeatherAdvice,
  updateWeatherAdvice,
  deleteWeatherAdvice,
  type WeatherAdjective,
  type WeatherAdviceItem,
} from "../../api/weather";
import BBCodeEditor from "../bbcode/BBCodeEditor";
import BBCodeView from "../bbcode/BBCodeView";

type OpenSection = "settings" | "adjectives" | "advice" | null;
type FormMode = "create" | "edit" | null;

const AdminWeatherPanel: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [adjectives, setAdjectives] = useState<WeatherAdjective[]>([]);
  const [advice, setAdvice] = useState<WeatherAdviceItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [openSection, setOpenSection] = useState<OpenSection>(null);

  const [settingsFormOpen, setSettingsFormOpen] = useState(false);
  const [adjectiveFormMode, setAdjectiveFormMode] = useState<FormMode>(null);
  const [adviceFormMode, setAdviceFormMode] = useState<FormMode>(null);

  const [minTemp, setMinTemp] = useState("34");
  const [maxTemp, setMaxTemp] = useState("57");

  const [adjId, setAdjId] = useState<number | null>(null);
  const [adjWord, setAdjWord] = useState("");
  const [adjMin, setAdjMin] = useState("");
  const [adjMax, setAdjMax] = useState("");

  const [advId, setAdvId] = useState<number | null>(null);
  const [advText, setAdvText] = useState("");
  const [advWeight, setAdvWeight] = useState("1");
  const [advActive, setAdvActive] = useState(true);

  const activeAdviceCount = useMemo(
    () => advice.filter((item) => item.is_active).length,
    [advice]
  );

  const load = async () => {
    const res = await getAdminWeather();
    setAdjectives(Array.isArray(res.adjectives) ? res.adjectives : []);
    setAdvice(Array.isArray(res.advice) ? res.advice : []);
    setMinTemp(String(res.settings?.min_temp ?? 34));
    setMaxTemp(String(res.settings?.max_temp ?? 57));
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await getAdminWeather();
        if (cancelled) return;

        setAdjectives(Array.isArray(res.adjectives) ? res.adjectives : []);
        setAdvice(Array.isArray(res.advice) ? res.advice : []);
        setMinTemp(String(res.settings?.min_temp ?? 34));
        setMaxTemp(String(res.settings?.max_temp ?? 57));
      } catch (e: any) {
        if (!cancelled) {
          console.error("AdminWeatherPanel load error:", e);
          setError(e?.message ?? "Failed to load weather admin data");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const closeAllForms = () => {
    setSettingsFormOpen(false);
    setAdjectiveFormMode(null);
    setAdviceFormMode(null);
  };

  const toggleSection = (section: OpenSection) => {
    setOpenSection((current) => {
      const next = current === section ? null : section;
      closeAllForms();
      return next;
    });
  };

  const resetAdj = () => {
    setAdjId(null);
    setAdjWord("");
    setAdjMin("");
    setAdjMax("");
    setAdjectiveFormMode(null);
  };

  const resetAdv = () => {
    setAdvId(null);
    setAdvText("");
    setAdvWeight("1");
    setAdvActive(true);
    setAdviceFormMode(null);
  };

  const openAddAdjective = () => {
    setAdjId(null);
    setAdjWord("");
    setAdjMin("");
    setAdjMax("");
    setAdjectiveFormMode("create");
  };

  const openEditAdjective = (item: WeatherAdjective) => {
    setAdjId(item.id);
    setAdjWord(item.word);
    setAdjMin(String(item.min_temp));
    setAdjMax(String(item.max_temp));
    setAdjectiveFormMode("edit");
  };

  const openAddAdvice = () => {
    setAdvId(null);
    setAdvText("");
    setAdvWeight("1");
    setAdvActive(true);
    setAdviceFormMode("create");
  };

  const openEditAdvice = (item: WeatherAdviceItem) => {
    setAdvId(item.id);
    setAdvText(item.advice);
    setAdvWeight(String(item.weight));
    setAdvActive(item.is_active);
    setAdviceFormMode("edit");
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    try {
      await updateWeatherSettings({
        min_temp: Number(minTemp),
        max_temp: Number(maxTemp),
      });

      setNotice("Weather settings saved.");
      await load();
      setSettingsFormOpen(false);
    } catch (e: any) {
      console.error("saveSettings error:", e);
      setError(e?.message ?? "Failed to save weather settings");
    }
  };

  const saveAdj = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const payload = {
      word: adjWord.trim(),
      min_temp: Number(adjMin),
      max_temp: Number(adjMax),
    };

    try {
      if (adjectiveFormMode === "edit" && adjId) {
        await updateWeatherAdjective(adjId, payload);
        setNotice("Adjective updated.");
      } else {
        await createWeatherAdjective(payload);
        setNotice("Adjective created.");
      }

      await load();
      resetAdj();
    } catch (e: any) {
      console.error("saveAdj error:", e);
      setError(e?.message ?? "Failed to save adjective");
    }
  };

  const saveAdv = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const payload = {
      advice: advText,
      weight: Number(advWeight),
      is_active: advActive,
    };

    try {
      if (adviceFormMode === "edit" && advId) {
        await updateWeatherAdvice(advId, payload);
        setNotice("Advice updated.");
      } else {
        await createWeatherAdvice(payload);
        setNotice("Advice created.");
      }

      await load();
      resetAdv();
    } catch (e: any) {
      console.error("saveAdv error:", e);
      setError(e?.message ?? "Failed to save advice");
    }
  };

  if (loading) {
    return (
      <section className="panel admin-panel">
        <div className="admin-panel__header">
          <h2 style={{ margin: 0 }}>Weather</h2>
          <p className="small" style={{ margin: 0 }}>Loading weather admin…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel admin-panel">
      <div className="admin-panel__header">
        <h2 style={{ margin: 0 }}>Weather</h2>
        <p className="small" style={{ margin: 0 }}>
          Manage daily temperature generation, adjective bands, and advice pool.
        </p>
      </div>

      {notice && (
        <p className="small" style={{ color: "#9fda9f", margin: 0 }}>
          {notice}
        </p>
      )}

      {error && (
        <p className="small" style={{ color: "salmon", margin: 0 }}>
          {error}
        </p>
      )}

      <div className="admin-weather-stack">
        <article className="panel admin-weather-card">
          <div className="admin-weather-card__top">
            <div className="admin-weather-card__copy">
              <h3 className="admin-weather-card__title">Daily Range</h3>
              <div className="small admin-weather-card__meta">
                Current generation range: {minTemp}° to {maxTemp}°
              </div>
            </div>

            <button
              type="button"
              className={"admin-users-menu-btn" + (openSection === "settings" ? " is-open" : "")}
              onClick={() => toggleSection("settings")}
              aria-label={openSection === "settings" ? "Close daily range" : "Open daily range"}
              aria-expanded={openSection === "settings"}
            >
              <span />
              <span />
              <span />
            </button>
          </div>

          {openSection === "settings" && (
            <>
              <div className="admin-weather-section__actions">
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={() => setSettingsFormOpen((v) => !v)}
                >
                  {settingsFormOpen ? "Close Editor" : "Edit Range"}
                </button>
              </div>

              {settingsFormOpen && (
                <form className="admin-weather-form admin-weather-form--boxed" onSubmit={saveSettings}>
                  <input
                    className="input"
                    placeholder="Min temp"
                    value={minTemp}
                    onChange={(e) => setMinTemp(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Max temp"
                    value={maxTemp}
                    onChange={(e) => setMaxTemp(e.target.value)}
                  />

                  <div className="admin-card__actions">
                    <button className="btn" type="submit">Save Range</button>
                  </div>
                </form>
              )}
            </>
          )}
        </article>

        <article className="panel admin-weather-card">
          <div className="admin-weather-card__top">
            <div className="admin-weather-card__copy">
              <h3 className="admin-weather-card__title">Hot Adjectives</h3>
              <div className="small admin-weather-card__meta">
                {adjectives.length} adjective {adjectives.length === 1 ? "band" : "bands"} configured
              </div>
            </div>

            <button
              type="button"
              className={"admin-users-menu-btn" + (openSection === "adjectives" ? " is-open" : "")}
              onClick={() => toggleSection("adjectives")}
              aria-label={openSection === "adjectives" ? "Close adjectives" : "Open adjectives"}
              aria-expanded={openSection === "adjectives"}
            >
              <span />
              <span />
              <span />
            </button>
          </div>

          {openSection === "adjectives" && (
            <>
              <div className="admin-weather-section__actions">
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={openAddAdjective}
                >
                  Add New
                </button>
              </div>

              <div className="admin-tip-list__items">
                {adjectives.map((item) => (
                  <article key={item.id} className="panel admin-tip-card">
                    <div className="admin-tip-card__copy">
                      <h4 className="admin-tip-card__title">{item.word}</h4>
                      <div className="small admin-tip-card__meta">
                        {item.min_temp}° to {item.max_temp}°
                      </div>
                    </div>

                    <div className="admin-tip-card__actions">
                      <button
                        type="button"
                        className="btn btn--small"
                        onClick={() => openEditAdjective(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--small"
                        onClick={async () => {
                          try {
                            await deleteWeatherAdjective(item.id);
                            await load();
                            setNotice("Adjective deleted.");
                          } catch (e: any) {
                            console.error("delete adjective error:", e);
                            setError(e?.message ?? "Failed to delete adjective");
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {adjectiveFormMode && (
                <form className="admin-weather-form admin-weather-form--boxed" onSubmit={saveAdj}>
                  <input
                    className="input"
                    placeholder="Word"
                    value={adjWord}
                    onChange={(e) => setAdjWord(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Min temp"
                    value={adjMin}
                    onChange={(e) => setAdjMin(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Max temp"
                    value={adjMax}
                    onChange={(e) => setAdjMax(e.target.value)}
                  />

                  <div className="admin-card__actions">
                    <button className="btn" type="submit">
                      {adjectiveFormMode === "edit" ? "Save Range" : "Add Range"}
                    </button>
                    <button className="btn btn--small" type="button" onClick={resetAdj}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </article>

        <article className="panel admin-weather-card">
          <div className="admin-weather-card__top">
            <div className="admin-weather-card__copy">
              <h3 className="admin-weather-card__title">Advice Pool</h3>
              <div className="small admin-weather-card__meta">
                {activeAdviceCount} active of {advice.length} total advice entries
              </div>
            </div>

            <button
              type="button"
              className={"admin-users-menu-btn" + (openSection === "advice" ? " is-open" : "")}
              onClick={() => toggleSection("advice")}
              aria-label={openSection === "advice" ? "Close advice" : "Open advice"}
              aria-expanded={openSection === "advice"}
            >
              <span />
              <span />
              <span />
            </button>
          </div>

          {openSection === "advice" && (
            <>
              <div className="admin-weather-section__actions">
                <button
                  type="button"
                  className="btn btn--small"
                  onClick={openAddAdvice}
                >
                  Add New
                </button>
              </div>

              <div className="admin-tip-list__items">
                {advice.map((item) => (
                  <article key={item.id} className="panel admin-tip-card">
                    <div className="admin-tip-card__copy">
                      <div className="small admin-tip-card__meta">
                        Weight {item.weight} · {item.is_active ? "Active" : "Inactive"}
                      </div>
                      <div className="small admin-tip-card__body">
                        <BBCodeView value={item.advice} className="small" />
                      </div>
                    </div>

                    <div className="admin-tip-card__actions">
                      <button
                        type="button"
                        className="btn btn--small"
                        onClick={() => openEditAdvice(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn--small"
                        onClick={async () => {
                          try {
                            await deleteWeatherAdvice(item.id);
                            await load();
                            setNotice("Advice deleted.");
                          } catch (e: any) {
                            console.error("delete advice error:", e);
                            setError(e?.message ?? "Failed to delete advice");
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              {adviceFormMode && (
                <form className="admin-weather-form admin-weather-form--boxed" onSubmit={saveAdv}>
                  <div className="field">
                    <label className="field__label">Advice</label>
                    <BBCodeEditor
                      value={advText}
                      onChange={setAdvText}
                      rows={8}
                      toolbarMode="basic"
                    />
                  </div>

                  <input
                    className="input"
                    placeholder="Weight"
                    value={advWeight}
                    onChange={(e) => setAdvWeight(e.target.value)}
                  />

                  <label className="admin-users-perm" style={{ maxWidth: "220px" }}>
                    <input
                      type="checkbox"
                      checked={advActive}
                      onChange={() => setAdvActive((v) => !v)}
                    />
                    <span>Active</span>
                  </label>

                  <div className="admin-card__actions">
                    <button className="btn" type="submit">
                      {adviceFormMode === "edit" ? "Save Advice" : "Add Advice"}
                    </button>
                    <button className="btn btn--small" type="button" onClick={resetAdv}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </article>
      </div>
    </section>
  );
};

export default AdminWeatherPanel;