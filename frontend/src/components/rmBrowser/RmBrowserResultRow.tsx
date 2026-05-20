import React from "react";
import type { RmMaterial } from "../../api/rmBrowser";

type Props = {
  material: RmMaterial;
};

const FACTION_ABBREV: Record<string, string> = {
  "1376": "JOE",
  "1791": "GARRY",
  "1796": "RAID",
};

// SWC wraps entity data under a "value" key
function getVal(m: RmMaterial): Record<string, unknown> {
  const v = m.value;
  return (v && typeof v === "object") ? (v as Record<string, unknown>) : m;
}

function nested(obj: unknown): string {
  if (!obj) return "—";
  if (typeof obj === "string" || typeof obj === "number") return String(obj);
  const o = obj as Record<string, unknown>;
  if (typeof o.value === "string" || typeof o.value === "number") return String(o.value);
  return "—";
}

const RmBrowserResultRow: React.FC<Props> = ({ material }) => {
  const v = getVal(material);
  const factionLabel = FACTION_ABBREV[material._faction_uid] ?? material._faction_label;

  const name = nested(v.name);
  const type = nested(v.type);
  const quantity = v.quantity != null ? Number(v.quantity).toLocaleString() : "—";

  const loc = (v.location && typeof v.location === "object")
    ? (v.location as Record<string, unknown>)
    : {};

  const system = nested(loc.system);
  const sector = nested(loc.sector);
  const planet = nested(loc.planet);
  const container = nested(loc.container);

  return (
    <tr className="rm-browser__result-row">
      <td className="rm-browser__cell rm-browser__cell--name">{name}</td>
      <td className="rm-browser__cell rm-browser__cell--type">{type}</td>
      <td className="rm-browser__cell rm-browser__cell--qty">{quantity}</td>
      <td className="rm-browser__cell rm-browser__cell--system">{system}</td>
      <td className="rm-browser__cell rm-browser__cell--planet">{planet}</td>
      <td className="rm-browser__cell rm-browser__cell--sector">{sector}</td>
      <td className="rm-browser__cell rm-browser__cell--container">{container}</td>
      <td className="rm-browser__cell rm-browser__cell--faction">
        <span className="rm-browser__faction-tag">{factionLabel}</span>
      </td>
    </tr>
  );
};

export default RmBrowserResultRow;
