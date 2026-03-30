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

type EntitySummary = {
  uid: string;
  name: string | null;
  className?: string | null;
  imageUrl?: string | null;
  lastPulledAt: string | null;
};

type EntityDetail = Record<string, unknown> | null;
type TerrainLookupEntry = {
  uid: string | null;
  code: string | null;
  name: string | null;
  image_url: string | null;
  images?: Record<string, string | null> | null;
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

function summarizeEntity(item: any): EntitySummary {
  return {
    uid: String(item.uid ?? ""),
    name: item.name ?? null,
    className: item.class_name ?? null,
    imageUrl: item.icon_url ?? item.images?.small ?? item.images?.icon ?? item.image_url ?? null,
    lastPulledAt: item.last_pulled_at ?? null,
  };
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

  return String(value);
}

function shouldCollapseField(key: string, value: unknown) {
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
  terrainLookup: Record<string, TerrainLookupEntry>
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
        const imageUrl = resolveCollectionImageUrl(item, terrainLookup);

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

        return (
          <article key={`${primary}-${index}`} className="members-entity-stats__collection-card">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={typeof item.name === "string" ? item.name : primary}
                className="members-entity-stats__collection-image"
              />
            ) : null}
            <strong>{primary}</strong>
            {extras.length > 0 ? <p className="small">{extras.join(" · ")}</p> : null}
          </article>
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
  const [items, setItems] = useState<EntitySummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EntityDetail>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
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

        const mapped = (response.data ?? []).map(summarizeEntity);
        setItems(mapped);
        setSelectedId(mapped[0]?.uid ?? null);
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
    if (!selectedId) {
      setDetail(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setDetailLoading(true);
        setError(null);
        const response = await entityLoaders[kind].detail(selectedId);

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
  }, [kind, selectedId]);

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
      [item.name ?? "", item.uid, item.className ?? ""].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }, [items, search]);

  const selectedSummary = useMemo(
    () => items.find((item) => item.uid === selectedId) ?? null,
    [items, selectedId]
  );

  const detailEntries = useMemo(() => {
    if (!detail) {
      return { concise: [], expanded: [] };
    }

    const imageKeys = new Set(["image_url", "icon_url", "images"]);
    const heroKeys = new Set(["uid", "name", "class_name", "last_pulled_at"]);
    const concise: Array<[string, unknown]> = [];
    const expanded: Array<[string, unknown]> = [];

    Object.entries(detail).forEach(([key, value]) => {
      if (imageKeys.has(key) || heroKeys.has(key) || key === "payload") {
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
                  key={item.uid}
                  type="button"
                  className={`members-entity-stats__item${item.uid === selectedId ? " is-active" : ""}`}
                  onClick={() => setSelectedId(item.uid)}
                >
                  <strong>{item.name ?? item.uid}</strong>
                  <span className="small">{formatSwcDisplayId(item.uid)}</span>
                  {item.className ? <span className="small">{item.className}</span> : null}
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="members-entity-stats__detail">
          {detailLoading ? (
            <p className="small">Loading detail…</p>
          ) : !detail || !selectedSummary ? (
            <p className="small">Select a record to view its stats.</p>
          ) : (
            <>
              <div className="members-entity-stats__hero">
                {(selectedSummary.imageUrl || imageUrls[0]) ? (
                  <img
                    src={selectedSummary.imageUrl ?? imageUrls[0]}
                    alt={selectedSummary.name ?? selectedSummary.uid}
                    className="members-entity-stats__image"
                  />
                ) : null}

                <div className="members-entity-stats__hero-copy">
                  <h3>{selectedSummary.name ?? selectedSummary.uid}</h3>
                  <p className="small">ID: {formatSwcDisplayId(selectedSummary.uid)}</p>
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
                        <img src={url} alt={selectedSummary.name ?? selectedSummary.uid} />
                        <p className="small">{url}</p>
                      </article>
                    ))}
                  </div>
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
