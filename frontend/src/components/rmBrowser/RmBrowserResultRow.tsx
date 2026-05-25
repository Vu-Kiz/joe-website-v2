import React from "react";
import type { RmMaterial } from "../../api/universe/rmBrowser";

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
    <tr className="border-b border-white/[0.04] hover:bg-white/[0.03]">
      <td className="px-3 py-[7px] align-middle font-medium whitespace-nowrap">{name}</td>
      <td className="px-3 py-[7px] align-middle opacity-75">{type}</td>
      <td className="px-3 py-[7px] align-middle text-right tabular-nums">{quantity}</td>
      <td className="px-3 py-[7px] align-middle opacity-75">{system}</td>
      <td className="px-3 py-[7px] align-middle opacity-75">{planet}</td>
      <td className="px-3 py-[7px] align-middle opacity-75">{sector}</td>
      <td className="px-3 py-[7px] align-middle opacity-75">{container}</td>
      <td className="px-3 py-[7px] align-middle">
        <span className="text-[0.72rem] font-semibold px-[7px] py-[2px] rounded-[10px] bg-[rgba(255,193,7,0.12)] text-[#ffc107] whitespace-nowrap">{factionLabel}</span>
      </td>
    </tr>
  );
};

export default RmBrowserResultRow;
