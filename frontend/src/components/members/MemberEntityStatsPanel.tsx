import React, { useEffect, useMemo, useState } from "react";
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
import { formatTimestampAsCgt, getCgtTime, type CgtResponse } from "../../api/time";

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
  { key: "weapon", label: "Weapons" },
  { key: "planet", label: "Planets" },
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

function collectImageUrls(detail: EntityDetail): string[] {
  if (!detail) {
    return [];
  }

  const urls = new Set<string>();

  const maybeAdd = (value: unknown) => {
    if (typeof value === "string" && value.trim() !== "") {
      urls.add(value);
    }
  };

  maybeAdd(detail.image_url);
  maybeAdd(detail.icon_url);

  const images = detail.images;
  if (images && typeof images === "object" && !Array.isArray(images)) {
    Object.values(images as Record<string, unknown>).forEach((value) => {
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

function formatWeaponCollectionSummary(item: Record<string, unknown>) {
  const parts: string[] = [];

  if (typeof item.uid === "string" && item.uid) {
    parts.push(`ID: ${formatSwcDisplayId(item.uid)}`);
  }

  if (item.quantity !== null && item.quantity !== undefined && item.quantity !== "") {
    parts.push(`Quantity: ${formatScalar(item.quantity)}`);
  }

  if (typeof item.arc === "string" && item.arc) {
    parts.push(`Arc: ${item.arc}`);
  }

  if (item.arc_from !== null && item.arc_from !== undefined && item.arc_from !== "") {
    parts.push(`Arc From: ${formatScalar(item.arc_from)}`);
  }

  if (item.arc_to !== null && item.arc_to !== undefined && item.arc_to !== "") {
    parts.push(`Arc To: ${formatScalar(item.arc_to)}`);
  }

  return parts.join(" · ");
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
            <div className="members-entity-stats__chip-list">
              {visibleSkills.map(([skillName, skillValue]) => (
                <span key={skillName} className="members-entity-stats__chip">
                  {formatLabel(skillName)}: {formatScalar(skillValue)}
                </span>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

const MemberEntityStatsPanel: React.FC = () => {
  const [kind, setKind] = useState<EntityStatsKind>("ship");
  const [items, setItems] = useState<EntityBrowseItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSourceKind, setSelectedSourceKind] = useState<EntityStatsKind | null>(null);
  const [detail, setDetail] = useState<EntityDetail>(null);
  const [relatedWeaponDetail, setRelatedWeaponDetail] = useState<EntityDetail>(null);
  const [selectedLinkedWeaponKey, setSelectedLinkedWeaponKey] = useState<string | null>(null);
  const [selectedLinkedWeaponDetail, setSelectedLinkedWeaponDetail] = useState<EntityDetail>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [relatedWeaponLoading, setRelatedWeaponLoading] = useState(false);
  const [linkedWeaponLoading, setLinkedWeaponLoading] = useState(false);
  const [compareIds, setCompareIds] = useState<CompareSelectionState>([null, null]);
  const [compareQueries, setCompareQueries] = useState<CompareQueryState>(["", ""]);
  const [compareDetails, setCompareDetails] = useState<CompareDetailState>({});
  const [compareLoading, setCompareLoading] = useState(false);
  const [showDifferencesOnly, setShowDifferencesOnly] = useState(false);
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
    if (kind === "weapon") {
      setRelatedWeaponDetail(null);
      setRelatedWeaponLoading(false);
      return;
    }

    const selectedItem = items.find((item) => item.key === selectedId) ?? null;
    const weaponUid = selectedItem?.weaponRecord?.uid ?? null;

    if (!weaponUid) {
      setRelatedWeaponDetail(null);
      setRelatedWeaponLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setRelatedWeaponLoading(true);
        const response = await getStoredWeaponType(weaponUid);

        if (cancelled) return;

        setRelatedWeaponDetail(response.data ?? null);
      } catch {
        if (!cancelled) {
          setRelatedWeaponDetail(null);
        }
      } finally {
        if (!cancelled) {
          setRelatedWeaponLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kind, selectedId, items]);

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

    const imageKeys = new Set(["image_url", "icon_url", "images"]);
    const heroKeys = new Set(["uid", "name", "class_name", "last_pulled_at"]);
    const curatedSectionKeys = new Set(["weapons"]);
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

  const imageUrls = useMemo(() => collectImageUrls(detail), [detail]);
  const linkedWeapons = useMemo(() => {
    if (!Array.isArray(detail?.weapons)) {
      return [];
    }

    return detail.weapons.filter(
      (item): item is Record<string, unknown> => !!item && typeof item === "object"
    );
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
  const relatedWeaponSummary = useMemo(() => {
    if (kind === "weapon" || !selectedSummary?.weaponRecord) {
      return null;
    }

    return {
      record: selectedSummary.weaponRecord,
      detail: relatedWeaponDetail,
      statEntries: buildWeaponStatEntries(relatedWeaponDetail),
    };
  }, [kind, selectedSummary, relatedWeaponDetail]);

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
      "last_pulled_at",
      "payload",
      "image_url",
      "icon_url",
      "images",
      "weapons",
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

    const allWeapons = new Map<string, { left: Record<string, unknown> | null; right: Record<string, unknown> | null }>();

    leftWeapons.forEach((item) => {
      const key = buildWeaponCollectionKey(item);
      allWeapons.set(key, { left: item, right: null });
    });

    rightWeapons.forEach((item) => {
      const key = buildWeaponCollectionKey(item);
      const existing = allWeapons.get(key);
      if (existing) {
        existing.right = item;
        return;
      }

      allWeapons.set(key, { left: null, right: item });
    });

    return Array.from(allWeapons.entries())
      .map(([key, value]) => {
        const leftLabel = value.left
          ? `${typeof value.left.name === "string" ? value.left.name : "Weapon"}`
          : "—";
        const rightLabel = value.right
          ? `${typeof value.right.name === "string" ? value.right.name : "Weapon"}`
          : "—";
        const leftSummary = value.left ? formatWeaponCollectionSummary(value.left) : "—";
        const rightSummary = value.right ? formatWeaponCollectionSummary(value.right) : "—";
        const isDifferent = leftLabel !== rightLabel || leftSummary !== rightSummary;

        if (showDifferencesOnly && !isDifferent) {
          return null;
        }

        return {
          key,
          leftLabel,
          rightLabel,
          leftSummary,
          rightSummary,
          isDifferent,
        };
      })
      .filter((row): row is {
        key: string;
        leftLabel: string;
        rightLabel: string;
        leftSummary: string;
        rightSummary: string;
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
                    {item.itemRecord && item.weaponRecord
                      ? ` · ${formatSwcDisplayId(item.itemRecord.uid)} / ${formatSwcDisplayId(item.weaponRecord.uid)}`
                      : ""}
                  </span>
                  {item.className ? <span className="small">{item.className}</span> : null}
                  {item.itemRecord && item.weaponRecord ? (
                    <span className="small">Item + Weapon</span>
                  ) : item.weaponRecord && kind !== "weapon" ? (
                    <span className="small">Matching Weapon Record</span>
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
                            {row.leftLabel !== "—" ? row.leftLabel : row.rightLabel}
                          </div>
                          <div className={`members-entity-stats__compare-cell${row.isDifferent ? " is-different" : ""}`}>
                            <strong>{row.leftLabel}</strong>
                            {row.leftSummary !== "—" ? <div className="small">{row.leftSummary}</div> : null}
                          </div>
                          <div className={`members-entity-stats__compare-cell${row.isDifferent ? " is-different" : ""}`}>
                            <strong>{row.rightLabel}</strong>
                            {row.rightSummary !== "—" ? <div className="small">{row.rightSummary}</div> : null}
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
                {(selectedSummary.imageUrl || imageUrls[0]) ? (
                  <img
                    src={selectedSummary.imageUrl ?? imageUrls[0]}
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

              {imageUrls.length > 0 ? (
                <section className="members-entity-stats__section">
                  <h4>Images</h4>
                  <div className="members-entity-stats__image-strip">
                    {imageUrls.map((url) => (
                      <article key={url} className="members-entity-stats__image-card">
                        <img src={url} alt={selectedSummary.name ?? selectedSummary.primaryRecord.uid} />
                        <p className="small">{url}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {linkedWeapons.length > 0 ? (
                <section className="members-entity-stats__section">
                  <h4>Linked Weapons</h4>
                  {renderCollectionItems(linkedWeapons, terrainLookup, {
                    hideImages: true,
                    activeKey: selectedLinkedWeaponKey,
                    onSelect: (item) => {
                      const key =
                        (typeof item.uid === "string" && item.uid) ||
                        (typeof item.name === "string" && item.name) ||
                        null;
                      setSelectedLinkedWeaponKey((current) => (current === key ? null : key));
                    },
                  })}
                  {linkedWeaponLoading ? (
                    <p className="small">Loading weapon stats…</p>
                  ) : selectedLinkedWeaponDetail ? (
                    <div className="members-entity-stats__stats-grid">
                      {buildWeaponStatEntries(selectedLinkedWeaponDetail).map(([label, value]) => (
                        <article key={label} className="members-entity-stats__stat">
                          <span className="small">{label}</span>
                          <strong>{formatScalar(value)}</strong>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {relatedWeaponSummary ? (
                <section className="members-entity-stats__section">
                  <div className="members-entity-stats__section-heading">
                    <h4>Matching Weapon Record</h4>
                  </div>

                  <div className="members-entity-stats__related-card">
                    <div className="members-entity-stats__related-copy">
                      <strong>{relatedWeaponSummary.record.name ?? relatedWeaponSummary.record.uid}</strong>
                      <span className="small">
                        ID: {formatSwcDisplayId(relatedWeaponSummary.record.uid)}
                      </span>
                      {relatedWeaponSummary.record.className ? (
                        <span className="small">Class: {relatedWeaponSummary.record.className}</span>
                      ) : null}
                    </div>
                  </div>

                  {relatedWeaponLoading ? (
                    <p className="small">Loading weapon stats…</p>
                  ) : relatedWeaponSummary.statEntries.length > 0 ? (
                    <div className="members-entity-stats__stats-grid">
                      {relatedWeaponSummary.statEntries.map(([label, value]) => (
                        <article key={label} className="members-entity-stats__stat">
                          <span className="small">{label}</span>
                          <strong>{formatScalar(value)}</strong>
                        </article>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}

              {detailEntries.concise.length > 0 ? (
                <div className="members-entity-stats__stats-grid">
                  {detailEntries.concise.map(([key, value]) => (
                    <article key={key} className="members-entity-stats__stat">
                      <span className="small">{formatLabel(key)}</span>
                      <strong>{formatScalar(value)}</strong>
                    </article>
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
    </section>
  );
};

export default MemberEntityStatsPanel;
