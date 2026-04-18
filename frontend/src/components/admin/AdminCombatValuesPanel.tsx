import React, { useEffect, useMemo, useState } from "react";
import {
  getDebugCombatSettings,
  updateDebugCombatSettings,
  type DebugCombatSettingsResponse,
} from "../../api/sysDebug";

type CombatSettingsPayload = DebugCombatSettingsResponse["data"];

const tableWrapStyle: React.CSSProperties = {
  overflow: "auto",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 12,
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  minWidth: 980,
  borderCollapse: "collapse",
};

const thtdStyle: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,0.08)",
  padding: "0.55rem",
  textAlign: "center",
};

const inputStyle: React.CSSProperties = {
  width: "5.5rem",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  color: "inherit",
  padding: "0.45rem 0.55rem",
};

const AdminCombatValuesPanel: React.FC = () => {
  const [settings, setSettings] = useState<CombatSettingsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedDamageType, setSelectedDamageType] = useState<string>("energy (heavy)");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const response = await getDebugCombatSettings();

        if (cancelled) return;

        setSettings(response.data);
        setSelectedDamageType((current) =>
          response.data.weapon_damage_types.includes(current)
            ? current
            : response.data.weapon_damage_types[0] ?? "energy (heavy)"
        );
        setError(null);
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load combat values.");
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

  const shipClasses = settings?.ship_classes ?? [];
  const shipDamageTypeModifiers = settings?.ship_damage_type_modifiers ?? {};
  const shipClassModifiers = settings?.ship_class_modifiers ?? {};

  const selectedMatrix = useMemo(
    () => shipClassModifiers[selectedDamageType] ?? {},
    [shipClassModifiers, selectedDamageType]
  );

  const setDamageTypeModifier = (damageType: string, value: string) => {
    const nextValue = Number(value);
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        ship_damage_type_modifiers: {
          ...current.ship_damage_type_modifiers,
          [damageType]: Number.isFinite(nextValue) ? nextValue : 0,
        },
      };
    });
  };

  const setShipClassModifier = (damageType: string, attackerClass: string, defenderClass: string, value: string) => {
    const nextValue = Number(value);
    setSettings((current) => {
      if (!current) return current;
      return {
        ...current,
        ship_class_modifiers: {
          ...current.ship_class_modifiers,
          [damageType]: {
            ...(current.ship_class_modifiers[damageType] ?? {}),
            [attackerClass]: {
              ...((current.ship_class_modifiers[damageType] ?? {})[attackerClass] ?? {}),
              [defenderClass]: Number.isFinite(nextValue) ? nextValue : 0,
            },
          },
        },
      };
    });
  };

  const saveSettings = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      const response = await updateDebugCombatSettings({
        ship_damage_type_modifiers: settings.ship_damage_type_modifiers,
        ship_class_modifiers: settings.ship_class_modifiers,
      });
      setSettings(response.data);
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save combat values.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="panel">
        <p className="small">Loading combat values…</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      {error ? (
        <div className="panel">
          <p className="small" style={{ color: "salmon" }}>{error}</p>
        </div>
      ) : null}

      <div className="panel" style={{ display: "grid", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <div>
            <h2>Combat Values</h2>
            <p className="small">
              DB-backed combat math tables for ship heatmap testing and future combat calculators.
            </p>
          </div>
          <button className="btn" type="button" onClick={saveSettings} disabled={saving || !settings}>
            {saving ? "Saving…" : "Save Combat Values"}
          </button>
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          <div>
            <h3>Ship Damage Type Modifiers</h3>
            <p className="small">These apply after armour reduction for ship, vehicle, and station style targets.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
            {Object.entries(shipDamageTypeModifiers).map(([damageType, multiplier]) => (
              <label key={damageType} className="small" style={{ display: "grid", gap: "0.35rem" }}>
                <span>{damageType}</span>
                <input
                  style={inputStyle}
                  type="number"
                  step="0.01"
                  value={multiplier}
                  onChange={(event) => setDamageTypeModifier(damageType, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="panel" style={{ display: "grid", gap: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", alignItems: "end" }}>
          <div>
            <h2>Ship Class Modifier Matrix</h2>
            <p className="small">Attacker classes are rows. Defender classes are columns.</p>
          </div>
          <label className="small" style={{ display: "grid", gap: "0.35rem" }}>
            <span>Damage Type</span>
            <select
              className="input"
              value={selectedDamageType}
              onChange={(event) => setSelectedDamageType(event.target.value)}
            >
              {(settings?.weapon_damage_types ?? []).map((damageType) => (
                <option key={damageType} value={damageType}>
                  {damageType}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={tableWrapStyle}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thtdStyle}>Attacker \ Defender</th>
                {shipClasses.map((shipClass) => (
                  <th key={shipClass} style={thtdStyle}>{shipClass}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shipClasses.map((attackerClass) => (
                <tr key={attackerClass}>
                  <th style={thtdStyle}>{attackerClass}</th>
                  {shipClasses.map((defenderClass) => (
                    <td key={`${attackerClass}:${defenderClass}`} style={thtdStyle}>
                      <input
                        style={inputStyle}
                        type="number"
                        step="0.01"
                        value={selectedMatrix[attackerClass]?.[defenderClass] ?? 1}
                        onChange={(event) =>
                          setShipClassModifier(selectedDamageType, attackerClass, defenderClass, event.target.value)
                        }
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminCombatValuesPanel;
