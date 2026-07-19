import React, { useEffect, useMemo, useState } from "react";
import {
  downloadAdminEntityStatsCsv,
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
} from "../../api/universe/universe";
import type { SwcUser } from "../../api/core/auth";
import { BTN } from "../../utils/ui";

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

type ShieldArcEntry = {
  name: string;
  value: string;
  percent: string;
};

const uiButtonSmallBaseClass =
  "inline-flex min-h-[34px] items-center justify-center rounded-[10px] border px-[0.8rem] py-2 text-[0.88rem] font-bold leading-none no-underline transition-[border-color,background,transform,box-shadow] duration-150 ease-out hover:enabled:-translate-y-px hover:enabled:border-[#f5d546]/[0.28] hover:enabled:bg-[#f5d546]/[0.07] disabled:cursor-not-allowed disabled:opacity-[0.55] font-tektur";
const uiButtonSoftClass = "border-white/10 bg-white/[0.025] text-white/90";
const uiButtonPrimaryClass =
  "border-[#f5d546]/35 bg-[#f5d546]/10 text-[#f2c46f] shadow-[inset_0_0_0_1px_rgba(245,213,70,0.08)] hover:enabled:border-[#f5d546]/45 hover:enabled:bg-[#f5d546]/15";

type ShieldArcPreset = {
  key: string;
  label: string;
  arcs: Array<{
    name: string;
    percent: number;
  }>;
};

function normalizeShieldArcPresetSignature(
  arcs: Array<{ name: string; percent: number }>
) {
  return [...arcs]
    .map((arc) => ({
      name: arc.name.trim().toLowerCase(),
      percent: Number(arc.percent.toFixed(2)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((arc) => `${arc.name}:${arc.percent.toFixed(2)}`)
    .join("|");
}

function normalizeShieldArcDraftSignature(rows: ShieldArcEntry[]) {
  return rows
    .map((row) => ({
      name: row.name.trim().toLowerCase(),
      percent:
        row.percent.trim() === "" || Number.isNaN(Number(row.percent))
          ? null
          : Number(Number(row.percent).toFixed(2)),
    }))
    .filter((row) => row.name && row.percent !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((row) => `${row.name}:${row.percent!.toFixed(2)}`)
    .join("|");
}

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

const SHIELD_ARC_NAME_OPTIONS = [
  "Front 120",
  "Front 90",
  "Port 60",
  "Port 90",
  "Starboard 60",
  "Starboard 90",
  "Rear 120",
  "Rear 90",
  "Omni",
  "Front",
  "Frontal",
  "Rear",
  "Port",
  "Starboard",
  "Front 50",
  "Rear 50",
  "Port 50",
  "Starboard 50",
  "Front 60",
  "Rear 60",
  "Port 120",
  "Starboard 120",
];

const SHIELD_ARC_PRESETS: ShieldArcPreset[] = [
  {
    key: "preset-0",
    label: "Preset 0",
    arcs: [{ name: "Omni", percent: 100 }],
  },
  {
    key: "preset-1",
    label: "Preset 1",
    arcs: [
      { name: "Front 90", percent: 25 },
      { name: "Port 90", percent: 25 },
      { name: "Starboard 90", percent: 25 },
      { name: "Rear 90", percent: 25 },
    ],
  },
  {
    key: "preset-2",
    label: "Preset 2",
    arcs: [
      { name: "Front 90", percent: 40 },
      { name: "Port 90", percent: 20 },
      { name: "Starboard 90", percent: 20 },
      { name: "Rear 90", percent: 20 },
    ],
  },
  {
    key: "preset-3",
    label: "Preset 3",
    arcs: [
      { name: "Front 90", percent: 20 },
      { name: "Starboard 90", percent: 20 },
      { name: "Port 90", percent: 20 },
      { name: "Rear 90", percent: 20 },
      { name: "Omni", percent: 20 },
    ],
  },
  {
    key: "preset-4",
    label: "Preset 4",
    arcs: [
      { name: "Front 90", percent: 50 },
      { name: "Rear 90", percent: 50 },
    ],
  },
  {
    key: "preset-5",
    label: "Preset 5",
    arcs: [
      { name: "Front 120", percent: 27 },
      { name: "Port 60", percent: 18 },
      { name: "Starboard 60", percent: 18 },
      { name: "Rear 120", percent: 12 },
      { name: "Omni", percent: 25 },
    ],
  },
  {
    key: "preset-6",
    label: "Preset 6",
    arcs: [
      { name: "Front 60", percent: 15 },
      { name: "Port 120", percent: 24 },
      { name: "Starboard 120", percent: 24 },
      { name: "Rear 60", percent: 12 },
      { name: "Omni", percent: 25 },
    ],
  },
  {
    key: "preset-7",
    label: "Preset 7",
    arcs: [
      { name: "Front 120", percent: 18 },
      { name: "Port 60", percent: 12 },
      { name: "Starboard 60", percent: 12 },
      { name: "Rear 120", percent: 8 },
      { name: "Omni", percent: 50 },
    ],
  },
  {
    key: "preset-8",
    label: "Preset 8",
    arcs: [
      { name: "Front 60", percent: 10 },
      { name: "Port 120", percent: 16 },
      { name: "Starboard 120", percent: 16 },
      { name: "Rear 60", percent: 8 },
      { name: "Omni", percent: 50 },
    ],
  },
];

const AdminEntityStatsPanel: React.FC<{ user: SwcUser | null }> = ({ user }) => {
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
  const [exportingCsv, setExportingCsv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [shieldArcDraftRows, setShieldArcDraftRows] = useState<ShieldArcEntry[]>([]);
  const isSysadmin = !!user?.is_sysadmin;

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

  const parsedEditorDetail = useMemo(() => {
    try {
      return editorValue.trim() ? JSON.parse(editorValue) as Record<string, unknown> : null;
    } catch {
      return null;
    }
  }, [editorValue]);

  const isCapitalShieldArcEditor = useMemo(() => {
    if (!isSysadmin || kind !== "ship" || !parsedEditorDetail) {
      return false;
    }

    const className = String(parsedEditorDetail.class_name ?? "").trim().toLowerCase();
    return className === "capital ships" || className === "super capitals";
  }, [isSysadmin, kind, parsedEditorDetail]);

  const shieldArcRows = useMemo<ShieldArcEntry[]>(() => {
    const arcs = Array.isArray(parsedEditorDetail?.shield_arcs) ? parsedEditorDetail?.shield_arcs : [];

    return arcs.map((arc) => {
      const row = (arc && typeof arc === "object") ? arc as Record<string, unknown> : {};
      return {
        name: String(row.name ?? ""),
        value: row.value == null ? "" : String(row.value),
        percent: row.percent == null ? "" : String(row.percent),
      };
    });
  }, [parsedEditorDetail]);

  useEffect(() => {
    setShieldArcDraftRows(shieldArcRows);
  }, [shieldArcRows]);

  const activeShieldArcPresetKey = useMemo(() => {
    const currentSignature = normalizeShieldArcDraftSignature(shieldArcDraftRows);
    if (!currentSignature) {
      return null;
    }

    const matchingPreset = SHIELD_ARC_PRESETS.find(
      (preset) => normalizeShieldArcPresetSignature(preset.arcs) === currentSignature
    );

    return matchingPreset?.key ?? null;
  }, [shieldArcDraftRows]);

  const totalShieldValue = useMemo(() => {
    const raw = parsedEditorDetail?.shield;
    if (raw == null || raw === "" || Number.isNaN(Number(raw))) {
      return null;
    }

    return Number(raw);
  }, [parsedEditorDetail]);

  function updateEditorShieldArcs(nextRows: ShieldArcEntry[]) {
    setShieldArcDraftRows(nextRows);
    const base = parsedEditorDetail && typeof parsedEditorDetail === "object" ? parsedEditorDetail : {};
    const nextDetail = {
      ...base,
      shield_arcs: nextRows
        .map((row) => ({
          name: row.name.trim() || null,
          value: row.value.trim() === "" || Number.isNaN(Number(row.value)) ? null : Math.round(Number(row.value)),
          percent: row.percent.trim() === "" || Number.isNaN(Number(row.percent)) ? null : Number(Number(row.percent).toFixed(2)),
        }))
        .filter((row) => row.name !== null || row.value !== null || row.percent !== null),
    };

    setEditorValue(JSON.stringify(nextDetail, null, 2));
  }

  function patchShieldArcRow(index: number, patch: Partial<ShieldArcEntry>) {
    const nextRows = shieldArcDraftRows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row);
    updateEditorShieldArcs(nextRows);
  }

  function applyShieldArcPreset(preset: ShieldArcPreset) {
    const nextRows = preset.arcs.map((arc) => ({
      name: arc.name,
      percent: arc.percent.toFixed(2),
      value: totalShieldValue != null
        ? String(Math.round((totalShieldValue * arc.percent) / 100))
        : "",
    }));

    updateEditorShieldArcs(nextRows);
  }

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
      const payload: Record<string, unknown> = { ...parsed };

      if (isCapitalShieldArcEditor) {
        payload.shield_arcs = shieldArcDraftRows
          .map((row) => ({
            name: row.name.trim() || null,
            value: row.value.trim() === "" || Number.isNaN(Number(row.value)) ? null : Math.round(Number(row.value)),
            percent:
              row.percent.trim() === "" || Number.isNaN(Number(row.percent))
                ? null
                : Number(Number(row.percent).toFixed(2)),
          }))
          .filter((row) => row.name !== null || row.value !== null || row.percent !== null);
      }

      const detailKind =
        kind === "item" || kind === "weapon"
          ? (selectedSourceKind ?? kind)
          : kind;
      const selectedRecord = getBrowseRecordForKind(selectedItem, detailKind);
      const selectedUid = selectedRecord?.uid ?? null;

      if (!selectedUid) {
        throw new Error("No editable source record was found for this entry.");
      }

      const response = await updateAdminEntityStats(detailKind, selectedUid, payload);

      setMessage(response.message ?? "Entity stats updated.");
      setEditorValue(JSON.stringify(response.data ?? payload, null, 2));
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

  async function onExportCsv() {
    try {
      setExportingCsv(true);
      setError(null);
      setMessage(null);

      const { blob, filename } = await downloadAdminEntityStatsCsv(kind);
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      setMessage(`${kindOptions.find((option) => option.key === kind)?.label ?? kind} CSV exported.`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to export CSV.");
    } finally {
      setExportingCsv(false);
    }
  }

  return (
    <section className="panel flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <h2 className="h2">Entity Stats</h2>
        <p className="small">
          Browse and edit stored station, facility, item, ship, vehicle, droid, creature, NPC, race, weapon, terrain, and material catalog records without opening the database directly.
        </p>
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap gap-3">
          {kindOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className={BTN + " " + (kind === option.key ? "border-[#f5d546]/45 bg-[#f5d546]/10 shadow-[inset_0_0_0_1px_rgba(245,213,70,0.2)]" : "border-white/10 bg-white/[0.02]")}
              onClick={() => setKind(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          {kind === "station" ? (
            <button
              type="button"
              className={BTN}
              onClick={onPopulateStationIcons}
              disabled={iconPopulateLoading}
            >
              {iconPopulateLoading ? "Populating Icons…" : "Populate Station Icons"}
            </button>
          ) : null}
          {kind === "material" ? (
            <button
              type="button"
              className={BTN}
              onClick={onPopulateMaterialIcons}
              disabled={materialIconPopulateLoading}
            >
              {materialIconPopulateLoading ? "Populating Icons…" : "Populate Material Icons"}
            </button>
          ) : null}
          <button
            type="button"
            className={BTN}
            onClick={onExportCsv}
            disabled={exportingCsv}
          >
            {exportingCsv ? "Exporting CSV…" : "Export CSV"}
          </button>
        </div>
      </div>

      {error ? <p className="small" style={{ color: "salmon" }}>{error}</p> : null}
      {message ? <p className="small" style={{ color: "#f2c46f" }}>{message}</p> : null}

      <div className="grid items-start gap-4 [grid-template-columns:minmax(360px,520px)_minmax(0,1fr)] max-[900px]:grid-cols-1">
        <article className="panel flex flex-col gap-4 flex min-h-[560px] flex-col overflow-hidden max-h-[calc(100vh-11rem)] max-[900px]:max-h-none max-[900px]:overflow-visible">
          <div className="flex flex-col gap-1.5">
            <h3 className="m-0">Records</h3>
            <p className="m-0 opacity-[0.85]">
              {loading ? "Loading records…" : `${filteredItems.length} matching records`}
            </p>
          </div>

          <input
            className="w-full min-h-[42px] rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-inherit font-tektur"
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, uid, or code"
          />

          {kind === "item" && itemClassOptions.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={BTN + " flex flex-wrap gap-2 " + (itemClassFilter === "all" ? "border-[#f5d546]/45 bg-[#f5d546]/10 shadow-[inset_0_0_0_1px_rgba(245,213,70,0.2)]" : "border-white/10 bg-white/[0.02]")}
                onClick={() => setItemClassFilter("all")}
              >
                All
              </button>
              {itemClassOptions.map((className) => (
                <button
                  key={className}
                  type="button"
                  className={BTN + " flex flex-wrap gap-2 " + (itemClassFilter === className.toLowerCase() ? "border-[#f5d546]/45 bg-[#f5d546]/10 shadow-[inset_0_0_0_1px_rgba(245,213,70,0.2)]" : "border-white/10 bg-white/[0.02]")}
                  onClick={() => setItemClassFilter(className.toLowerCase())}
                >
                  {className}
                </button>
              ))}
            </div>
          ) : null}

          <div className="grid min-h-0 flex-1 grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 overflow-auto pr-1">
            {filteredItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`flex min-h-[168px] cursor-pointer flex-col justify-between gap-3 rounded-[14px] border p-3.5 text-left transition-colors  font-tektur${selectedId === item.key ? "border-[#f5d546]/45 bg-[#f5d546]/10 shadow-[inset_0_0_0_1px_rgba(245,213,70,0.2)]" : "border-white/10 bg-white/[0.02] hover:border-[#f5d546]/30 hover:bg-[#f5d546]/[0.04]"}`}
                onClick={() => {
                  setSelectedId(item.key);
                  setSelectedSourceKind(item.primaryRecord.sourceKind);
                }}
              >
                <div className="flex flex-col items-start gap-3">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name ?? item.primaryRecord.uid}
                      className="h-11 w-11 rounded-[10px] border border-white/10 bg-white/[0.04] p-1 object-contain opacity-80"
                    />
                  ) : (
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] border border-white/10 bg-white/[0.04] font-bold text-[#f2c46f]">
                      {item.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-col gap-1">
                    <strong>{item.name ?? item.primaryRecord.uid}</strong>
                    <span className="small">
                      {item.primaryRecord.uid}
                      {item.itemRecord && item.weaponRecord ? ` · ${item.itemRecord.uid} / ${item.weaponRecord.uid}` : ""}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1 opacity-80">
                  {item.itemRecord && item.weaponRecord ? <span className="small">Item + Weapon</span> : null}
                  {item.className ? <span className="small">{item.className}</span> : null}
                  {item.code ? <span className="small">Code {item.code}</span> : null}
                </div>
              </button>
            ))}
            {!loading && filteredItems.length === 0 ? (
              <span className="small">No matching entity records.</span>
            ) : null}
          </div>
        </article>

        <article className="panel flex flex-col gap-4 flex min-h-[560px] flex-col max-[900px]:max-h-none max-[900px]:overflow-visible">
          <div className="flex flex-col gap-1.5">
            <h3 className="m-0">Editor</h3>
            <p className="m-0 opacity-[0.85]">
              Edit the stored detail record as JSON. UID and last-pulled are preserved automatically.
            </p>
          </div>

          {isCapitalShieldArcEditor ? (
            <div className="grid gap-3 rounded-[14px] border border-white/10 bg-white/[0.02] p-3.5">
              <div className="flex flex-col gap-1.5">
                <h4 className="m-0">Shield Arcs</h4>
                <p className="m-0 opacity-[0.85]">
                  Sysadmin-only helper for capital and super-capital deflector segments.
                  {totalShieldValue != null ? ` Total Deflectors: ${totalShieldValue.toLocaleString()}.` : ""}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {SHIELD_ARC_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    className={`font-tektur${uiButtonSmallBaseClass} flex flex-wrap gap-2 ${activeShieldArcPresetKey === preset.key ? uiButtonPrimaryClass : uiButtonSoftClass}`}
                    onClick={() => applyShieldArcPreset(preset)}
                    title={preset.arcs.map((arc) => `${arc.name}: ${arc.percent.toFixed(2)}%`).join("\n")}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="grid gap-2.5">
                {shieldArcDraftRows.map((row, index) => (
                  <div key={`${row.name}-${index}`} className="grid items-center gap-2.5 [grid-template-columns:minmax(0,1.4fr)_minmax(110px,0.7fr)_minmax(110px,0.7fr)_auto] max-[900px]:grid-cols-1">
                    <select
                      className="w-full min-h-[42px] rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-inherit font-tektur"
                      value={row.name}
                      onChange={(event) => patchShieldArcRow(index, { name: event.target.value })}
                    >
                      <option value="">Select arc</option>
                      {SHIELD_ARC_NAME_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <input
                      className="w-full min-h-[42px] rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-inherit font-tektur"
                      type="number"
                      min="0"
                      step="1"
                      value={row.value}
                      onChange={(event) => {
                        const value = event.target.value;
                        const percent = totalShieldValue && value !== "" && !Number.isNaN(Number(value))
                          ? ((Number(value) / totalShieldValue) * 100).toFixed(2)
                          : row.percent;
                        patchShieldArcRow(index, { value, percent });
                      }}
                      placeholder="Value"
                    />
                    <input
                      className="w-full min-h-[42px] rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-inherit font-tektur"
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.percent}
                      onChange={(event) => {
                        const percent = event.target.value;
                        const value = totalShieldValue && percent !== "" && !Number.isNaN(Number(percent))
                          ? String(Math.round((totalShieldValue * Number(percent)) / 100))
                          : row.value;
                        patchShieldArcRow(index, { percent, value });
                      }}
                      placeholder="%"
                    />
                    <button
                      type="button"
                      className={BTN + " min-h-[42px]"}
                      onClick={() => updateEditorShieldArcs(shieldArcDraftRows.filter((_, rowIndex) => rowIndex !== index))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={BTN}
                  onClick={() => {
                    const nextRows = [...shieldArcDraftRows, { name: "", value: "", percent: "" }];
                    setShieldArcDraftRows(nextRows);
                  }}
                >
                  Add Shield Arc
                </button>
                <button
                  type="button"
                  className={BTN}
                  onClick={onSave}
                  disabled={saving || detailLoading || !selectedId}
                >
                  {saving ? "Saving Shield Arcs…" : "Save Shield Arcs"}
                </button>
              </div>
            </div>
          ) : null}

          {selectedItem && (selectedItem.itemRecord || selectedItem.weaponRecord) && (kind === "item" || kind === "weapon") ? (
            <div className="flex flex-wrap gap-3">
              {selectedItem.itemRecord ? (
                <button
                  type="button"
                  className={BTN + " " + (selectedSourceKind === "item" ? "border-[#f5d546]/45 bg-[#f5d546]/10 shadow-[inset_0_0_0_1px_rgba(245,213,70,0.2)]" : "border-white/10 bg-white/[0.02]")}
                  onClick={() => setSelectedSourceKind("item")}
                >
                  Item Record
                </button>
              ) : null}
              {selectedItem.weaponRecord ? (
                <button
                  type="button"
                  className={BTN + " " + (selectedSourceKind === "weapon" ? "border-[#f5d546]/45 bg-[#f5d546]/10 shadow-[inset_0_0_0_1px_rgba(245,213,70,0.2)]" : "border-white/10 bg-white/[0.02]")}
                  onClick={() => setSelectedSourceKind("weapon")}
                >
                  Weapon Record
                </button>
              ) : null}
            </div>
          ) : null}

          <textarea
            className="min-h-[360px] w-full resize-y rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-[0.92rem] leading-relaxed text-inherit font-tektur"
            value={editorValue}
            onChange={(event) => setEditorValue(event.target.value)}
            spellCheck={false}
            placeholder={detailLoading ? "Loading record…" : "{\n  \"name\": \"...\"\n}"}
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={BTN}
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
