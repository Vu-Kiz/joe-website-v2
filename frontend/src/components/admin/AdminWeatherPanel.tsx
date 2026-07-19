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
} from "../../api/content/weather";
import BBCodeEditor from "../bbcode/BBCodeEditor";
import BBCodeView from "../bbcode/BBCodeView";
import { BTN, BTN_SM, INPUT} from "../../utils/ui";

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
      <section className="panel flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="h2" style={{ margin: 0 }}>Weather</h2>
          <p className="small" style={{ margin: 0 }}>Loading weather admin…</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="h2" style={{ margin: 0 }}>Weather</h2>
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

      <div className="flex flex-col gap-4">
        <article className="panel flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4 max-md:items-stretch">
            <div className="flex flex-col gap-1">
              <h3 className="m-0">Daily Range</h3>
              <div className="small opacity-80">
                Current generation range: {minTemp}° to {maxTemp}°
              </div>
            </div>

            <button
              type="button"
              className={`inline-flex h-10 w-10 shrink-0 cursor-pointer flex-col justify-center gap-1 rounded-[10px] border border-white/10 bg-white/[0.03] text-inherit  font-tektur${openSection === "settings" ? "border-[#f5d546]/35 bg-[#f5d546]/10" : ""}`}
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
              <div className="flex justify-end">
                <button
                  type="button"
                  className={BTN_SM + " all"}
                  onClick={() => setSettingsFormOpen((v) => !v)}
                >
                  {settingsFormOpen ? "Close Editor" : "Edit Range"}
                </button>
              </div>

              {settingsFormOpen && (
                <form className="flex flex-col gap-3 border-t border-white/10 pt-1" onSubmit={saveSettings}>
                  <input
                    className={INPUT}
                    placeholder="Min temp"
                    value={minTemp}
                    onChange={(e) => setMinTemp(e.target.value)}
                  />
                  <input
                    className={INPUT}
                    placeholder="Max temp"
                    value={maxTemp}
                    onChange={(e) => setMaxTemp(e.target.value)}
                  />

                  <div className="flex flex-wrap gap-3">
                    <button className={BTN} type="submit">Save Range</button>
                  </div>
                </form>
              )}
            </>
          )}
        </article>

        <article className="panel flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4 max-md:items-stretch">
            <div className="flex flex-col gap-1">
              <h3 className="m-0">Hot Adjectives</h3>
              <div className="small opacity-80">
                {adjectives.length} adjective {adjectives.length === 1 ? "band" : "bands"} configured
              </div>
            </div>

            <button
              type="button"
              className={`inline-flex h-10 w-10 shrink-0 cursor-pointer flex-col justify-center gap-1 rounded-[10px] border border-white/10 bg-white/[0.03] text-inherit  font-tektur${openSection === "adjectives" ? "border-[#f5d546]/35 bg-[#f5d546]/10" : ""}`}
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
              <div className="flex justify-end">
                <button
                  type="button"
                  className={BTN_SM + " all"}
                  onClick={openAddAdjective}
                >
                  Add New
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {adjectives.map((item) => (
                  <article key={item.id} className="panel flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <h4 className="m-0">{item.word}</h4>
                      <div className="small">
                        {item.min_temp}° to {item.max_temp}°
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={BTN_SM + " all"}
                        onClick={() => openEditAdjective(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={BTN_SM + " all"}
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
                <form className="flex flex-col gap-3 border-t border-white/10 pt-1" onSubmit={saveAdj}>
                  <input
                    className={INPUT}
                    placeholder="Word"
                    value={adjWord}
                    onChange={(e) => setAdjWord(e.target.value)}
                  />
                  <input
                    className={INPUT}
                    placeholder="Min temp"
                    value={adjMin}
                    onChange={(e) => setAdjMin(e.target.value)}
                  />
                  <input
                    className={INPUT}
                    placeholder="Max temp"
                    value={adjMax}
                    onChange={(e) => setAdjMax(e.target.value)}
                  />

                  <div className="flex flex-wrap gap-3">
                    <button className={BTN} type="submit">
                      {adjectiveFormMode === "edit" ? "Save Range" : "Add Range"}
                    </button>
                    <button className={BTN_SM + " all"} type="button" onClick={resetAdj}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </article>

        <article className="panel flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4 max-md:items-stretch">
            <div className="flex flex-col gap-1">
              <h3 className="m-0">Advice Pool</h3>
              <div className="small opacity-80">
                {activeAdviceCount} active of {advice.length} total advice entries
              </div>
            </div>

            <button
              type="button"
              className={`inline-flex h-10 w-10 shrink-0 cursor-pointer flex-col justify-center gap-1 rounded-[10px] border border-white/10 bg-white/[0.03] text-inherit  font-tektur${openSection === "advice" ? "border-[#f5d546]/35 bg-[#f5d546]/10" : ""}`}
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
              <div className="flex justify-end">
                <button
                  type="button"
                  className={BTN_SM + " all"}
                  onClick={openAddAdvice}
                >
                  Add New
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {advice.map((item) => (
                  <article key={item.id} className="panel flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="small">
                        Weight {item.weight} · {item.is_active ? "Active" : "Inactive"}
                      </div>
                      <div className="small m-0">
                        <BBCodeView value={item.advice} className="small" />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className={BTN_SM + " all"}
                        onClick={() => openEditAdvice(item)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className={BTN_SM + " all"}
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
                <form className="flex flex-col gap-3 border-t border-white/10 pt-1" onSubmit={saveAdv}>
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
                    className={INPUT}
                    placeholder="Weight"
                    value={advWeight}
                    onChange={(e) => setAdvWeight(e.target.value)}
                  />

                  <label className="inline-flex min-h-10 items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.02] px-3 py-2" style={{ maxWidth: "220px" }}>
                    <input
                      type="checkbox"
                      checked={advActive}
                      onChange={() => setAdvActive((v) => !v)}
                    />
                    <span>Active</span>
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <button className={BTN} type="submit">
                      {adviceFormMode === "edit" ? "Save Advice" : "Add Advice"}
                    </button>
                    <button className={BTN_SM + " all"} type="button" onClick={resetAdv}>
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
