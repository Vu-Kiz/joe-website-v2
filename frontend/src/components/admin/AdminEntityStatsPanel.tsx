import React, { useEffect, useMemo, useState } from "react";
import {
  getStoredFacilityType,
  getStoredFacilityTypes,
  getStoredItemType,
  getStoredItemTypes,
  getStoredMaterialType,
  getStoredMaterialTypes,
  getStoredShipType,
  getStoredShipTypes,
  getStoredStationType,
  getStoredStationTypes,
  getStoredTerrainType,
  getStoredTerrainTypes,
  populateAdminMaterialIcons,
  populateAdminStationIcons,
  type EntityStatsKind,
  updateAdminEntityStats,
} from "../../api/universe";

type EntitySummary = {
  uid: string;
  name: string | null;
  code?: string | null;
  classUid?: string | null;
  className?: string | null;
  imageUrl?: string | null;
  last_pulled_at: string | null;
};

const kindOptions: Array<{ key: EntityStatsKind; label: string }> = [
  { key: "station", label: "Station Types" },
  { key: "facility", label: "Facility Types" },
  { key: "item", label: "Item Types" },
  { key: "ship", label: "Ship Types" },
  { key: "terrain", label: "Terrain Types" },
  { key: "material", label: "Material Types" },
];

function summarizeEntity(item: any): EntitySummary {
  return {
    uid: String(item.uid ?? ""),
    name: item.name ?? null,
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

const AdminEntityStatsPanel: React.FC = () => {
  const [kind, setKind] = useState<EntityStatsKind>("station");
  const [items, setItems] = useState<EntitySummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
            : kind === "ship"
              ? await getStoredShipTypes()
            : kind === "terrain"
              ? await getStoredTerrainTypes()
              : await getStoredMaterialTypes();

        if (cancelled) return;

        const mapped = (response.data ?? []).map(summarizeEntity);
        setItems(mapped);
        setItemClassFilter("all");
        setSelectedId(mapped[0]?.uid ?? null);
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

  useEffect(() => {
    if (!selectedId) {
      setEditorValue("");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setDetailLoading(true);
        setError(null);

        const response =
          kind === "station"
            ? await getStoredStationType(selectedId)
            : kind === "facility"
              ? await getStoredFacilityType(selectedId)
            : kind === "item"
              ? await getStoredItemType(selectedId)
            : kind === "ship"
              ? await getStoredShipType(selectedId)
            : kind === "terrain"
              ? await getStoredTerrainType(selectedId)
              : await getStoredMaterialType(selectedId);

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
      scopedItems = scopedItems.filter((item) => (item.className ?? "Unknown").toLowerCase() === itemClassFilter);
    }

    if (!query) {
      return scopedItems;
    }

    return scopedItems.filter((item) =>
      [item.name ?? "", item.uid, item.code ?? "", item.className ?? ""].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }, [items, search, kind, itemClassFilter]);

  const itemClassOptions = useMemo(() => {
    if (kind !== "item") {
      return [];
    }

    return Array.from(
      new Set(items.map((item) => (item.className ?? "Unknown").trim() || "Unknown"))
    ).sort((a, b) => a.localeCompare(b));
  }, [items, kind]);

  async function onSave() {
    if (!selectedId) {
      setError("Select an entity first.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setMessage(null);

      const parsed = JSON.parse(editorValue) as Record<string, unknown>;
      const response = await updateAdminEntityStats(kind, selectedId, parsed);

      setMessage(response.message ?? "Entity stats updated.");
      setEditorValue(JSON.stringify(response.data ?? parsed, null, 2));
      setItems((current) =>
        current.map((item) =>
          item.uid === selectedId
            ? summarizeEntity(response.data ?? { ...item, uid: selectedId })
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
      const mapped = (refreshed.data ?? []).map(summarizeEntity);
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
      const mapped = (refreshed.data ?? []).map(summarizeEntity);
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
          Browse and edit stored station, facility, item, ship, terrain, and material type records without opening the database directly.
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
                key={item.uid}
                type="button"
                className={`admin-entity-stats__item${selectedId === item.uid ? " is-active" : ""}`}
                onClick={() => setSelectedId(item.uid)}
              >
                <div className="admin-entity-stats__item-top">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name ?? item.uid}
                      className="admin-entity-stats__item-icon"
                    />
                  ) : (
                    <span className="admin-entity-stats__item-icon admin-entity-stats__item-icon--placeholder">
                      {item.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </span>
                  )}
                  <div className="admin-entity-stats__item-copy">
                    <strong>{item.name ?? item.uid}</strong>
                    <span className="small">{item.uid}</span>
                  </div>
                </div>
                <div className="admin-entity-stats__item-meta">
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
