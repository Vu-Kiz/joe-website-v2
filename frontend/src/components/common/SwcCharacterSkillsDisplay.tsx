import React, { useMemo } from "react";

type SkillRow = {
  key: string;
  label: string;
  value: string;
};

type SkillGroup = {
  key: string;
  label: string;
  rows: SkillRow[];
};

type Props = {
  payload: Record<string, unknown> | null;
};

type GroupDefinition = {
  key: string;
  label: string;
  skills: Array<{ key: string; label: string }>;
};

const GROUP_DEFINITIONS: GroupDefinition[] = [
  {
    key: "general",
    label: "General",
    skills: [
      { key: "strength", label: "Strength" },
      { key: "dexterity", label: "Dexterity" },
      { key: "speed", label: "Speed" },
      { key: "dodge", label: "Dodge" },
      { key: "projectile", label: "Projectile Weapons" },
      { key: "nonProjectile", label: "Non Projectile Weapons" },
    ],
  },
  {
    key: "social",
    label: "Social",
    skills: [
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
    skills: [
      { key: "rndHull", label: "R&D Metallurgy" },
      { key: "rndElectronics", label: "R&D Electronics" },
      { key: "rndEngines", label: "R&D Engines" },
      { key: "rndWeapons", label: "R&D Weapons" },
      { key: "repair", label: "Repair" },
      { key: "compOps", label: "Computer Operations" },
    ],
  },
  {
    key: "space",
    label: "Space",
    skills: [
      { key: "fighterPiloting", label: "Fighter/Freighter Piloting" },
      { key: "fighterCombat", label: "Fighter/Freighter Combat" },
      { key: "capitalPiloting", label: "Capital Ship Piloting" },
      { key: "capitalCombat", label: "Capital Ship Combat" },
      { key: "spaceCommand", label: "Space Command" },
    ],
  },
  {
    key: "ground",
    label: "Ground",
    skills: [
      { key: "vehiclePiloting", label: "Vehicle Piloting" },
      { key: "vehicleCombat", label: "Vehicle Combat" },
      { key: "infantryCommand", label: "Infantry Command" },
      { key: "vehicleCommand", label: "Vehicle Command" },
      { key: "heavyWeapons", label: "Heavy Weapons" },
    ],
  },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "0";
  }

  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }

  return String(value).trim();
}

function combineValues(values: string[]): string {
  const cleaned = values.map((value) => value.trim()).filter((value) => value !== "");
  if (cleaned.length === 0) {
    return "0";
  }

  if (cleaned.length === 1) {
    return cleaned[0];
  }

  return cleaned.join(" + ");
}

function decode(payload: Record<string, unknown> | null): SkillGroup[] {
  if (!payload) {
    return [];
  }

  const swcapi = asRecord(payload.swcapi);
  const skillsByGroup = asRecord(swcapi?.skills);
  if (!skillsByGroup) {
    return [];
  }

  return GROUP_DEFINITIONS.map((groupDef) => {
    const buckets = Array.isArray(skillsByGroup[groupDef.key]) ? (skillsByGroup[groupDef.key] as unknown[]) : [];
    const valueLists: Record<string, string[]> = {};

    buckets.forEach((bucket) => {
      const bucketRecord = asRecord(bucket);
      if (!bucketRecord) {
        return;
      }

      const skills = Array.isArray(bucketRecord.skill) ? bucketRecord.skill : [];
      skills.forEach((skillEntry) => {
        const skillRecord = asRecord(skillEntry);
        if (!skillRecord) {
          return;
        }

        const attributes = asRecord(skillRecord.attributes);
        const type = String(attributes?.type ?? "").trim();
        if (!type) {
          return;
        }

        if (!valueLists[type]) {
          valueLists[type] = [];
        }

        valueLists[type].push(normalizeValue(skillRecord.value));
      });
    });

    const rows: SkillRow[] = groupDef.skills.map((skillDef) => ({
      key: skillDef.key,
      label: skillDef.label,
      value: combineValues(valueLists[skillDef.key] ?? []),
    }));

    return {
      key: groupDef.key,
      label: groupDef.label,
      rows,
    };
  });
}

const SwcCharacterSkillsDisplay: React.FC<Props> = ({ payload }) => {
  const groups = useMemo(() => decode(payload), [payload]);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {groups.map((group) => (
        <section key={group.key} className="panel" style={{ margin: 0 }}>
          <h4 style={{ marginTop: 0 }}>{group.label}</h4>
          <div style={{ display: "grid", gap: 6 }}>
            {group.rows.map((row) => (
              <div key={`${group.key}:${row.key}`} style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <span className="small">{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default SwcCharacterSkillsDisplay;
