import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getStoredCreatureType,
  getStoredCreatureTypes,
  getStoredDroidType,
  getStoredDroidTypes,
  getStoredFacilityType,
  getStoredFacilityTypes,
  getStoredItemType,
  getStoredItemTypes,
  getStoredMaterialType,
  getStoredMaterialTypes,
  getStoredNpcType,
  getStoredNpcTypes,
  getStoredPlanetType,
  getStoredPlanetTypes,
  getStoredRace,
  getStoredRaces,
  getStoredShipType,
  getStoredShipTypes,
  getStoredStationType,
  getStoredStationTypes,
  getStoredTerrainType,
  getStoredTerrainTypes,
  getStoredVehicleType,
  getStoredVehicleTypes,
  getStoredWeaponType,
  getStoredWeaponTypes,
  type EntityStatsKind,
} from "../../api/universe";
import HamburgerToggle from "../common/HamburgerToggle";
import { formatTimestampAsCgt, getCgtTime, type CgtResponse } from "../../api/time";
import isdDirectionImage from "../../assets/swc/isd.png";
import { resolveWeaponArcWindow, normalizeDegrees } from "../tools/weaponHeatmap/weaponHeatmapMath";

type EntityRecordSummary = {
  uid: string;
  name: string | null;
  sourceKind: EntityStatsKind;
  className?: string | null;
  imageUrl?: string | null;
  lastPulledAt: string | null;
};

type EntityBrowseItem = {
  key: string;
  name: string | null;
  className?: string | null;
  imageUrl?: string | null;
  lastPulledAt: string | null;
  primaryRecord: EntityRecordSummary;
  itemRecord?: EntityRecordSummary | null;
  weaponRecord?: EntityRecordSummary | null;
};

type EntityDetail = Record<string, unknown> | null;
type TerrainLookupEntry = {
  uid: string | null;
  code: string | null;
  name: string | null;
  image_url: string | null;
  images?: Record<string, string | null> | null;
};

type CompareDetailState = Record<string, EntityDetail>;
type CompareSelectionState = [string | null, string | null];
type CompareQueryState = [string, string];
type OverlayRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

const kindOptions: Array<{ key: EntityStatsKind; label: string }> = [
  { key: "ship", label: "Ships" },
  { key: "vehicle", label: "Vehicles" },
  { key: "station", label: "Stations" },
  { key: "facility", label: "Facilities" },
  { key: "item", label: "Items" },
  { key: "droid", label: "Droids" },
  { key: "creature", label: "Creatures" },
  { key: "npc", label: "NPC Types" },
  { key: "race", label: "Races" },
  { key: "terrain", label: "Terrain" },
  { key: "material", label: "Materials" },
];

const entityLoaders: Record<
  EntityStatsKind,
  {
    list: () => Promise<{ ok: boolean; data: any[] }>;
    detail: (id: string) => Promise<{ ok: boolean; data: Record<string, unknown> }>;
  }
> = {
  station: { list: getStoredStationTypes, detail: getStoredStationType },
  facility: { list: getStoredFacilityTypes, detail: getStoredFacilityType },
  item: { list: getStoredItemTypes, detail: getStoredItemType },
  planet: { list: getStoredPlanetTypes, detail: getStoredPlanetType },
  ship: { list: getStoredShipTypes, detail: getStoredShipType },
  vehicle: { list: getStoredVehicleTypes, detail: getStoredVehicleType },
  droid: { list: getStoredDroidTypes, detail: getStoredDroidType },
  creature: { list: getStoredCreatureTypes, detail: getStoredCreatureType },
  npc: { list: getStoredNpcTypes, detail: getStoredNpcType },
  race: { list: getStoredRaces, detail: getStoredRace },
  weapon: { list: getStoredWeaponTypes, detail: getStoredWeaponType },
  terrain: { list: getStoredTerrainTypes, detail: getStoredTerrainType },
  material: { list: getStoredMaterialTypes, detail: getStoredMaterialType },
};

function summarizeEntity(item: any, sourceKind: EntityStatsKind): EntityRecordSummary {
  return {
    uid: String(item.uid ?? ""),
    name: item.name ?? null,
    sourceKind,
    className: item.class_name ?? null,
    imageUrl: item.icon_url ?? item.images?.small ?? item.images?.icon ?? item.image_url ?? null,
    lastPulledAt: item.last_pulled_at ?? null,
  };
}

function normalizeEntityName(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

function buildOverlayBrowseItems(
  primaryItems: EntityRecordSummary[],
  relatedItems: EntityRecordSummary[]
): EntityBrowseItem[] {
  const relatedByName = new Map(
    relatedItems.map((item) => [normalizeEntityName(item.name), item])
  );

  return primaryItems.map((item) => {
    const related = relatedByName.get(normalizeEntityName(item.name)) ?? null;
    const itemRecord =
      item.sourceKind === "item"
        ? item
        : related?.sourceKind === "item"
          ? related
          : null;
    const weaponRecord =
      item.sourceKind === "weapon"
        ? item
        : related?.sourceKind === "weapon"
          ? related
          : null;

    return {
      key: item.uid,
      name: item.name,
      className: item.className ?? related?.className ?? null,
      imageUrl: item.imageUrl ?? related?.imageUrl ?? null,
      lastPulledAt: item.lastPulledAt ?? related?.lastPulledAt ?? null,
      primaryRecord: item,
      itemRecord,
      weaponRecord,
    };
  });
}

function attachMatchingWeaponRecords(
  primaryItems: EntityRecordSummary[],
  weaponItems: EntityRecordSummary[]
): EntityBrowseItem[] {
  const weaponsByName = new Map(
    weaponItems.map((item) => [normalizeEntityName(item.name), item])
  );

  return primaryItems.map((item) => ({
    key: item.uid,
    name: item.name,
    className: item.className ?? null,
    imageUrl: item.imageUrl ?? null,
    lastPulledAt: item.lastPulledAt,
    primaryRecord: item,
    itemRecord: null,
    weaponRecord: weaponsByName.get(normalizeEntityName(item.name)) ?? null,
  }));
}

function getBrowseRecordForKind(item: EntityBrowseItem, sourceKind: EntityStatsKind) {
  if (sourceKind === "item") {
    return item.itemRecord ?? item.primaryRecord;
  }

  if (sourceKind === "weapon") {
    return item.weaponRecord ?? item.primaryRecord;
  }

  return item.primaryRecord;
}

function formatLabel(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatSwcDisplayId(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  const [prefix, rest] = value.split(":", 2);
  if (rest && /^\d+$/.test(prefix)) {
    return rest;
  }

  return value;
}

function formatScalar(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Unknown";
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string" && /^\d+:\d+$/.test(value)) {
    return formatSwcDisplayId(value);
  }

  return String(value);
}

function shouldCollapseField(key: string, value: unknown) {
  if (/_href$/i.test(key)) {
    return true;
  }

  if (Array.isArray(value)) {
    return true;
  }

  if (typeof value === "object" && value !== null) {
    return true;
  }

  if (typeof value === "string") {
    return key === "description" || value.length > 180 || value.includes("\n") || value.includes("<p");
  }

  return false;
}

function looksLikeHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value) || /&[a-z0-9#]+;/i.test(value);
}

function collectImageUrls(detail: EntityDetail, kind?: EntityStatsKind): string[] {
  if (!detail) {
    return [];
  }

  const urls = new Set<string>();

  const maybeAdd = (value: unknown) => {
    if (typeof value === "string" && value.trim() !== "") {
      urls.add(value);
    }
  };

  if (kind === "facility") {
    maybeAdd(detail.icon_url);
    maybeAdd(detail.image_large_url);
    maybeAdd(detail.image_small_url);
    maybeAdd(detail.image_url);
  } else {
    maybeAdd(detail.image_large_url);
    maybeAdd(detail.image_url);
    maybeAdd(detail.image_small_url);
    maybeAdd(detail.icon_url);
  }

  const images = detail.images;
  if (images && typeof images === "object" && !Array.isArray(images)) {
    const imageRecord = images as Record<string, unknown>;
    [
      imageRecord.large,
      imageRecord.full,
      imageRecord.main,
      imageRecord.medium,
      imageRecord.small,
      imageRecord.icon,
    ].forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach(maybeAdd);
        return;
      }

      maybeAdd(value);
    });

    Object.values(imageRecord).forEach((value) => {
      if (Array.isArray(value)) {
        value.forEach(maybeAdd);
        return;
      }

      maybeAdd(value);
    });
  }

  return Array.from(urls);
}

function resolveCollectionImageUrl(
  item: Record<string, unknown>,
  terrainLookup: Record<string, TerrainLookupEntry>
) {
  const lookupCandidates = [
    typeof item.uid === "string" ? item.uid : null,
    typeof item.code === "string" ? item.code.toLowerCase() : null,
    typeof item.name === "string" ? item.name.toLowerCase() : null,
  ].filter((value): value is string => !!value);

  for (const candidate of lookupCandidates) {
    const match = terrainLookup[candidate];
    if (!match) {
      continue;
    }

    return (
      match.image_url ??
      match.images?.small ??
      match.images?.icon ??
      match.images?.large ??
      null
    );
  }

  return null;
}

function renderCollectionItems(
  items: Array<Record<string, unknown>>,
  terrainLookup: Record<string, TerrainLookupEntry>,
  options?: {
    hideImages?: boolean;
    onSelect?: (item: Record<string, unknown>) => void;
    activeKey?: string | null;
  }
) {
  return (
    <div className="members-entity-stats__chip-list">
      {items.map((item, index) => {
        const primary =
          (typeof item.name === "string" && item.name) ||
          (typeof item.value === "string" && item.value) ||
          (typeof item.uid === "string" && formatSwcDisplayId(item.uid)) ||
          `Entry ${index + 1}`;

        const cleanedUid =
          typeof item.uid === "string" ? formatSwcDisplayId(item.uid) : null;
        const imageUrl = options?.hideImages ? null : resolveCollectionImageUrl(item, terrainLookup);
        const itemKey =
          (typeof item.uid === "string" && item.uid) ||
          (typeof item.name === "string" && item.name) ||
          `${primary}-${index}`;

        const extras = Object.entries(item)
          .filter(
            ([key, value]) =>
              key !== "name" &&
              key !== "value" &&
              key !== "href" &&
              value !== null &&
              value !== ""
          )
          .map(([key, value]) => {
            if (key === "uid") {
              return `ID: ${cleanedUid ?? formatScalar(value)}`;
            }

            return `${formatLabel(key)}: ${formatScalar(value)}`;
          })
          .filter(Boolean);

        const content = (
          <>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={typeof item.name === "string" ? item.name : primary}
                className="members-entity-stats__collection-image"
              />
            ) : null}
            <strong>{primary}</strong>
            {extras.length > 0 ? <p className="small">{extras.join(" · ")}</p> : null}
          </>
        );

        if (options?.onSelect) {
          return (
            <button
              key={itemKey}
              type="button"
              className={`members-entity-stats__collection-card members-entity-stats__collection-card--interactive${options.activeKey === itemKey ? " is-active" : ""}`}
              onClick={() => options.onSelect?.(item)}
            >
              {content}
            </button>
          );
        }

        return (
          <article key={itemKey} className="members-entity-stats__collection-card">
            {content}
          </article>
        );
      })}
    </div>
  );
}

function buildWeaponStatEntries(detail: EntityDetail) {
  if (!detail) {
    return [];
  }

  return ([
    ["Damage Type", detail.damage_type],
    ["Min Damage", detail.min_damage],
    ["Max Damage", detail.max_damage],
    ["Optimum Range", detail.optimum_range],
    ["Max Hits", detail.max_hits],
    ["Drop Off", detail.drop_off],
    ["Firepower", detail.firepower],
    ["Tracking", detail.tracking],
    ["Is Poison", detail.is_poison],
    ["Is Dual", detail.is_dual],
  ] as Array<[string, unknown]>).filter(([, value]) => value !== null && value !== undefined && value !== "");
}

function isComparableScalar(value: unknown) {
  return (
    value !== null &&
    value !== undefined &&
    value !== "" &&
    !Array.isArray(value) &&
    (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
  );
}

function isWeaponCollectionItem(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function buildWeaponCollectionKey(item: Record<string, unknown>) {
  const uid = typeof item.uid === "string" ? item.uid : "";
  const name = typeof item.name === "string" ? item.name : "";
  const quantity = item.quantity === null || item.quantity === undefined ? "" : String(item.quantity);
  const arc = typeof item.arc === "string" ? item.arc : "";
  const arcFrom = item.arc_from === null || item.arc_from === undefined ? "" : String(item.arc_from);
  const arcTo = item.arc_to === null || item.arc_to === undefined ? "" : String(item.arc_to);

  return [uid, name, quantity, arc, arcFrom, arcTo].join("|");
}

function buildWeaponArcGroupKey(item: Record<string, unknown>) {
  const uid = typeof item.uid === "string" ? item.uid : "";
  const name = typeof item.name === "string" ? item.name : "";
  const arc = typeof item.arc === "string" ? item.arc : "";
  const arcFrom = item.arc_from === null || item.arc_from === undefined ? "" : String(item.arc_from);
  const arcTo = item.arc_to === null || item.arc_to === undefined ? "" : String(item.arc_to);

  return [uid, name, arc, arcFrom, arcTo].join("|");
}

function buildWeaponNameGroupKey(item: Record<string, unknown>) {
  const uid = typeof item.uid === "string" ? item.uid : "";
  const name = typeof item.name === "string" ? item.name : "";

  return [uid, name].join("|");
}

function groupWeaponCollectionItems(items: Array<Record<string, unknown>>) {
  const grouped = new Map<string, Record<string, unknown>>();

  items.forEach((item) => {
    const key = buildWeaponArcGroupKey(item);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, { ...item });
      return;
    }

    const nextQuantity =
      (Number(existing.quantity ?? 0) || 0) +
      (Number(item.quantity ?? 0) || 0);

    grouped.set(key, {
      ...existing,
      quantity: nextQuantity > 0 ? nextQuantity : existing.quantity ?? item.quantity ?? null,
    });
  });

  return Array.from(grouped.values());
}

function getWeaponArcDisplay(item: Record<string, unknown>) {
  const arcLabel =
    (typeof item.arc === "string" && item.arc) ||
    "Unspecified Arc";

  const metaParts: string[] = [];

  if (item.quantity !== null && item.quantity !== undefined && item.quantity !== "") {
    metaParts.push(`Quantity: ${formatScalar(item.quantity)}`);
  }

  if (item.arc_from !== null && item.arc_from !== undefined && item.arc_from !== "") {
    metaParts.push(`From: ${formatScalar(item.arc_from)}`);
  }

  if (item.arc_to !== null && item.arc_to !== undefined && item.arc_to !== "") {
    metaParts.push(`To: ${formatScalar(item.arc_to)}`);
  }

  return {
    arcLabel,
    meta: metaParts.join(" · "),
    arcName: typeof item.arc === "string" ? item.arc : null,
    arcFrom: item.arc_from == null || Number.isNaN(Number(item.arc_from)) ? null : Number(item.arc_from),
    arcTo: item.arc_to == null || Number.isNaN(Number(item.arc_to)) ? null : Number(item.arc_to),
  };
}

function getShieldArcDisplay(item: Record<string, unknown>) {
  const arcLabel =
    (typeof item.name === "string" && item.name) ||
    (typeof item.arc === "string" && item.arc) ||
    "Unspecified Arc";

  const metaParts: string[] = [];

  if (item.value !== null && item.value !== undefined && item.value !== "") {
    metaParts.push(`Deflectors: ${formatScalar(item.value)}`);
  }

  if (item.percent !== null && item.percent !== undefined && item.percent !== "") {
    metaParts.push(`${formatScalar(item.percent)}%`);
  }

  return {
    arcLabel,
    meta: metaParts.join(" · "),
    arcName: typeof item.name === "string" ? item.name : (typeof item.arc === "string" ? item.arc : null),
    arcFrom:
      item.arc_from == null || Number.isNaN(Number(item.arc_from)) ? null : Number(item.arc_from),
    arcTo:
      item.arc_to == null || Number.isNaN(Number(item.arc_to)) ? null : Number(item.arc_to),
  };
}

function getArcSweepDegrees(
  arcName: string | null,
  arcFrom: number | null,
  arcTo: number | null
) {
  const normalizedName = String(arcName ?? "").trim().toLowerCase();
  if (normalizedName === "omni" || normalizedName === "omnidirectional") {
    return { start: 0, sweep: 360 };
  }

  if (arcFrom != null && arcTo != null && Math.abs(arcTo - arcFrom) >= 360) {
    return { start: 0, sweep: 360 };
  }

  const window = resolveWeaponArcWindow(arcName, arcFrom, arcTo);
  if (!window) {
    return null;
  }

  const start = normalizeDegrees(window.start);
  const end = normalizeDegrees(window.end);
  const sweep = start === end ? 360 : (start < end ? end - start : (360 - start) + end);

  return {
    start,
    sweep,
  };
}

const ArcIndicator: React.FC<{
  arcName: string | null;
  arcFrom: number | null;
  arcTo: number | null;
}> = ({ arcName, arcFrom, arcTo }) => {
  const arc = getArcSweepDegrees(arcName, arcFrom, arcTo);
  const radius = 22;
  const center = 28;

  const arcPath = useMemo(() => {
    if (!arc || arc.sweep <= 0 || arc.sweep >= 360) {
      return null;
    }

    const startAngle = normalizeDegrees(arc.start);
    const endAngle = normalizeDegrees(arc.start + arc.sweep);
    const toPoint = (angle: number) => {
      const radians = (angle * Math.PI) / 180;
      return {
        x: center + (radius * Math.sin(radians)),
        y: center - (radius * Math.cos(radians)),
      };
    };

    const startPoint = toPoint(startAngle);
    const endPoint = toPoint(endAngle);
    const largeArcFlag = arc.sweep > 180 ? 1 : 0;

    return `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y}`;
  }, [arc]);

  return (
    <span className="members-entity-stats__arc-indicator" aria-hidden="true">
      <svg viewBox="0 0 56 56" className="members-entity-stats__arc-indicator-ring">
        <circle cx="28" cy="28" r={radius} className="members-entity-stats__arc-indicator-track" />
        {arc && arc.sweep >= 360 ? (
          <circle
            cx="28"
            cy="28"
            r={radius}
            className="members-entity-stats__arc-indicator-arc"
          />
        ) : null}
        {arcPath ? (
          <path d={arcPath} className="members-entity-stats__arc-indicator-arc" />
        ) : null}
      </svg>
      <img
        src={isdDirectionImage}
        alt=""
        className="members-entity-stats__arc-indicator-ship"
      />
    </span>
  );
};

function renderWeaponSelectionList(
  items: Array<Record<string, unknown>>,
  activeKey: string | null,
  onSelect?: (item: Record<string, unknown>) => void
) {
  const groupedItems = Array.from(
    items.reduce((groups, item) => {
      const key = buildWeaponNameGroupKey(item);
      const existing = groups.get(key);

      if (existing) {
        existing.push(item);
      } else {
        groups.set(key, [item]);
      }

      return groups;
    }, new Map<string, Array<Record<string, unknown>>>())
  );

  return (
    <div className="members-entity-stats__list-table">
      {groupedItems.map(([groupKey, groupItems], index) => {
        const representativeItem = groupItems[0] ?? {};
        const isActive = groupItems.some((item) => buildWeaponCollectionKey(item) === activeKey);
        const name =
          (typeof representativeItem.name === "string" && representativeItem.name) ||
          (typeof representativeItem.value === "string" && representativeItem.value) ||
          (typeof representativeItem.uid === "string" && formatSwcDisplayId(representativeItem.uid)) ||
          `Weapon ${index + 1}`;
        const primarySummary =
          typeof representativeItem.uid === "string" && representativeItem.uid
            ? `ID: ${formatSwcDisplayId(representativeItem.uid)}`
            : null;

        return (
          <button
            key={groupKey || `weapon-group-${index}`}
            type="button"
            className={`members-entity-stats__list-button${isActive ? " is-active" : ""}`}
            onClick={() => onSelect?.(representativeItem)}
          >
            <span className="members-entity-stats__list-button-copy">
              <strong>{name}</strong>
              {primarySummary ? <span className="small">{primarySummary}</span> : null}
              {groupItems.map((item, itemIndex) => {
                const arcDisplay = getWeaponArcDisplay(item);

                return arcDisplay.arcLabel || arcDisplay.meta ? (
                  <span key={`${groupKey}-arc-${itemIndex}`} className="members-entity-stats__weapon-arc-line">
                    <ArcIndicator
                      arcName={arcDisplay.arcName}
                      arcFrom={arcDisplay.arcFrom}
                      arcTo={arcDisplay.arcTo}
                    />
                    <span className="members-entity-stats__weapon-arc-name small">
                      {arcDisplay.arcLabel}
                    </span>
                    {arcDisplay.meta ? (
                      <span className="members-entity-stats__weapon-arc-meta small">
                        {arcDisplay.meta}
                      </span>
                    ) : null}
                  </span>
                ) : null;
              })}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function renderCollectionListRows(items: Array<Record<string, unknown>>) {
  return (
    <div className="members-entity-stats__list-table">
      {items.map((item, index) => {
        const primary =
          (typeof item.name === "string" && item.name) ||
          (typeof item.value === "string" && item.value) ||
          (typeof item.uid === "string" && formatSwcDisplayId(item.uid)) ||
          `Entry ${index + 1}`;

        const extras = Object.entries(item)
          .filter(
            ([key, value]) =>
              key !== "name" &&
              key !== "value" &&
              key !== "href" &&
              value !== null &&
              value !== undefined &&
              value !== ""
          )
          .map(([key, value]) => {
            if (key === "uid") {
              return `ID: ${formatSwcDisplayId(String(value))}`;
            }

            return `${formatLabel(key)}: ${formatScalar(value)}`;
          })
          .filter(Boolean)
          .join(" · ");

        return (
          <div key={`${primary}-${index}`} className="members-entity-stats__list-row">
            <span className="members-entity-stats__list-label small">{primary}</span>
            <strong className="members-entity-stats__list-value">{extras || "Recorded"}</strong>
          </div>
        );
      })}
    </div>
  );
}

function renderSkills(skills: Record<string, unknown>) {
  return (
    <div className="members-entity-stats__skill-groups">
      {Object.entries(skills).map(([groupName, groupValue]) => {
        if (!groupValue || typeof groupValue !== "object") {
          return null;
        }

        const group = groupValue as Record<string, unknown>;
        const groupSkills = (group.skills ?? {}) as Record<string, unknown>;
        const visibleSkills = Object.entries(groupSkills).filter(([, skillValue]) => {
          if (skillValue === null || skillValue === undefined || skillValue === "") {
            return false;
          }

          if (typeof skillValue === "number") {
            return skillValue !== 0;
          }

          const numericValue = Number(skillValue);
          if (!Number.isNaN(numericValue)) {
            return numericValue !== 0;
          }

          return true;
        });

        if (visibleSkills.length === 0) {
          return null;
        }

        return (
          <section key={groupName} className="members-entity-stats__skill-group">
            <h4>{formatLabel(groupName)}</h4>
            <div className="members-entity-stats__list-table">
              {visibleSkills.map(([skillName, skillValue]) => (
                <div key={skillName} className="members-entity-stats__list-row">
                  <span className="members-entity-stats__list-label small">{formatLabel(skillName)}</span>
                  <strong className="members-entity-stats__list-value">{formatScalar(skillValue)}</strong>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function formatGroupedStatValue(key: string, value: unknown) {
  if (value === null || value === undefined || value === "") {
    return "Unknown";
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  const hasNumericValue = !Number.isNaN(numericValue);

  switch (key) {
    case "weight_tonnes":
    case "weight_capacity_tonnes":
      return hasNumericValue ? `${numericValue.toLocaleString()} T` : formatScalar(value);
    case "volume_m3":
    case "volume_capacity_m3":
      return hasNumericValue ? `${numericValue.toLocaleString()} m³` : formatScalar(value);
    case "length":
    case "width":
    case "height":
      return hasNumericValue ? `${numericValue.toLocaleString()} m` : formatScalar(value);
    case "slot_size":
      return hasNumericValue ? numericValue.toFixed(2) : formatScalar(value);
    case "max_speed":
      return hasNumericValue ? `${numericValue.toLocaleString()} km/h` : formatScalar(value);
    case "recycling_xp":
      return hasNumericValue ? `${numericValue.toLocaleString()} XP` : formatScalar(value);
    case "price_credits":
      return hasNumericValue ? `${numericValue.toLocaleString()} CR` : formatScalar(value);
    case "production_modifier":
      return hasNumericValue ? `${numericValue.toLocaleString()}` : formatScalar(value);
    case "hyperdrive":
      return hasNumericValue ? `${numericValue}` : formatScalar(value);
    default:
      return formatScalar(value);
  }
}

function summarizeNamedCollection(
  value: unknown,
  quantityKeys: string[] = ["quantity", "amount", "count"]
): Array<[string, string]> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map((item) => {
      const name =
        (typeof item.name === "string" && item.name) ||
        (typeof item.value === "string" && item.value) ||
        (typeof item.class_name === "string" && item.class_name) ||
        null;

      if (!name) {
        return null;
      }

      const quantityValue = quantityKeys
        .map((key) => item[key])
        .find((entry) => entry !== null && entry !== undefined && entry !== "");

      return [
        name,
        quantityValue !== undefined ? formatScalar(quantityValue) : "1",
      ] as [string, string];
    })
    .filter((entry): entry is [string, string] => !!entry);
}

function buildGroupedDetailSections(detail: EntityDetail): Array<{
  title: string;
  entries: Array<[string, string]>;
}> {
  if (!detail) {
    return [];
  }

  const asRecord = detail as Record<string, unknown>;
  const sections: Array<{ title: string; entries: Array<[string, string]> }> = [];

  const addScalarSection = (
    title: string,
    fields: Array<[string, string]>
  ) => {
    const entries = fields
      .map(([key, label]) => {
        const value = asRecord[key];
        if (value === null || value === undefined || value === "") {
          return null;
        }

        return [label, formatGroupedStatValue(key, value)] as [string, string];
      })
      .filter((entry): entry is [string, string] => !!entry);

    if (entries.length > 0) {
      sections.push({ title, entries });
    }
  };

  const materialEntries = summarizeNamedCollection(asRecord.materials);
  if (materialEntries.length > 0) {
    sections.push({
      title: "Raw Materials",
      entries: materialEntries,
    });
  }

  const affiliationEntries = summarizeNamedCollection(
    asRecord.affiliations ?? asRecord.affiliation ?? null,
    ["quantity"]
  );
  sections.push({
    title: "Affiliations",
    entries: affiliationEntries.length > 0 ? affiliationEntries : [["No affiliations", ""]],
  });

  if (
    (Array.isArray(asRecord.material_types) && asRecord.material_types.length > 0) ||
    (asRecord.material_probability_percent !== null &&
      asRecord.material_probability_percent !== undefined &&
      asRecord.material_probability_percent !== "")
  ) {
    sections.push({
      title: "Material Types",
      entries: [],
    });
  }

  if (Array.isArray(asRecord.hiring_locations) && asRecord.hiring_locations.length > 0) {
    sections.push({
      title: "Hiring Locations",
      entries: [],
    });
  }

  if (Array.isArray(asRecord.spawn_terrain_types) && asRecord.spawn_terrain_types.length > 0) {
    sections.push({
      title: "Spawn Terrain Types",
      entries: [],
    });
  }

  if (asRecord.skills && typeof asRecord.skills === "object" && !Array.isArray(asRecord.skills)) {
    sections.push({
      title: "Skills",
      entries: [],
    });
  }

  if (Array.isArray(asRecord.terrain_restrictions) && asRecord.terrain_restrictions.length > 0) {
    sections.push({
      title: "Terrain Restrictions",
      entries: [],
    });
  }

  if (typeof asRecord.description === "string" && asRecord.description.trim() !== "") {
    sections.push({
      title: "Description",
      entries: [],
    });
  }

  addScalarSection("Propulsion", [
    ["hyperdrive", "Hyperspeed"],
    ["max_speed", "Max Speed"],
    ["manoeuvrability", "Manoeuvrability"],
  ]);

  addScalarSection("Dimensions", [
    ["weight_tonnes", "Weight"],
    ["volume_m3", "Volume"],
    ["length", "Length"],
    ["width", "Width"],
    ["height", "Height"],
    ["slot_size", "Party Slot"],
  ]);

  addScalarSection("Cargo Capacity", [
    ["weight_capacity_tonnes", "Weight Cap"],
    ["volume_capacity_m3", "Volume Cap"],
    ["max_passengers", "Max Passengers"],
  ]);

  if (Array.isArray(asRecord.weapons) && asRecord.weapons.length > 0) {
    sections.push({
      title: "Weapons",
      entries: [],
    });
  }

  addScalarSection("Defenses", [
    ["hull", "Hull"],
    ["shield", "Deflectors"],
    ["ionic_capacity", "Ionic Capacity"],
    ["armour", "Armour"],
  ]);

  addScalarSection("Electronics", [
    ["sensors", "Sensors"],
    ["ecm", "ECM"],
  ]);

  addScalarSection("Production", [
    ["price_credits", "Raw Value"],
    ["recommended_workers", "Recommended Workers"],
    ["recycling_xp", "Recycling XP"],
    ["production_modifier", "Production Mod"],
  ]);

  return sections.filter((section) =>
    (section.title === "Description" ||
      section.title === "Material Types" ||
      section.title === "Hiring Locations" ||
      section.title === "Terrain Restrictions" ||
      section.title === "Spawn Terrain Types" ||
      section.title === "Skills") ||
    section.entries.some(([, value]) => value !== "")
  );
}

function getEntityStatsOverlayTargetRect(
  section: { title: string; entries: Array<[string, string]> },
  detail: EntityDetail = null,
  linkedWeapons: Array<Record<string, unknown>> = []
): OverlayRect {
  const title = section.title;
  const entryCount = section.entries.length;
  const shieldArcCount =
    title === "Defenses" && Array.isArray((detail as Record<string, unknown> | null)?.shield_arcs)
      ? (((detail as Record<string, unknown>).shield_arcs as Array<Record<string, unknown>>).length)
      : 0;

  const largeSectionTitles = new Set([
    "Weapons",
    "Description",
    "Skills",
    "Material Types",
    "Terrain Restrictions",
    "Hiring Locations",
    "Spawn Terrain Types",
  ]);

  const compactScalarSectionTitles = new Set([
    "Propulsion",
    "Dimensions",
    "Cargo Capacity",
    "Defenses",
    "Electronics",
    "Production",
  ]);

  const maxEntryTextLength = section.entries.reduce((largest, [label, value]) => {
    const combinedLength = `${label}${value}`.length;
    return Math.max(largest, combinedLength);
  }, 0);

  const compactWidthEstimate = Math.max(
    420,
    Math.min(560, 260 + maxEntryTextLength * 5)
  );

  const width = Math.min(
    window.innerWidth - 32,
    largeSectionTitles.has(title)
      ? title === "Weapons"
        ? 720
        : 860
      : title === "Defenses" && shieldArcCount > 0
        ? 760
        : compactScalarSectionTitles.has(title)
          ? compactWidthEstimate
          : 640
  );

  const estimatedHeight = largeSectionTitles.has(title)
    ? title === "Weapons"
      ? 220 + Math.min(linkedWeapons.length, 6) * 62
      : title === "Description"
        ? 560
        : 480
    : title === "Defenses" && shieldArcCount > 0
      ? 170 + entryCount * 52 + shieldArcCount * 58
      : 150 + entryCount * 52;

  const height = Math.min(window.innerHeight - 32, Math.max(220, estimatedHeight));

  return {
    width,
    height,
    left: Math.round((window.innerWidth - width) / 2),
    top: Math.round((window.innerHeight - height) / 2),
  };
}

const EntityStatsGroupOverlay: React.FC<{
  section: { title: string; entries: Array<[string, string]> };
  detail?: EntityDetail;
  linkedWeapons?: Array<Record<string, unknown>>;
  terrainLookup?: Record<string, TerrainLookupEntry>;
  selectedLinkedWeaponKey?: string | null;
  onSelectLinkedWeapon?: (item: Record<string, unknown>) => void;
  linkedWeaponLoading?: boolean;
  selectedLinkedWeaponDetail?: EntityDetail;
  sourceRect: OverlayRect;
  onClose: () => void;
}> = ({
  section,
  detail = null,
  linkedWeapons = [],
  terrainLookup = {},
  selectedLinkedWeaponKey = null,
  onSelectLinkedWeapon,
  linkedWeaponLoading = false,
  selectedLinkedWeaponDetail = null,
  sourceRect,
  onClose,
}) => {
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [targetRect, setTargetRect] = useState<OverlayRect>(() =>
    getEntityStatsOverlayTargetRect(section, detail, linkedWeapons)
  );

  useEffect(() => {
    const onResize = () => setTargetRect(getEntityStatsOverlayTargetRect(section, detail, linkedWeapons));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [section, detail, linkedWeapons]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  });

  const currentRect = closing || !entered ? sourceRect : targetRect;

  const handleClose = () => {
    setClosing(true);
    setEntered(false);
    window.setTimeout(() => onClose(), 280);
  };

  return (
    <div className={"members-entity-stats__overlay" + (entered && !closing ? " is-open" : "")}>
      <button
        type="button"
        className="members-entity-stats__overlay-backdrop"
        aria-label="Close stats section"
        onClick={handleClose}
      />

      <article
        className="panel members-entity-stats__overlay-panel"
        style={{
          top: `${currentRect.top}px`,
          left: `${currentRect.left}px`,
          width: `${currentRect.width}px`,
          height: `${currentRect.height}px`,
        }}
        >
        <header className="members-entity-stats__overlay-header">
          <div className="members-entity-stats__overlay-title-block">
            <h3 className="members-entity-stats__overlay-title">{section.title}</h3>
          </div>

          <HamburgerToggle
            open={true}
            onClick={handleClose}
            ariaLabel="Close stats section"
          />
        </header>

        <div className="members-entity-stats__overlay-body">
          {section.title === "Weapons" && linkedWeapons.length > 0 ? (
            <>
              {renderWeaponSelectionList(
                linkedWeapons,
                selectedLinkedWeaponKey,
                onSelectLinkedWeapon
              )}
              {linkedWeaponLoading ? (
                <p className="small">Loading weapon stats…</p>
              ) : selectedLinkedWeaponDetail ? (
                <div className="members-entity-stats__list-table">
                  {buildWeaponStatEntries(selectedLinkedWeaponDetail).map(([label, value]) => (
                    <div key={label} className="members-entity-stats__list-row">
                      <span className="members-entity-stats__list-label small">{label}</span>
                      <strong className="members-entity-stats__list-value">{formatScalar(value)}</strong>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
          {section.title === "Description" && typeof (detail as Record<string, unknown>)?.description === "string" ? (
            looksLikeHtml((detail as Record<string, unknown>).description as string) ? (
              <div
                className="members-entity-stats__long-text members-entity-stats__long-text--html"
                dangerouslySetInnerHTML={{ __html: (detail as Record<string, unknown>).description as string }}
              />
            ) : (
              <div className="members-entity-stats__long-text">
                {(detail as Record<string, unknown>).description as string}
              </div>
            )
          ) : null}
          {section.title === "Material Types" ? (
            <>
              {(detail as Record<string, unknown>)?.material_probability_percent !== null &&
              (detail as Record<string, unknown>)?.material_probability_percent !== undefined &&
              (detail as Record<string, unknown>)?.material_probability_percent !== "" ? (
                <div className="members-entity-stats__list-table">
                  <div className="members-entity-stats__list-row">
                    <span className="members-entity-stats__list-label small">Probability</span>
                    <strong className="members-entity-stats__list-value">
                      {formatScalar((detail as Record<string, unknown>).material_probability_percent)}%
                    </strong>
                  </div>
                </div>
              ) : null}
              {Array.isArray((detail as Record<string, unknown>)?.material_types)
                ? renderCollectionListRows(
                    (detail as Record<string, unknown>).material_types as Array<Record<string, unknown>>
                  )
                : null}
            </>
          ) : null}
          {section.title === "Hiring Locations" &&
          Array.isArray((detail as Record<string, unknown>)?.hiring_locations) ? (
            renderCollectionListRows(
              (detail as Record<string, unknown>).hiring_locations as Array<Record<string, unknown>>
            )
          ) : null}
          {section.title === "Terrain Restrictions" &&
          Array.isArray((detail as Record<string, unknown>)?.terrain_restrictions) ? (
            renderCollectionItems(
              (detail as Record<string, unknown>).terrain_restrictions as Array<Record<string, unknown>>,
              terrainLookup
            )
          ) : null}
          {section.title === "Defenses" &&
          Array.isArray((detail as Record<string, unknown>)?.shield_arcs) ? (
            <>
              <div className="members-entity-stats__section-heading">
                <h4>Shield Arcs</h4>
                <span className="small">Directional deflector segments</span>
              </div>
              <div className="members-entity-stats__list-table">
                {((detail as Record<string, unknown>).shield_arcs as Array<Record<string, unknown>>).map((item, index) => {
                  const shieldArc = getShieldArcDisplay(item);

                  return (
                    <div
                      key={`shield-arc-${index}-${shieldArc.arcLabel}`}
                      className="members-entity-stats__list-row members-entity-stats__list-row--shield-arc"
                    >
                      <span className="members-entity-stats__weapon-arc-copy">
                        <span className="members-entity-stats__weapon-arc-name small">
                          {shieldArc.arcLabel}
                        </span>
                        {shieldArc.meta ? (
                          <span className="members-entity-stats__weapon-arc-meta small">
                            {shieldArc.meta}
                          </span>
                        ) : null}
                      </span>
                      <ArcIndicator
                        arcName={shieldArc.arcName}
                        arcFrom={shieldArc.arcFrom}
                        arcTo={shieldArc.arcTo}
                      />
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
          {section.title === "Spawn Terrain Types" &&
          Array.isArray((detail as Record<string, unknown>)?.spawn_terrain_types) ? (
            renderCollectionItems(
              (detail as Record<string, unknown>).spawn_terrain_types as Array<Record<string, unknown>>,
              terrainLookup
            )
          ) : null}
          {section.title === "Skills" &&
          (detail as Record<string, unknown>)?.skills &&
          typeof (detail as Record<string, unknown>).skills === "object" &&
          !Array.isArray((detail as Record<string, unknown>).skills) ? (
            renderSkills((detail as Record<string, unknown>).skills as Record<string, unknown>)
          ) : null}
          <div className="members-entity-stats__list-table">
            {section.entries.map(([label, value]) => (
              <div key={`${section.title}-${label}`} className="members-entity-stats__list-row">
                <span className="members-entity-stats__list-label small">{label}</span>
                <strong className="members-entity-stats__list-value">{value || "None"}</strong>
              </div>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
};

const MemberEntityStatsPanel: React.FC = () => {
  const [kind, setKind] = useState<EntityStatsKind>("ship");
  const [items, setItems] = useState<EntityBrowseItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSourceKind, setSelectedSourceKind] = useState<EntityStatsKind | null>(null);
  const [detail, setDetail] = useState<EntityDetail>(null);
  const [selectedLinkedWeaponKey, setSelectedLinkedWeaponKey] = useState<string | null>(null);
  const [selectedLinkedWeaponDetail, setSelectedLinkedWeaponDetail] = useState<EntityDetail>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [linkedWeaponLoading, setLinkedWeaponLoading] = useState(false);
  const [compareIds, setCompareIds] = useState<CompareSelectionState>([null, null]);
  const [compareQueries, setCompareQueries] = useState<CompareQueryState>(["", ""]);
  const [compareDetails, setCompareDetails] = useState<CompareDetailState>({});
  const [compareLoading, setCompareLoading] = useState(false);
  const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);
  const [openGroupedSectionTitle, setOpenGroupedSectionTitle] = useState<string | null>(null);
  const [openGroupedSectionRect, setOpenGroupedSectionRect] = useState<OverlayRect | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [terrainLookup, setTerrainLookup] = useState<Record<string, TerrainLookupEntry>>({});
  const [cgtState, setCgtState] = useState<CgtResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setDetail(null);
        setSelectedId(null);

        const response = await entityLoaders[kind].list();

        if (cancelled) return;

        const weaponItems =
          kind === "weapon"
            ? []
            : ((await getStoredWeaponTypes()).data?.map((weapon: any) =>
                summarizeEntity(weapon, "weapon")
              ) ?? []);

        const mapped =
          kind === "item"
            ? buildOverlayBrowseItems(
                (response.data ?? []).map((item: any) => summarizeEntity(item, "item")),
                weaponItems
              )
            : kind === "weapon"
              ? buildOverlayBrowseItems(
                  (response.data ?? []).map((weapon: any) => summarizeEntity(weapon, "weapon")),
                  (await getStoredItemTypes()).data?.map((item: any) =>
                    summarizeEntity(item, "item")
                  ) ?? []
                )
              : attachMatchingWeaponRecords(
                  (response.data ?? []).map((item: any) => summarizeEntity(item, kind)),
                  weaponItems
                );
        setItems(mapped);
        setSelectedId(mapped[0]?.key ?? null);
        setSelectedSourceKind(kind === "item" || kind === "weapon" ? kind : null);
        setCompareIds([null, null]);
        setCompareQueries(["", ""]);
        setCompareDetails({});
        setShowDifferencesOnly(false);
      } catch (e: any) {
        if (!cancelled) {
          setItems([]);
          setSelectedId(null);
          setDetail(null);
          setError(e?.message ?? "Failed to load entity catalog.");
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
  }, [kind]);

  useEffect(() => {
    const activeCompareIds = compareIds.filter((id): id is string => !!id);

    if (activeCompareIds.length === 0) {
      setCompareDetails({});
      setCompareLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setCompareLoading(true);

        const responses = await Promise.all(
          activeCompareIds.map(async (id) => {
            const response = await entityLoaders[kind].detail(id);
            return [id, response.data ?? null] as const;
          })
        );

        if (cancelled) return;

        setCompareDetails(Object.fromEntries(responses));
      } catch {
        if (!cancelled) {
          setCompareDetails({});
        }
      } finally {
        if (!cancelled) {
          setCompareLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [compareIds, kind]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setDetailLoading(true);
        setError(null);
        const detailKind =
          kind === "item" || kind === "weapon"
            ? (selectedSourceKind ?? kind)
            : kind;
        const selectedItem = items.find((item) => item.key === selectedId) ?? null;
        const selectedRecord = selectedItem ? getBrowseRecordForKind(selectedItem, detailKind) : null;
        const selectedUid = selectedRecord?.uid ?? selectedId;

        const response = await entityLoaders[detailKind].detail(selectedUid);

        if (cancelled) return;

        setDetail(response.data ?? null);
      } catch (e: any) {
        if (!cancelled) {
          setDetail(null);
          setError(e?.message ?? "Failed to load entity detail.");
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kind, selectedId, selectedSourceKind, items]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await getStoredTerrainTypes();
        if (cancelled) return;

        const nextLookup: Record<string, TerrainLookupEntry> = {};
        (response.data ?? []).forEach((terrain) => {
          const entry: TerrainLookupEntry = {
            uid: terrain.uid ?? null,
            code: terrain.code ?? null,
            name: terrain.name ?? null,
            image_url: terrain.image_url ?? null,
            images: terrain.images ?? null,
          };

          if (terrain.uid) nextLookup[terrain.uid] = entry;
          if (terrain.code) nextLookup[String(terrain.code).toLowerCase()] = entry;
          if (terrain.name) nextLookup[String(terrain.name).toLowerCase()] = entry;
        });

        setTerrainLookup(nextLookup);
      } catch {
        if (!cancelled) {
          setTerrainLookup({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await getCgtTime();
        if (!cancelled) {
          setCgtState(response);
        }
      } catch {
        if (!cancelled) {
          setCgtState(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return items;
    }

    return items.filter((item) =>
      [
        item.name ?? "",
        item.primaryRecord.uid,
        item.itemRecord?.uid ?? "",
        item.weaponRecord?.uid ?? "",
        item.className ?? "",
      ].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }, [items, search]);

  const selectedSummary = useMemo(
    () => items.find((item) => item.key === selectedId) ?? null,
    [items, selectedId]
  );
  const compareItems = useMemo(
    () =>
      compareIds
        .map((id) => (id ? items.find((item) => item.key === id) ?? null : null))
        .filter((item): item is EntityBrowseItem => !!item),
    [compareIds, items]
  );

  const detailEntries = useMemo(() => {
    if (!detail) {
      return { concise: [], expanded: [] };
    }

    const imageKeys = new Set(["image_url", "icon_url", "images", "image_large_url", "image_small_url"]);
    const heroKeys = new Set(["uid", "name", "class_name", "last_pulled_at"]);
    const curatedSectionKeys = new Set([
      "weapons",
      "skills",
      "terrain_restrictions",
      "spawn_terrain_types",
      "hiring_locations",
      "material_types",
      "material_probability_percent",
      "materials",
      "affiliations",
      "affiliation",
      "description",
      "shield_arcs",
      "hyperdrive",
      "max_speed",
      "manoeuvrability",
      "weight_tonnes",
      "volume_m3",
      "length",
      "width",
      "height",
      "slot_size",
      "weight_capacity_tonnes",
      "volume_capacity_m3",
      "max_passengers",
      "hull",
      "shield",
      "ionic_capacity",
      "armour",
      "sensors",
      "ecm",
      "price_credits",
      "recommended_workers",
      "recycling_xp",
      "production_modifier",
    ]);
    const concise: Array<[string, unknown]> = [];
    const expanded: Array<[string, unknown]> = [];

    Object.entries(detail).forEach(([key, value]) => {
      if (imageKeys.has(key) || heroKeys.has(key) || key === "payload" || curatedSectionKeys.has(key)) {
        return;
      }

      if (/_href$/i.test(key)) {
        return;
      }

      if (value === null || value === undefined || value === "") {
        return;
      }

      if (shouldCollapseField(key, value)) {
        expanded.push([key, value]);
        return;
      }

      concise.push([key, value]);
    });

    return { concise, expanded };
  }, [detail]);

  const imageUrls = useMemo(() => collectImageUrls(detail, kind), [detail, kind]);
  const heroImageUrl = imageUrls[0] ?? selectedSummary?.imageUrl ?? null;
  const baseGroupedDetailSections = useMemo(() => buildGroupedDetailSections(detail), [detail]);
  const groupedSectionCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const linkedWeapons = useMemo(() => {
    if (!Array.isArray(detail?.weapons)) {
      return [];
    }

    return groupWeaponCollectionItems(detail.weapons.filter(
      (item): item is Record<string, unknown> => !!item && typeof item === "object"
    ));
  }, [detail]);
  useEffect(() => {
    setSelectedLinkedWeaponKey(null);
    setSelectedLinkedWeaponDetail(null);
    setLinkedWeaponLoading(false);
  }, [selectedId, kind]);

  useEffect(() => {
    if (!selectedLinkedWeaponKey) {
      setSelectedLinkedWeaponDetail(null);
      setLinkedWeaponLoading(false);
      return;
    }

    const selectedWeapon = linkedWeapons.find((item) => {
      const key =
        (typeof item.uid === "string" && item.uid) ||
        (typeof item.name === "string" && item.name) ||
        null;

      return key === selectedLinkedWeaponKey;
    }) ?? null;

    const identifier =
      (selectedWeapon && typeof selectedWeapon.uid === "string" && selectedWeapon.uid) ||
      (selectedWeapon && typeof selectedWeapon.name === "string" && selectedWeapon.name) ||
      null;

    if (!identifier) {
      setSelectedLinkedWeaponDetail(null);
      setLinkedWeaponLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLinkedWeaponLoading(true);
        const response = await getStoredWeaponType(identifier);

        if (cancelled) return;

        setSelectedLinkedWeaponDetail(response.data ?? null);
      } catch {
        if (!cancelled) {
          setSelectedLinkedWeaponDetail(null);
        }
      } finally {
        if (!cancelled) {
          setLinkedWeaponLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedLinkedWeaponKey, linkedWeapons]);
  const groupedDetailSections = useMemo(() => {
    let nextSections = baseGroupedDetailSections;

    if (linkedWeapons.length > 0) {
      const hasWeaponsSection = nextSections.some((section) => section.title === "Weapons");
      if (!hasWeaponsSection) {
        nextSections = [
          ...nextSections,
          { title: "Weapons", entries: [] as Array<[string, string]> },
        ];
      }
    }

    return nextSections;
  }, [baseGroupedDetailSections, linkedWeapons]);
  const openGroupedSection = useMemo(
    () => groupedDetailSections.find((section) => section.title === openGroupedSectionTitle) ?? null,
    [groupedDetailSections, openGroupedSectionTitle]
  );

  const compareRows = useMemo(() => {
    if (compareItems.length < 2) {
      return [];
    }

    const leftDetail = compareDetails[compareItems[0].key];
    const rightDetail = compareDetails[compareItems[1].key];

    if (!leftDetail || !rightDetail) {
      return [];
    }

    const excludedKeys = new Set([
      "uid",
      "name",
      "class_name",
      "description",
      "last_pulled_at",
      "payload",
      "image_url",
      "icon_url",
      "images",
      "weapons",
      "shield_arcs",
    ]);

    const keys = Array.from(new Set([...Object.keys(leftDetail), ...Object.keys(rightDetail)]));

    return keys
      .filter((key) => !excludedKeys.has(key) && !/_href$/i.test(key))
      .map((key) => {
        const leftValue = leftDetail[key];
        const rightValue = rightDetail[key];

        if (!isComparableScalar(leftValue) && !isComparableScalar(rightValue)) {
          return null;
        }

        const leftDisplay =
          leftValue === null || leftValue === undefined || leftValue === ""
            ? "—"
            : formatScalar(leftValue);
        const rightDisplay =
          rightValue === null || rightValue === undefined || rightValue === ""
            ? "—"
            : formatScalar(rightValue);
        const isDifferent = leftDisplay !== rightDisplay;

        if (showDifferencesOnly && !isDifferent) {
          return null;
        }

        return {
          key,
          label: formatLabel(key),
          leftDisplay,
          rightDisplay,
          isDifferent,
        };
      })
      .filter(
        (
          row
        ): row is {
          key: string;
          label: string;
          leftDisplay: string;
          rightDisplay: string;
          isDifferent: boolean;
        } => !!row
      );
  }, [compareItems, compareDetails, showDifferencesOnly]);

  const compareWeaponRows = useMemo(() => {
    if (compareItems.length < 2) {
      return [];
    }

    const leftDetail = compareDetails[compareItems[0].key];
    const rightDetail = compareDetails[compareItems[1].key];
    const leftWeapons = Array.isArray(leftDetail?.weapons)
      ? leftDetail.weapons.filter(isWeaponCollectionItem)
      : [];
    const rightWeapons = Array.isArray(rightDetail?.weapons)
      ? rightDetail.weapons.filter(isWeaponCollectionItem)
      : [];

    const allWeapons = new Map<string, { left: Array<Record<string, unknown>>; right: Array<Record<string, unknown>> }>();

    leftWeapons.forEach((item) => {
      const key = buildWeaponNameGroupKey(item);
      const existing = allWeapons.get(key);
      if (existing) {
        existing.left.push(item);
        return;
      }

      allWeapons.set(key, { left: [item], right: [] });
    });

    rightWeapons.forEach((item) => {
      const key = buildWeaponNameGroupKey(item);
      const existing = allWeapons.get(key);
      if (existing) {
        existing.right.push(item);
        return;
      }

      allWeapons.set(key, { left: [], right: [item] });
    });

    return Array.from(allWeapons.entries())
      .map(([key, value]) => {
        const representative = value.left[0] ?? value.right[0] ?? null;
        const label = representative
          ? `${typeof representative.name === "string" ? representative.name : "Weapon"}`
          : "Weapon";
        const leftSummaries = value.left
          .map((item) => getWeaponArcDisplay(item))
          .filter((summary) => summary.arcLabel || summary.meta);
        const rightSummaries = value.right
          .map((item) => getWeaponArcDisplay(item))
          .filter((summary) => summary.arcLabel || summary.meta);
        const leftId = value.left[0] && typeof value.left[0].uid === "string" ? `ID: ${formatSwcDisplayId(value.left[0].uid)}` : null;
        const rightId = value.right[0] && typeof value.right[0].uid === "string" ? `ID: ${formatSwcDisplayId(value.right[0].uid)}` : null;
        const isDifferent =
          leftId !== rightId ||
          JSON.stringify(leftSummaries) !== JSON.stringify(rightSummaries);

        if (showDifferencesOnly && !isDifferent) {
          return null;
        }

        return {
          key,
          label,
          leftId,
          rightId,
          leftSummaries,
          rightSummaries,
          isDifferent,
        };
      })
      .filter((row): row is {
        key: string;
        label: string;
        leftId: string | null;
        rightId: string | null;
        leftSummaries: Array<ReturnType<typeof getWeaponArcDisplay>>;
        rightSummaries: Array<ReturnType<typeof getWeaponArcDisplay>>;
        isDifferent: boolean;
      } => !!row);
  }, [compareItems, compareDetails, showDifferencesOnly]);

  const compareShieldArcRows = useMemo(() => {
    if (compareItems.length < 2) {
      return [];
    }

    const leftDetail = compareDetails[compareItems[0].key];
    const rightDetail = compareDetails[compareItems[1].key];
    const leftArcs = Array.isArray(leftDetail?.shield_arcs)
      ? leftDetail.shield_arcs.filter(isWeaponCollectionItem)
      : [];
    const rightArcs = Array.isArray(rightDetail?.shield_arcs)
      ? rightDetail.shield_arcs.filter(isWeaponCollectionItem)
      : [];

    const allArcs = new Map<string, { left: Record<string, unknown> | null; right: Record<string, unknown> | null }>();

    leftArcs.forEach((item) => {
      const key =
        (typeof item.name === "string" && item.name) ||
        (typeof item.arc === "string" && item.arc) ||
        `left-${allArcs.size}`;
      const existing = allArcs.get(key);
      allArcs.set(key, { left: item, right: existing?.right ?? null });
    });

    rightArcs.forEach((item) => {
      const key =
        (typeof item.name === "string" && item.name) ||
        (typeof item.arc === "string" && item.arc) ||
        `right-${allArcs.size}`;
      const existing = allArcs.get(key);
      allArcs.set(key, { left: existing?.left ?? null, right: item });
    });

    return Array.from(allArcs.entries())
      .map(([key, value]) => {
        const leftSummary = value.left ? getShieldArcDisplay(value.left) : null;
        const rightSummary = value.right ? getShieldArcDisplay(value.right) : null;
        const isDifferent = JSON.stringify(leftSummary) !== JSON.stringify(rightSummary);

        if (showDifferencesOnly && !isDifferent) {
          return null;
        }

        return {
          key,
          label: key,
          leftSummary,
          rightSummary,
          isDifferent,
        };
      })
      .filter((row): row is {
        key: string;
        label: string;
        leftSummary: ReturnType<typeof getShieldArcDisplay> | null;
        rightSummary: ReturnType<typeof getShieldArcDisplay> | null;
        isDifferent: boolean;
      } => !!row);
  }, [compareItems, compareDetails, showDifferencesOnly]);

  const compareOptionLabels = useMemo(
    () =>
      items.map((item) => ({
        id: item.key,
        label: `${item.name ?? item.primaryRecord.uid} (${formatSwcDisplayId(item.primaryRecord.uid)})`,
      })),
    [items]
  );
  const compareCount = compareIds.filter((id): id is string => !!id).length;

  function setCompareSlot(slotIndex: 0 | 1, query: string) {
    setCompareQueries((current) => {
      const next: CompareQueryState = [...current] as CompareQueryState;
      next[slotIndex] = query;
      return next;
    });

    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      setCompareIds((current) => {
        const next: CompareSelectionState = [...current] as CompareSelectionState;
        next[slotIndex] = null;
        return next;
      });
      return;
    }

    const matchedItem =
      items.find((item) => {
        const label = `${item.name ?? item.primaryRecord.uid} (${formatSwcDisplayId(item.primaryRecord.uid)})`.toLowerCase();
        return (
          label === normalizedQuery ||
          (item.name ?? "").toLowerCase() === normalizedQuery ||
          item.primaryRecord.uid.toLowerCase() === normalizedQuery ||
          formatSwcDisplayId(item.primaryRecord.uid).toLowerCase() === normalizedQuery
        );
      }) ?? null;

    if (!matchedItem) {
      return;
    }

    setCompareIds((current) => {
      const next: CompareSelectionState = [...current] as CompareSelectionState;
      next[slotIndex] = matchedItem.key;
      return next;
    });
  }

  return (
    <section className="panel admin-panel members-entity-stats">
      <div className="admin-panel__header">
        <h2>Entity Stats</h2>
        <p className="small">
          Browse the stored SWC catalogs in a member-friendly view without digging through raw JSON.
        </p>
      </div>

      <div className="members-entity-stats__tabs">
        {kindOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`btn${kind === option.key ? " admin-nav__btn--active" : ""}`}
            onClick={() => {
              setKind(option.key);
              setSearch("");
              setError(null);
              setSelectedId(null);
              setSelectedSourceKind(option.key === "item" || option.key === "weapon" ? option.key : null);
              setDetail(null);
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="members-entity-stats__toolbar">
        <label className="members-universe__field">
          <span className="small">Search {kindOptions.find((option) => option.key === kind)?.label ?? "Catalog"}</span>
          <input
            className="input"
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, UID, or class"
          />
        </label>
        <div className="members-entity-stats__compare-toolbar">
          <label className="members-universe__field">
            <span className="small">Compare A</span>
            <input
              className="input"
              type="text"
              list={`members-entity-compare-a-${kind}`}
              value={compareQueries[0]}
              onChange={(event) => setCompareSlot(0, event.target.value)}
              placeholder="Search first record"
            />
            <datalist id={`members-entity-compare-a-${kind}`}>
              {compareOptionLabels.map((option) => (
                <option key={`a-${option.id}`} value={option.label} />
              ))}
            </datalist>
          </label>
          <label className="members-universe__field">
            <span className="small">Compare B</span>
            <input
              className="input"
              type="text"
              list={`members-entity-compare-b-${kind}`}
              value={compareQueries[1]}
              onChange={(event) => setCompareSlot(1, event.target.value)}
              placeholder="Search second record"
            />
            <datalist id={`members-entity-compare-b-${kind}`}>
              {compareOptionLabels.map((option) => (
                <option key={`b-${option.id}`} value={option.label} />
              ))}
            </datalist>
          </label>
          <span className="small">Compare: {compareCount}/2 selected</span>
          {compareCount === 2 ? (
            <label className="members-entity-stats__compare-toggle">
              <input
                type="checkbox"
                checked={showDifferencesOnly}
                onChange={(event) => setShowDifferencesOnly(event.target.checked)}
              />
              <span className="small">Differences only</span>
            </label>
          ) : null}
          {compareCount > 0 ? (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setCompareIds([null, null]);
                setCompareQueries(["", ""]);
                setCompareDetails({});
                setShowDifferencesOnly(false);
              }}
            >
              Clear Compare
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <p className="small" style={{ color: "salmon" }}>
          {error}
        </p>
      ) : null}

      <div className="members-entity-stats__layout">
        <aside className="members-entity-stats__sidebar">
          <div className="members-entity-stats__sidebar-header">
            <strong>{filteredItems.length}</strong>
            <span className="small">records</span>
          </div>

          {loading ? (
            <p className="small">Loading catalog…</p>
          ) : filteredItems.length === 0 ? (
            <p className="small">No matching records found.</p>
          ) : (
            <div className="members-entity-stats__list">
              {filteredItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`members-entity-stats__item${item.key === selectedId ? " is-active" : ""}`}
                  onClick={() => {
                    setSelectedId(item.key);
                    setSelectedSourceKind(item.primaryRecord.sourceKind);
                  }}
                >
                  <strong>{item.name ?? item.primaryRecord.uid}</strong>
                  <span className="small">
                    {formatSwcDisplayId(item.primaryRecord.uid)}
                  </span>
                  {item.className ? <span className="small">{item.className}</span> : null}
                  {item.itemRecord && item.weaponRecord ? (
                    <span className="small">Weapon</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="members-entity-stats__detail">
          {compareCount === 2 ? (
            compareLoading ? (
              <p className="small">Loading compare view…</p>
            ) : compareItems.length === 2 ? (
              <section className="members-entity-stats__compare-view">
                <div className="members-entity-stats__compare-hero">
                  {compareItems.map((item) => (
                    <article key={item.key} className="members-entity-stats__compare-card">
                      <h3>{item.name ?? item.primaryRecord.uid}</h3>
                      <p className="small">ID: {formatSwcDisplayId(item.primaryRecord.uid)}</p>
                      {item.className ? <p className="small">Class: {item.className}</p> : null}
                      {item.lastPulledAt ? (
                        <p className="small">
                          Last pulled: {formatTimestampAsCgt(item.lastPulledAt, cgtState)}
                        </p>
                      ) : null}
                    </article>
                  ))}
                </div>

                {compareRows.length > 0 ? (
                  <div className="members-entity-stats__compare-grid">
                    <div className="members-entity-stats__compare-head small">Field</div>
                    <div className="members-entity-stats__compare-head small">
                      {compareItems[0].name ?? formatSwcDisplayId(compareItems[0].primaryRecord.uid)}
                    </div>
                    <div className="members-entity-stats__compare-head small">
                      {compareItems[1].name ?? formatSwcDisplayId(compareItems[1].primaryRecord.uid)}
                    </div>

                    {compareRows.map((row) => (
                      <React.Fragment key={row.key}>
                        <div className={`members-entity-stats__compare-cell members-entity-stats__compare-cell--label${row.isDifferent ? " is-different" : ""}`}>
                          {row.label}
                        </div>
                        <div className={`members-entity-stats__compare-cell${row.isDifferent ? " is-different" : ""}`}>
                          {row.leftDisplay}
                        </div>
                        <div className={`members-entity-stats__compare-cell${row.isDifferent ? " is-different" : ""}`}>
                          {row.rightDisplay}
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                ) : (
                  <p className="small">No comparable scalar fields found for these two records.</p>
                )}

                {compareWeaponRows.length > 0 ? (
                  <section className="members-entity-stats__section">
                    <h4>Weapon Differences</h4>
                    <div className="members-entity-stats__compare-grid">
                      <div className="members-entity-stats__compare-head small">Weapon</div>
                      <div className="members-entity-stats__compare-head small">
                        {compareItems[0].name ?? formatSwcDisplayId(compareItems[0].primaryRecord.uid)}
                      </div>
                      <div className="members-entity-stats__compare-head small">
                        {compareItems[1].name ?? formatSwcDisplayId(compareItems[1].primaryRecord.uid)}
                      </div>

                      {compareWeaponRows.map((row) => (
                        <React.Fragment key={row.key}>
                          <div className={`members-entity-stats__compare-cell members-entity-stats__compare-cell--label${row.isDifferent ? " is-different" : ""}`}>
                            {row.label}
                          </div>
                          <div className={`members-entity-stats__compare-cell${row.isDifferent ? " is-different" : ""}`}>
                            {row.leftId ? <strong>{row.leftId}</strong> : <strong>—</strong>}
                            {row.leftSummaries.map((summary, index) => (
                              <div key={`${row.key}-left-${index}`} className="members-entity-stats__weapon-arc-line">
                                <ArcIndicator
                                  arcName={summary.arcName}
                                  arcFrom={summary.arcFrom}
                                  arcTo={summary.arcTo}
                                />
                                <span className="members-entity-stats__weapon-arc-name small">
                                  {summary.arcLabel}
                                </span>
                                {summary.meta ? (
                                  <span className="members-entity-stats__weapon-arc-meta small">
                                    {summary.meta}
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                          <div className={`members-entity-stats__compare-cell${row.isDifferent ? " is-different" : ""}`}>
                            {row.rightId ? <strong>{row.rightId}</strong> : <strong>—</strong>}
                            {row.rightSummaries.map((summary, index) => (
                              <div key={`${row.key}-right-${index}`} className="members-entity-stats__weapon-arc-line">
                                <ArcIndicator
                                  arcName={summary.arcName}
                                  arcFrom={summary.arcFrom}
                                  arcTo={summary.arcTo}
                                />
                                <span className="members-entity-stats__weapon-arc-name small">
                                  {summary.arcLabel}
                                </span>
                                {summary.meta ? (
                                  <span className="members-entity-stats__weapon-arc-meta small">
                                    {summary.meta}
                                  </span>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </section>
                ) : null}

                {compareShieldArcRows.length > 0 ? (
                  <section className="members-entity-stats__section">
                    <h4>Shield Arc Differences</h4>
                    <div className="members-entity-stats__compare-grid">
                      <div className="members-entity-stats__compare-head small">Arc</div>
                      <div className="members-entity-stats__compare-head small">
                        {compareItems[0].name ?? formatSwcDisplayId(compareItems[0].primaryRecord.uid)}
                      </div>
                      <div className="members-entity-stats__compare-head small">
                        {compareItems[1].name ?? formatSwcDisplayId(compareItems[1].primaryRecord.uid)}
                      </div>

                      {compareShieldArcRows.map((row) => (
                        <React.Fragment key={row.key}>
                          <div className={`members-entity-stats__compare-cell members-entity-stats__compare-cell--label${row.isDifferent ? " is-different" : ""}`}>
                            {row.label}
                          </div>
                          <div className={`members-entity-stats__compare-cell${row.isDifferent ? " is-different" : ""}`}>
                            {row.leftSummary ? (
                              <div className="members-entity-stats__weapon-arc-line">
                                <ArcIndicator
                                  arcName={row.leftSummary.arcName}
                                  arcFrom={row.leftSummary.arcFrom}
                                  arcTo={row.leftSummary.arcTo}
                                />
                                <span className="members-entity-stats__weapon-arc-name small">
                                  {row.leftSummary.arcLabel}
                                </span>
                                {row.leftSummary.meta ? (
                                  <span className="members-entity-stats__weapon-arc-meta small">
                                    {row.leftSummary.meta}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <strong>—</strong>
                            )}
                          </div>
                          <div className={`members-entity-stats__compare-cell${row.isDifferent ? " is-different" : ""}`}>
                            {row.rightSummary ? (
                              <div className="members-entity-stats__weapon-arc-line">
                                <ArcIndicator
                                  arcName={row.rightSummary.arcName}
                                  arcFrom={row.rightSummary.arcFrom}
                                  arcTo={row.rightSummary.arcTo}
                                />
                                <span className="members-entity-stats__weapon-arc-name small">
                                  {row.rightSummary.arcLabel}
                                </span>
                                {row.rightSummary.meta ? (
                                  <span className="members-entity-stats__weapon-arc-meta small">
                                    {row.rightSummary.meta}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <strong>—</strong>
                            )}
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </section>
                ) : null}
              </section>
            ) : (
              <p className="small">Select two records from this tab to compare them.</p>
            )
          ) : detailLoading ? (
            <p className="small">Loading detail…</p>
          ) : !detail || !selectedSummary ? (
            <p className="small">Select a record to view its stats.</p>
          ) : (
            <>
              <div className="members-entity-stats__hero">
                {heroImageUrl ? (
                  <img
                    src={heroImageUrl}
                    alt={selectedSummary.name ?? selectedSummary.primaryRecord.uid}
                    className="members-entity-stats__image"
                  />
                ) : null}

                <div className="members-entity-stats__hero-copy">
                  <h3>{selectedSummary.name ?? selectedSummary.primaryRecord.uid}</h3>
                  <p className="small">
                    ID: {formatSwcDisplayId(
                      getBrowseRecordForKind(
                        selectedSummary,
                        kind === "item" || kind === "weapon"
                          ? (selectedSourceKind ?? kind)
                          : kind
                      ).uid
                    )}
                  </p>
                  {selectedSummary.className ? (
                    <p className="small">Class: {selectedSummary.className}</p>
                  ) : null}
                  {selectedSummary.lastPulledAt ? (
                    <p className="small">
                      Last pulled: {formatTimestampAsCgt(selectedSummary.lastPulledAt, cgtState)}
                    </p>
                  ) : null}
                </div>
              </div>
              {groupedDetailSections.length > 0 ? (
                <div className={"members-entity-stats__grouped-sections" + (openGroupedSection ? " members-entity-stats__grouped-sections--has-open" : "")}>
                  {groupedDetailSections.map((section) => (
                    <button
                      key={section.title}
                      type="button"
                      ref={(element) => {
                        groupedSectionCardRefs.current[section.title] = element;
                      }}
                      className={
                        "members-entity-stats__group-panel" +
                        (openGroupedSectionTitle === section.title ? " is-active" : "")
                      }
                      onClick={() => {
                        if (openGroupedSectionTitle === section.title) {
                          setOpenGroupedSectionTitle(null);
                          setOpenGroupedSectionRect(null);
                          return;
                        }

                        const element = groupedSectionCardRefs.current[section.title];
                        if (!element) {
                          return;
                        }

                        const rect = element.getBoundingClientRect();
                        setOpenGroupedSectionRect({
                          top: rect.top,
                          left: rect.left,
                          width: rect.width,
                          height: rect.height,
                        });
                        setOpenGroupedSectionTitle(section.title);
                      }}
                    >
                      <div className="members-entity-stats__group-panel-header">
                        <div className="members-entity-stats__group-panel-copy">
                          <h4>{section.title}</h4>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {detailEntries.expanded.map(([key, value]) => (
                <details key={key} className="members-entity-stats__raw">
                  <summary>{formatLabel(key)}</summary>
                  {key === "skills" && value && typeof value === "object" && !Array.isArray(value) ? (
                    renderSkills(value as Record<string, unknown>)
                  ) : Array.isArray(value) && value.every((item) => item && typeof item === "object") ? (
                    renderCollectionItems(value as Array<Record<string, unknown>>, terrainLookup)
                  ) : typeof value === "string" ? (
                    looksLikeHtml(value) ? (
                      <div
                        className="members-entity-stats__long-text members-entity-stats__long-text--html"
                        dangerouslySetInnerHTML={{ __html: value }}
                      />
                    ) : (
                      <div className="members-entity-stats__long-text">{value}</div>
                    )
                  ) : (
                    <pre className="members-entity-stats__json">{JSON.stringify(value, null, 2)}</pre>
                  )}
                </details>
              ))}
            </>
          )}
        </section>
      </div>

      {openGroupedSection && openGroupedSectionRect ? (
        <EntityStatsGroupOverlay
          section={openGroupedSection}
          detail={detail}
          linkedWeapons={openGroupedSection.title === "Weapons" ? linkedWeapons : []}
          terrainLookup={terrainLookup}
          selectedLinkedWeaponKey={selectedLinkedWeaponKey}
          onSelectLinkedWeapon={(item) => {
            const key =
              (typeof item.uid === "string" && item.uid) ||
              (typeof item.name === "string" && item.name) ||
              null;
            setSelectedLinkedWeaponKey((current) => (current === key ? null : key));
          }}
          linkedWeaponLoading={linkedWeaponLoading}
          selectedLinkedWeaponDetail={selectedLinkedWeaponDetail}
          sourceRect={openGroupedSectionRect}
          onClose={() => {
            setOpenGroupedSectionTitle(null);
            setOpenGroupedSectionRect(null);
          }}
        />
      ) : null}
    </section>
  );
};

export default MemberEntityStatsPanel;
