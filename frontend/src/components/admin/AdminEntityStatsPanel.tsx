import React, { useEffect, useMemo, useState } from "react";
import {
  getStoredCreatureType,
  getStoredCreatureTypes,
  getStoredFacilityType,
  getStoredFacilityTypes,
  getStoredDroidType,
  getStoredDroidTypes,
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
  getStoredVehicleType,
  getStoredVehicleTypes,
  getStoredStationType,
  getStoredStationTypes,
  getStoredTerrainType,
  getStoredTerrainTypes,
  getStoredWeaponType,
  getStoredWeaponTypes,
  populateAdminMaterialIcons,
  populateAdminStationIcons,
  type EntityStatsKind,
  updateAdminEntityStats,
} from "../../api/universe";

type EntityRecordSummary = {
  uid: string;
  name: string | null;
  sourceKind: EntityStatsKind;
  code?: string | null;
  classUid?: string | null;
  className?: string | null;
  imageUrl?: string | null;
  last_pulled_at: string | null;
};

type EntityBrowseItem = {
  key: string;
  name: string | null;
  imageUrl?: string | null;
  code?: string | null;
  className?: string | null;
  last_pulled_at: string | null;
  primaryRecord: EntityRecordSummary;
  itemRecord?: EntityRecordSummary | null;
  weaponRecord?: EntityRecordSummary | null;
};

const kindOptions: Array<{ key: EntityStatsKind; label: string }> = [
  { key: "station", label: "Station Types" },
  { key: "facility", label: "Facility Types" },
  { key: "item", label: "Item Types" },
  { key: "planet", label: "Planet Types" },
  { key: "ship", label: "Ship Types" },
  { key: "vehicle", label: "Vehicle Types" },
  { key: "droid", label: "Droid Types" },
  { key: "creature", label: "Creature Types" },
  { key: "npc", label: "NPC Types" },
  { key: "race", label: "Races" },
  { key: "weapon", label: "Weapon Types" },
  { key: "terrain", label: "Terrain Types" },
  { key: "material", label: "Material Types" },
];

function summarizeEntity(item: any, sourceKind: EntityStatsKind): EntityRecordSummary {
  return {
    uid: String(item.uid ?? ""),
    name: item.name ?? null,
    sourceKind,
    code: item.code ?? null,
    classUid: item.class_uid ?? null,
    className: item.class_name ?? null,
    imageUrl:
      item.icon_url ??
      item.images?.small ??
      item.images?.icon ??
      item.image_url ??
      null,
    last_pulled_at: item.last_pulled_at ?? null,
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
      imageUrl: item.imageUrl ?? related?.imageUrl ?? null,
      code: item.code ?? related?.code ?? null,
      className: item.className ?? related?.className ?? null,
      last_pulled_at: item.last_pulled_at ?? related?.last_pulled_at ?? null,
      primaryRecord: item,
      itemRecord,
      weaponRecord,
    };
  });
}

function getBrowseRecordForKind(
  item: EntityBrowseItem,
  sourceKind: EntityStatsKind
) {
  if (sourceKind === "item") {
    return item.itemRecord ?? item.primaryRecord;
  }

  if (sourceKind === "weapon") {
    return item.weaponRecord ?? item.primaryRecord;
  }

  return item.primaryRecord;
}

const AdminEntityStatsPanel: React.FC = () => {
  const [kind, setKind] = useState<EntityStatsKind>("station");
  const [items, setItems] = useState<EntityBrowseItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedSourceKind, setSelectedSourceKind] = useState<EntityStatsKind | null>(null);
  const [search, setSearch] = useState("");
  const [itemClassFilter, setItemClassFilter] = useState<string>("all");
  const [editorValue, setEditorValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [iconPopulateLoading, setIconPopulateLoading] = useState(false);
  const [materialIconPopulateLoading, setMaterialIconPopulateLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setMessage(null);

        const response =
          kind === "station"
            ? await getStoredStationTypes()
            : kind === "facility"
            ? await getStoredFacilityTypes()
            : kind === "item"
              ? await getStoredItemTypes()
            : kind === "planet"
              ? await getStoredPlanetTypes()
            : kind === "ship"
              ? await getStoredShipTypes()
            : kind === "vehicle"
              ? await getStoredVehicleTypes()
            : kind === "droid"
              ? await getStoredDroidTypes()
            : kind === "creature"
              ? await getStoredCreatureTypes()
            : kind === "npc"
              ? await getStoredNpcTypes()
            : kind === "race"
              ? await getStoredRaces()
            : kind === "weapon"
              ? await getStoredWeaponTypes()
            : kind === "terrain"
              ? await getStoredTerrainTypes()
              : await getStoredMaterialTypes();

        if (cancelled) return;

        const mapped =
          kind === "item"
            ? buildOverlayBrowseItems(
                (response.data ?? []).map((item: any) => summarizeEntity(item, "item")),
                (await getStoredWeaponTypes()).data?.map((weapon: any) => summarizeEntity(weapon, "weapon")) ?? []
              )
            : kind === "weapon"
              ? buildOverlayBrowseItems(
                  (response.data ?? []).map((weapon: any) => summarizeEntity(weapon, "weapon")),
                  (await getStoredItemTypes()).data?.map((item: any) => summarizeEntity(item, "item")) ?? []
                )
              : (response.data ?? []).map((item: any) => {
                  const record = summarizeEntity(item, kind);
                  return {
                    key: record.uid,
                    name: record.name,
                    imageUrl: record.imageUrl ?? null,
                    code: record.code ?? null,
                    className: record.className ?? null,
                    last_pulled_at: record.last_pulled_at,
                    primaryRecord: record,
                    itemRecord: null,
                    weaponRecord: null,
                  } satisfies EntityBrowseItem;
                });
        setItems(mapped);
        setItemClassFilter("all");
        setSelectedId(mapped[0]?.key ?? null);
        setSelectedSourceKind(kind === "item" || kind === "weapon" ? kind : null);
      } catch (e: any) {
        if (!cancelled) {
          setItems([]);
          setSelectedId(null);
          setEditorValue("");
          setError(e?.message ?? "Failed to load entity stats.");
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

  const selectedItem = useMemo(
    () => items.find((item) => item.key === selectedId) ?? null,
    [items, selectedId]
  );

  useEffect(() => {
    if (!selectedItem) {
      setEditorValue("");
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
        const selectedRecord = getBrowseRecordForKind(selectedItem, detailKind);
        const selectedUid = selectedRecord?.uid ?? null;

        if (!selectedUid) {
          setEditorValue("");
          return;
        }

        const response =
          detailKind === "station"
            ? await getStoredStationType(selectedUid)
            : detailKind === "facility"
              ? await getStoredFacilityType(selectedUid)
            : detailKind === "item"
              ? await getStoredItemType(selectedUid)
            : detailKind === "planet"
              ? await getStoredPlanetType(selectedUid)
            : detailKind === "ship"
              ? await getStoredShipType(selectedUid)
            : detailKind === "vehicle"
              ? await getStoredVehicleType(selectedUid)
            : detailKind === "droid"
              ? await getStoredDroidType(selectedUid)
            : detailKind === "creature"
              ? await getStoredCreatureType(selectedUid)
            : detailKind === "npc"
              ? await getStoredNpcType(selectedUid)
            : detailKind === "race"
              ? await getStoredRace(selectedUid)
            : detailKind === "weapon"
              ? await getStoredWeaponType(selectedUid)
            : detailKind === "terrain"
              ? await getStoredTerrainType(selectedUid)
              : await getStoredMaterialType(selectedUid);

        if (cancelled) return;

        setEditorValue(JSON.stringify(response.data ?? {}, null, 2));
      } catch (e: any) {
        if (!cancelled) {
          setEditorValue("");
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

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    let scopedItems = items;

    if (kind === "item" && itemClassFilter !== "all") {
      scopedItems = scopedItems.filter((item) => (item.primaryRecord.className ?? "Unknown").toLowerCase() === itemClassFilter);
    }

    if (!query) {
      return scopedItems;
    }

    return scopedItems.filter((item) =>
      [
        item.name ?? "",
        item.primaryRecord.uid,
        item.itemRecord?.uid ?? "",
        item.weaponRecord?.uid ?? "",
        item.code ?? "",
        item.className ?? "",
      ].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }, [items, search, kind, itemClassFilter]);

  const itemClassOptions = useMemo(() => {
    if (kind !== "item") {
      return [];
    }

    return Array.from(
      new Set(items.map((item) => (item.primaryRecord.className ?? "Unknown").trim() || "Unknown"))
    ).sort((a, b) => a.localeCompare(b));
  }, [items, kind]);

  async function onSave() {
    if (!selectedItem) {
      setError("Select an entity first.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const parsed = JSON.parse(editorValue) as Record<string, unknown>;
      const detailKind =
        kind === "item" || kind === "weapon"
          ? (selectedSourceKind ?? kind)
          : kind;
      const selectedRecord = getBrowseRecordForKind(selectedItem, detailKind);
      const selectedUid = selectedRecord?.uid ?? null;

      if (!selectedUid) {
        throw new Error("No editable source record was found for this entry.");
      }

      const response = await updateAdminEntityStats(detailKind, selectedUid, parsed);

      setMessage(response.message ?? "Entity stats updated.");
      setEditorValue(JSON.stringify(response.data ?? parsed, null, 2));
      setItems((current) =>
        current.map((item) =>
          item.key === selectedItem.key
            ? (() => {
                const refreshedRecord = summarizeEntity(
                  response.data ?? { ...selectedRecord, uid: selectedUid },
                  detailKind
                );

                return {
                  ...item,
                  name: detailKind === item.primaryRecord.sourceKind ? refreshedRecord.name : item.name,
                  imageUrl:
                    detailKind === item.primaryRecord.sourceKind
                      ? refreshedRecord.imageUrl ?? item.imageUrl ?? null
                      : item.imageUrl ?? null,
                  code: detailKind === item.primaryRecord.sourceKind ? refreshedRecord.code ?? item.code ?? null : item.code ?? null,
                  className:
                    detailKind === item.primaryRecord.sourceKind
                      ? refreshedRecord.className ?? item.className ?? null
                      : item.className ?? null,
                  last_pulled_at:
                    detailKind === item.primaryRecord.sourceKind
                      ? refreshedRecord.last_pulled_at
                      : item.last_pulled_at,
                  primaryRecord:
                    item.primaryRecord.sourceKind === detailKind ? refreshedRecord : item.primaryRecord,
                  itemRecord: detailKind === "item" ? refreshedRecord : item.itemRecord,
                  weaponRecord: detailKind === "weapon" ? refreshedRecord : item.weaponRecord,
                };
              })()
            : item
        )
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to save entity stats.");
    } finally {
      setSaving(false);
    }
  }

  async function onPopulateStationIcons() {
    try {
      setIconPopulateLoading(true);
      setError(null);
      setMessage(null);

      const response = await populateAdminStationIcons();
      setMessage(
        `${response.message ?? "Station icons populated."} Updated ${response.data.updated}, skipped ${response.data.skipped}.`
      );

      const refreshed = await getStoredStationTypes();
      const mapped = (refreshed.data ?? []).map((item: any) => {
        const record = summarizeEntity(item, "station");
        return {
          key: record.uid,
          name: record.name,
          imageUrl: record.imageUrl ?? null,
          code: record.code ?? null,
          className: record.className ?? null,
          last_pulled_at: record.last_pulled_at,
          primaryRecord: record,
          itemRecord: null,
          weaponRecord: null,
        } satisfies EntityBrowseItem;
      });
      setItems(mapped);

      if (selectedId) {
        const selected = await getStoredStationType(selectedId);
        setEditorValue(JSON.stringify(selected.data ?? {}, null, 2));
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to populate station icons.");
    } finally {
      setIconPopulateLoading(false);
    }
  }

  async function onPopulateMaterialIcons() {
    try {
      setMaterialIconPopulateLoading(true);
      setError(null);
      setMessage(null);

      const response = await populateAdminMaterialIcons();
      setMessage(
        `${response.message ?? "Material icons populated."} Updated ${response.data.updated}, skipped ${response.data.skipped}.`
      );

      const refreshed = await getStoredMaterialTypes();
      const mapped = (refreshed.data ?? []).map((item: any) => {
        const record = summarizeEntity(item, "material");
        return {
          key: record.uid,
          name: record.name,
          imageUrl: record.imageUrl ?? null,
          code: record.code ?? null,
          className: record.className ?? null,
          last_pulled_at: record.last_pulled_at,
          primaryRecord: record,
          itemRecord: null,
          weaponRecord: null,
        } satisfies EntityBrowseItem;
      });
      setItems(mapped);

      if (selectedId) {
        const selected = await getStoredMaterialType(selectedId);
        setEditorValue(JSON.stringify(selected.data ?? {}, null, 2));
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to populate material icons.");
    } finally {
      setMaterialIconPopulateLoading(false);
    }
  }

  return (
    <section className="panel admin-panel">
      <div className="admin-panel__header">
        <h2>Entity Stats</h2>
        <p className="small">
          Browse and edit stored station, facility, item, ship, vehicle, droid, creature, NPC, race, weapon, terrain, and material catalog records without opening the database directly.
        </p>
      </div>

      <div className="admin-card__actions">
        {kindOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            className={`btn${kind === option.key ? " admin-nav__btn--active" : ""}`}
            onClick={() => setKind(option.key)}
          >
            {option.label}
          </button>
        ))}
        {kind === "station" ? (
          <button
            type="button"
            className="btn"
            onClick={onPopulateStationIcons}
            disabled={iconPopulateLoading}
          >
            {iconPopulateLoading ? "Populating Icons…" : "Populate Station Icons"}
          </button>
        ) : null}
        {kind === "material" ? (
          <button
            type="button"
            className="btn"
            onClick={onPopulateMaterialIcons}
            disabled={materialIconPopulateLoading}
          >
            {materialIconPopulateLoading ? "Populating Icons…" : "Populate Material Icons"}
          </button>
        ) : null}
      </div>

      {error ? <p className="small" style={{ color: "salmon" }}>{error}</p> : null}
      {message ? <p className="small" style={{ color: "#f2c46f" }}>{message}</p> : null}

      <div className="admin-entity-stats">
        <article className="panel admin-card admin-entity-stats__sidebar">
          <div className="admin-card__header">
            <h3 className="admin-card__title">Records</h3>
            <p className="admin-card__desc">
              {loading ? "Loading records…" : `${filteredItems.length} matching records`}
            </p>
          </div>

          <input
            className="admin-entity-stats__search"
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, uid, or code"
          />

          {kind === "item" && itemClassOptions.length > 0 ? (
            <div className="admin-entity-stats__subnav">
              <button
                type="button"
                className={`btn admin-entity-stats__subnav-btn${itemClassFilter === "all" ? " is-active" : ""}`}
                onClick={() => setItemClassFilter("all")}
              >
                All
              </button>
              {itemClassOptions.map((className) => (
                <button
                  key={className}
                  type="button"
                  className={`btn admin-entity-stats__subnav-btn${itemClassFilter === className.toLowerCase() ? " is-active" : ""}`}
                  onClick={() => setItemClassFilter(className.toLowerCase())}
                >
                  {className}
                </button>
              ))}
            </div>
          ) : null}

          <div className="admin-entity-stats__list">
            {filteredItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`admin-entity-stats__item${selectedId === item.key ? " is-active" : ""}`}
                onClick={() => {
                  setSelectedId(item.key);
                  setSelectedSourceKind(item.primaryRecord.sourceKind);
                }}
              >
                <div className="admin-entity-stats__item-top">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name ?? item.primaryRecord.uid}
                      className="admin-entity-stats__item-icon"
                    />
                  ) : (
                    <span className="admin-entity-stats__item-icon admin-entity-stats__item-icon--placeholder">
                      {item.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </span>
                  )}
                  <div className="admin-entity-stats__item-copy">
                    <strong>{item.name ?? item.primaryRecord.uid}</strong>
                    <span className="small">
                      {item.primaryRecord.uid}
                      {item.itemRecord && item.weaponRecord ? ` · ${item.itemRecord.uid} / ${item.weaponRecord.uid}` : ""}
                    </span>
                  </div>
                </div>
                <div className="admin-entity-stats__item-meta">
                  {item.itemRecord && item.weaponRecord ? <span className="small">Item + Weapon</span> : null}
                  {item.className ? <span className="small">{item.className}</span> : null}
                  {item.code ? <span className="small">Code {item.code}</span> : null}
                  {item.last_pulled_at ? <span className="small">Pulled {item.last_pulled_at}</span> : null}
                </div>
              </button>
            ))}
            {!loading && filteredItems.length === 0 ? (
              <span className="small">No matching entity records.</span>
            ) : null}
          </div>
        </article>

        <article className="panel admin-card admin-entity-stats__editor">
          <div className="admin-card__header">
            <h3 className="admin-card__title">Editor</h3>
            <p className="admin-card__desc">
              Edit the stored detail record as JSON. UID and last-pulled are preserved automatically.
            </p>
          </div>

          {selectedItem && (selectedItem.itemRecord || selectedItem.weaponRecord) && (kind === "item" || kind === "weapon") ? (
            <div className="admin-card__actions">
              {selectedItem.itemRecord ? (
                <button
                  type="button"
                  className={`btn${selectedSourceKind === "item" ? " admin-nav__btn--active" : ""}`}
                  onClick={() => setSelectedSourceKind("item")}
                >
                  Item Record
                </button>
              ) : null}
              {selectedItem.weaponRecord ? (
                <button
                  type="button"
                  className={`btn${selectedSourceKind === "weapon" ? " admin-nav__btn--active" : ""}`}
                  onClick={() => setSelectedSourceKind("weapon")}
                >
                  Weapon Record
                </button>
              ) : null}
            </div>
          ) : null}

          <textarea
            className="admin-entity-stats__textarea"
            value={editorValue}
            onChange={(event) => setEditorValue(event.target.value)}
            spellCheck={false}
            placeholder={detailLoading ? "Loading record…" : "{\n  \"name\": \"...\"\n}"}
          />

          <div className="admin-card__actions">
            <button
              type="button"
              className="btn"
              onClick={onSave}
              disabled={saving || detailLoading || !selectedId}
            >
              {saving ? "Saving…" : "Save Entity Stats"}
            </button>
          </div>
        </article>
      </div>
    </section>
  );
};

export default AdminEntityStatsPanel;
