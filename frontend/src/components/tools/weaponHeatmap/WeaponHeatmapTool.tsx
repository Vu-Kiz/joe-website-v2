import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  getStoredItemType,
  getStoredItemTypes,
  getStoredShipType,
  getStoredShipTypes,
  getStoredVehicleType,
  getStoredVehicleTypes,
  getStoredWeaponType,
  type StoredItemTypeDetail,
  type StoredShipTypeDetail,
  type StoredVehicleTypeDetail,
  type StoredWeaponTypeDetail,
} from "../../../api/universe";
import SearchSuggestionPicker from "../../common/SearchSuggestionPicker";
import HamburgerToggle from "../../common/HamburgerToggle";
import DirectionalCompass from "../../common/DirectionalCompass";
import isdDirectionImage from "../../../assets/swc/isd.png";
import {
  bearingFromPoint,
  buildHeatCells,
  clampPointToBoard,
  defaultOriginForBoard,
  formatNumber,
  getBoardDimensions,
  heatColor,
  isBearingWithinArc,
  normalizeDegrees,
  resolveWeaponArcWindow,
  type GridPoint,
  type HeatCell,
  type HeatmapBoardMode,
  isHeatmapEligibleWeapon,
} from "./weaponHeatmapMath";

type HeatmapSelectionMode = "none" | "origin" | "target";
type HeatmapPlatformMode = "ship" | "vehicle" | "item";
type HeatmapPlatformSummary = {
  uid: string;
  name: string | null;
  class_name: string | null;
  platform_kind: HeatmapPlatformMode;
};
type HeatmapPlatformDetail = {
  uid: string;
  name: string | null;
  class_name: string | null;
  platform_kind: HeatmapPlatformMode;
  weapons?: Array<Record<string, unknown>> | null;
  matching_weapon?: StoredWeaponTypeDetail | null;
};
type ResolvedMountedWeapon = {
  key: string;
  uid: string | null;
  name: string | null;
  className: string | null;
  quantity: number;
  arc: string | null;
  arcFrom: number | null;
  arcTo: number | null;
  weapon: StoredWeaponTypeDetail;
};
type WeaponHeatmapViewMode = "single" | "combined";
const HEATMAP_TOOLTIP_WIDTH_ESTIMATE = 180;
const HEATMAP_TOOLTIP_HEIGHT_ESTIMATE = 132;
const HEATMAP_TOOLTIP_MARGIN = 12;

function buildLinkedWeaponKey(item: Record<string, unknown>) {
  const arcFromValue = item.arcFrom ?? item.arc_from;
  const arcToValue = item.arcTo ?? item.arc_to;

  return [
    typeof item.uid === "string" ? item.uid : "",
    typeof item.name === "string" ? item.name : "",
    item.quantity == null ? "" : String(item.quantity),
    typeof item.arc === "string" ? item.arc : "",
    arcFromValue == null ? "" : String(arcFromValue),
    arcToValue == null ? "" : String(arcToValue),
  ].join("|");
}

function resolveLinkedWeaponIdentifier(item: Record<string, unknown>) {
  if (typeof item.uid === "string" && item.uid) {
    return item.uid;
  }

  if (typeof item.name === "string" && item.name) {
    return item.name;
  }

  return null;
}

function resolveLinkedWeaponQuantity(item: Record<string, unknown>) {
  const quantity = Number(item.quantity ?? 1);
  if (Number.isNaN(quantity) || quantity <= 0) {
    return 1;
  }
  return quantity;
}

function applyDirectionalFilter(
  cells: HeatCell[],
  weapon: ResolvedMountedWeapon | null,
  usesDirectionalArcs: boolean,
  headingDegrees: number,
  origin: GridPoint,
) {
  if (!weapon || !usesDirectionalArcs) {
    return cells;
  }

  const selectedArcWindow = resolveWeaponArcWindow(weapon.arc ?? null, weapon.arcFrom ?? null, weapon.arcTo ?? null);

  return cells.map((cell) => {
    if (cell.x === origin.x && cell.y === origin.y) {
      return cell;
    }

    const relativeBearing = normalizeDegrees(cell.bearing - headingDegrees);
    if (isBearingWithinArc(relativeBearing, selectedArcWindow)) {
      return cell;
    }

    return {
      ...cell,
      hitChance: 0,
      averageRoundsToHit: null,
      likelyRoundsToHit: null,
    };
  });
}

type WeaponHeatmapToolProps = {
  title?: string;
  subtitle?: React.ReactNode;
};

const SectionToggle: React.FC<{
  title: string;
  open: boolean;
  onClick: () => void;
}> = ({ title, open, onClick }) => (
  <button
    type="button"
    className="weapon-heatmap-page__side-toggle"
    onClick={onClick}
    aria-expanded={open}
    aria-label={`${open ? "Collapse" : "Expand"} ${title}`}
  >
    <strong>{title}</strong>
    <HamburgerToggle open={open} ariaLabel={`${open ? "Collapse" : "Expand"} ${title}`} decorative />
  </button>
);

const WeaponHeatmapTool: React.FC<WeaponHeatmapToolProps> = ({
  title = "Targeting Heatmap",
  subtitle,
}) => {
  const [platformMode, setPlatformMode] = useState<HeatmapPlatformMode>("ship");
  const [platforms, setPlatforms] = useState<HeatmapPlatformSummary[]>([]);
  const [platformsLoading, setPlatformsLoading] = useState(true);
  const [platformsError, setPlatformsError] = useState<string | null>(null);
  const [selectedPlatformUid, setSelectedPlatformUid] = useState<string | null>(null);
  const [selectedPlatformDetail, setSelectedPlatformDetail] = useState<HeatmapPlatformDetail | null>(null);
  const [resolvedWeapons, setResolvedWeapons] = useState<ResolvedMountedWeapon[]>([]);
  const [resolvedWeaponsLoading, setResolvedWeaponsLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [atmoBoardSize, setAtmoBoardSize] = useState(20);
  const [selectedWeaponKey, setSelectedWeaponKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<WeaponHeatmapViewMode>("single");
  const [enabledWeaponKeys, setEnabledWeaponKeys] = useState<string[]>([]);
  const [boardMode, setBoardMode] = useState<HeatmapBoardMode>("space");
  const [headingDegrees, setHeadingDegrees] = useState(0);
  const [sideSectionsOpen, setSideSectionsOpen] = useState({
    summary: false,
    stats: false,
    legend: false,
  });
  const [leftSectionsOpen, setLeftSectionsOpen] = useState({
    platform: true,
    heading: false,
    weapons: false,
  });
  const [hoveredPopup, setHoveredPopup] = useState<{
    cell: HeatCell;
    left: number;
    top: number;
    transform: string;
  } | null>(null);
  const [selectedOrigin, setSelectedOrigin] = useState<GridPoint | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<GridPoint | null>(null);
  const [selectionMode, setSelectionMode] = useState<HeatmapSelectionMode>("none");
  const gridRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setPlatformsLoading(true);
        const response = platformMode === "ship"
          ? await getStoredShipTypes()
          : platformMode === "vehicle"
            ? await getStoredVehicleTypes()
            : await getStoredItemTypes();

        if (cancelled) return;

        const nextPlatforms: HeatmapPlatformSummary[] = Array.isArray(response.data)
          ? platformMode === "ship"
            ? response.data.map((platform) => ({
                uid: platform.uid,
                name: platform.name,
                class_name: platform.class_name,
                platform_kind: "ship" as const,
              }))
            : platformMode === "vehicle"
              ? response.data.map((platform) => ({
                  uid: platform.uid,
                  name: platform.name,
                  class_name: platform.class_name,
                  platform_kind: "vehicle" as const,
                }))
              : response.data.map((platform) => ({
                  uid: platform.uid,
                  name: platform.name,
                  class_name: platform.class_name,
                  platform_kind: "item" as const,
                }))
          : [];
        setPlatforms(nextPlatforms);
        setPlatformsError(null);
        setSelectedPlatformUid((current) =>
          current && nextPlatforms.some((platform) => platform.uid === current) ? current : null
        );
      } catch (error: any) {
        if (!cancelled) {
          setPlatforms([]);
          setPlatformsError(error?.message ?? `Failed to load stored ${platformMode} types.`);
        }
      } finally {
        if (!cancelled) {
          setPlatformsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [platformMode]);

  const filteredPlatforms = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return [];
    }

    return platforms.filter((platform) =>
      [platform.name ?? "", platform.class_name ?? "", platform.uid ?? ""].some((value) =>
        value.toLowerCase().includes(normalized)
      )
    ).slice(0, 8);
  }, [platforms, query]);

  useEffect(() => {
    if (!selectedPlatformUid) {
      setSelectedPlatformDetail(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const response = platformMode === "ship"
          ? await getStoredShipType(selectedPlatformUid)
          : platformMode === "vehicle"
            ? await getStoredVehicleType(selectedPlatformUid)
            : await getStoredItemType(selectedPlatformUid);
        if (cancelled) return;
        if (!response.data) {
          setSelectedPlatformDetail(null);
        } else if (platformMode === "ship") {
          const detail = response.data as StoredShipTypeDetail;
          setSelectedPlatformDetail({
            uid: detail.uid,
            name: detail.name,
            class_name: detail.class_name,
            weapons: detail.weapons,
            platform_kind: "ship",
          });
        } else if (platformMode === "vehicle") {
          const detail = response.data as StoredVehicleTypeDetail;
          setSelectedPlatformDetail({
            uid: detail.uid,
            name: detail.name,
            class_name: detail.class_name,
            weapons: detail.weapons,
            platform_kind: "vehicle",
          });
        } else {
          const detail = response.data as StoredItemTypeDetail;
          setSelectedPlatformDetail({
            uid: detail.uid,
            name: detail.name,
            class_name: detail.class_name,
            matching_weapon: detail.matching_weapon ?? null,
            platform_kind: "item",
          });
        }
      } catch {
        if (!cancelled) {
          setSelectedPlatformDetail(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPlatformUid, platformMode]);

  useEffect(() => {
    const linkedWeapons = selectedPlatformDetail && "weapons" in selectedPlatformDetail && Array.isArray(selectedPlatformDetail.weapons)
      ? selectedPlatformDetail.weapons.filter((item: unknown): item is Record<string, unknown> => !!item && typeof item === "object")
      : [];

    const matchingItemWeapon = selectedPlatformDetail?.platform_kind === "item" && selectedPlatformDetail.matching_weapon
      ? [{
          uid: selectedPlatformDetail.matching_weapon.uid,
          name: selectedPlatformDetail.matching_weapon.name,
          quantity: 1,
          arc: null,
          arcFrom: null,
          arcTo: null,
        } satisfies Record<string, unknown>]
      : [];

    const sourceWeapons = matchingItemWeapon.length ? matchingItemWeapon : linkedWeapons;

    if (!sourceWeapons.length) {
      setResolvedWeapons([]);
      setResolvedWeaponsLoading(false);
      setSelectedWeaponKey(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setResolvedWeaponsLoading(true);
        const nextWeapons: Array<ResolvedMountedWeapon | null> = await Promise.all(
          sourceWeapons.map(async (item) => {
            const itemRecord = item as Record<string, unknown>;
            const identifier = resolveLinkedWeaponIdentifier(item);
            if (!identifier) {
              return null;
            }

            const response = await getStoredWeaponType(identifier);
            const weapon = response.data ?? null;
            if (!weapon || !isHeatmapEligibleWeapon(weapon)) {
              return null;
            }

            const rawArcFrom = itemRecord.arcFrom ?? itemRecord["arc_from"];
            const rawArcTo = itemRecord.arcTo ?? itemRecord["arc_to"];

            return {
              key: buildLinkedWeaponKey(item),
              uid: typeof item.uid === "string" ? item.uid : (weapon.uid ?? null),
              name: typeof item.name === "string" ? item.name : weapon.name ?? null,
              className: weapon.class_name ?? null,
              quantity: resolveLinkedWeaponQuantity(item),
              arc: typeof item.arc === "string" ? item.arc : null,
              arcFrom: typeof rawArcFrom === "number" ? rawArcFrom : (Number.isNaN(Number(rawArcFrom)) ? null : Number(rawArcFrom)),
              arcTo: typeof rawArcTo === "number" ? rawArcTo : (Number.isNaN(Number(rawArcTo)) ? null : Number(rawArcTo)),
              weapon,
            } satisfies ResolvedMountedWeapon;
          })
        );

        if (cancelled) return;

        const nextResolved = nextWeapons.filter((item): item is ResolvedMountedWeapon => !!item);
        setResolvedWeapons(nextResolved);
        setEnabledWeaponKeys(nextResolved.map((weapon) => weapon.key));
        setSelectedWeaponKey((current) => current && nextResolved.some((weapon) => weapon.key === current)
          ? current
          : nextResolved[0]?.key ?? null);
      } finally {
        if (!cancelled) {
          setResolvedWeaponsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedPlatformDetail]);

  const selectedWeapon = useMemo(
    () => resolvedWeapons.find((weapon) => weapon.key === selectedWeaponKey) ?? null,
    [resolvedWeapons, selectedWeaponKey]
  );
  const enabledWeapons = useMemo(
    () => resolvedWeapons.filter((weapon) => enabledWeaponKeys.includes(weapon.key)),
    [enabledWeaponKeys, resolvedWeapons]
  );
  const selectedMaxHits = useMemo(() => {
    if (!selectedWeapon || selectedWeapon.weapon.max_hits == null || Number.isNaN(Number(selectedWeapon.weapon.max_hits))) {
      return 1;
    }

    return Math.max(1, Number(selectedWeapon.weapon.max_hits)) * Math.max(1, selectedWeapon.quantity);
  }, [selectedWeapon]);
  const selectedMaxRange = useMemo(() => {
    if (!selectedWeapon) {
      return 0;
    }

    return Math.max(
      Number(selectedWeapon.weapon.optimum_range ?? 0),
      Number(selectedWeapon.weapon.optimum_range ?? 0) + Number(selectedWeapon.weapon.drop_off ?? 0)
    );
  }, [selectedWeapon]);
  const combinedMaxRange = useMemo(() => {
    if (!enabledWeapons.length) {
      return 0;
    }

    return enabledWeapons.reduce((maxRange, weapon) => {
      const optimumRange = Number(weapon.weapon.optimum_range ?? 0);
      const dropOff = Number(weapon.weapon.drop_off ?? 0);
      return Math.max(maxRange, optimumRange, optimumRange + dropOff);
    }, 0);
  }, [enabledWeapons]);
  const activeMaxRange = viewMode === "combined" ? combinedMaxRange : selectedMaxRange;
  const defaultOrigin = useMemo(
    () => defaultOriginForBoard(activeMaxRange, boardMode, atmoBoardSize),
    [activeMaxRange, boardMode, atmoBoardSize]
  );

  useEffect(() => {
    setSelectedOrigin((current) => clampPointToBoard(current, activeMaxRange, boardMode, atmoBoardSize));
    setSelectedTarget((current) => clampPointToBoard(current, activeMaxRange, boardMode, atmoBoardSize));
    setHoveredPopup(null);
  }, [defaultOrigin.x, defaultOrigin.y, activeMaxRange, boardMode, atmoBoardSize]);

  const hasDirectionalWeaponArcs = useMemo(
    () =>
      resolvedWeapons.some((weapon) => {
        const arcWindow = resolveWeaponArcWindow(weapon.arc ?? null, weapon.arcFrom ?? null, weapon.arcTo ?? null);
        if (!arcWindow) {
          return false;
        }

        return !(arcWindow.start === 0 && arcWindow.end === 360);
      }),
    [resolvedWeapons]
  );

  const usesDirectionalArcs = useMemo(() => {
    const normalizedClass = String(selectedPlatformDetail?.class_name ?? "").trim().toLowerCase();
    const supportsHeading = normalizedClass === "capital ships" || normalizedClass === "super capitals";
    return supportsHeading && hasDirectionalWeaponArcs;
  }, [hasDirectionalWeaponArcs, selectedPlatformDetail]);
  const activeOrigin = selectedOrigin ?? defaultOrigin;
  const activeTarget = selectedTarget ?? defaultOrigin;
  const selectedWeaponHeatCells = useMemo(() => {
    const cells = buildHeatCells(selectedWeapon?.weapon ?? null, boardMode, selectedOrigin, atmoBoardSize);
    return applyDirectionalFilter(cells, selectedWeapon, usesDirectionalArcs, headingDegrees, activeOrigin);
  }, [activeOrigin, boardMode, headingDegrees, selectedOrigin, selectedWeapon, usesDirectionalArcs, atmoBoardSize]);
  const combinedHeatCells = useMemo(() => {
    if (!enabledWeapons.length) {
      return [];
    }

    const perWeaponCells = enabledWeapons.map((weapon) => ({
      weapon,
      cells: applyDirectionalFilter(
        buildHeatCells(weapon.weapon, boardMode, selectedOrigin, atmoBoardSize),
        weapon,
        usesDirectionalArcs,
        headingDegrees,
        activeOrigin,
      ),
    }));

    const totalWeaponCount = enabledWeapons.reduce((sum, weapon) => sum + Math.max(1, weapon.quantity), 0);
    if (!perWeaponCells.length || totalWeaponCount <= 0) {
      return [];
    }

    return perWeaponCells[0].cells.map((baseCell, index) => {
      const weightedHitChance = perWeaponCells.reduce((sum, entry) => {
        const cell = entry.cells[index];
        return sum + ((cell?.hitChance ?? 0) * Math.max(1, entry.weapon.quantity));
      }, 0);

      return {
        ...baseCell,
        hitChance: weightedHitChance / totalWeaponCount,
        averageRoundsToHit: null,
        likelyRoundsToHit: null,
      };
    });
  }, [activeOrigin, boardMode, enabledWeapons, headingDegrees, selectedOrigin, usesDirectionalArcs, atmoBoardSize]);
  const activeHeatCells = viewMode === "combined" ? combinedHeatCells : selectedWeaponHeatCells;
  const fallbackZeroCells = useMemo(() => {
    const { width, height } = getBoardDimensions(0, boardMode, atmoBoardSize);
    const columns = width;
    const rows = height;
    const origin = clampPointToBoard(selectedOrigin, 0, boardMode, atmoBoardSize);
    const cells: HeatCell[] = [];

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        cells.push({
          x,
          y,
          distance: Math.ceil(Math.sqrt(((x - origin.x) ** 2) + ((y - origin.y) ** 2))),
          bearing: bearingFromPoint(origin.x, origin.y, x, y),
          hitChance: 0,
          averageRoundsToHit: null,
          likelyRoundsToHit: null,
        });
      }
    }

    return cells;
  }, [boardMode, selectedOrigin, atmoBoardSize]);
  const displayHeatCells = activeHeatCells.length ? activeHeatCells : fallbackZeroCells;
  const gridColumns = useMemo(() => {
    const dimensions = getBoardDimensions(activeMaxRange, boardMode, atmoBoardSize);
    if (dimensions.width > 0) {
      return dimensions.width;
    }

    return Math.sqrt(displayHeatCells.length);
  }, [activeMaxRange, boardMode, displayHeatCells.length, atmoBoardSize]);
  const combinedWeaponCount = useMemo(
    () => enabledWeapons.reduce((sum, weapon) => sum + Math.max(1, weapon.quantity), 0),
    [enabledWeapons]
  );

  const toggleSideSection = (key: "summary" | "stats" | "legend") => {
    setSideSectionsOpen((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };
  const toggleLeftSection = (key: "platform" | "weapons" | "heading") => {
    setLeftSectionsOpen((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <div className="weapon-heatmap-page__tool">
      <div className="weapon-heatmap-page__header">
        <div>
          <h1>{title}</h1>
          {subtitle ? <p className="small">{subtitle}</p> : null}
        </div>
      </div>

      <div className="weapon-heatmap-page__layout">
        <section className="panel weapon-heatmap-page__sidebar">
          <div className="weapon-heatmap-page__side-section">
            <SectionToggle title="Platform" open={leftSectionsOpen.platform} onClick={() => toggleLeftSection("platform")} />
            {leftSectionsOpen.platform ? (
              <>
                <div className="weapon-heatmap-page__mode-picker">
                  <div className="members-combat-calc__section-pills">
                    <button type="button" className={`ui-btn ui-btn--small${platformMode === "ship" ? " ui-btn--primary" : " ui-btn--soft"}`} onClick={() => setPlatformMode("ship")}>
                      Ships
                    </button>
                    <button type="button" className={`ui-btn ui-btn--small${platformMode === "vehicle" ? " ui-btn--primary" : " ui-btn--soft"}`} onClick={() => setPlatformMode("vehicle")}>
                      Vehicles
                    </button>
                    <button type="button" className={`ui-btn ui-btn--small${platformMode === "item" ? " ui-btn--primary" : " ui-btn--soft"}`} onClick={() => setPlatformMode("item")}>
                      Items
                    </button>
                  </div>
                </div>

                <label className="small" htmlFor="weapon-heatmap-query">
                  Search
                </label>
                <SearchSuggestionPicker
                  id="weapon-heatmap-query"
                  value={query}
                  onChange={setQuery}
                  placeholder={`Search ${platformMode}s by name, class, or UID`}
                  suggestions={filteredPlatforms}
                  showSuggestions={query.trim().length > 0}
                  onShowSuggestions={() => {}}
                  getKey={(platform) => platform.uid ?? platform.name ?? "platform"}
                  isActive={(platform) => platform.uid === selectedPlatformUid}
                  onSelect={(platform) => {
                    setSelectedPlatformUid(platform.uid);
                    setQuery("");
                  }}
                  renderSuggestion={(platform) => (
                    <>
                      <strong>{platform.name ?? platform.uid}</strong>
                      <span className="small">
                        {platform.class_name ?? "Unknown class"}
                        {platform.uid ? ` · ${platform.uid}` : ""}
                      </span>
                    </>
                  )}
                />

                {selectedPlatformDetail ? (
                  <div className="weapon-heatmap-page__selected-platform">
                    <strong>{selectedPlatformDetail.name ?? selectedPlatformDetail.uid}</strong>
                    <span className="small">{selectedPlatformDetail.class_name ?? "Unknown class"}</span>
                    <button
                      type="button"
                      className="ui-btn ui-btn--small ui-btn--soft"
                      onClick={() => {
                        setSelectedPlatformUid(null);
                        setSelectedWeaponKey(null);
                        setQuery("");
                      }}
                    >
                      Clear Selection
                    </button>
                  </div>
                ) : (
                  <p className="small">Select a platform to load its linked weapons and targeting view.</p>
                )}
              </>
            ) : null}
          </div>

          {usesDirectionalArcs ? (
            <div className="weapon-heatmap-page__side-section">
              <SectionToggle title="Heading" open={leftSectionsOpen.heading} onClick={() => toggleLeftSection("heading")} />
              {leftSectionsOpen.heading ? (
                <div className="weapon-heatmap-page__mode-picker">
                  <div className="weapon-heatmap-page__heading-control">
                    <DirectionalCompass
                      headingDegrees={headingDegrees}
                      imageSrc={isdDirectionImage}
                      bearingLabel="Current Bearing"
                    />
                    <div className="members-combat-calc__section-pills">
                      <button type="button" className="ui-btn ui-btn--small ui-btn--soft" onClick={() => setHeadingDegrees((current) => normalizeDegrees(current - 15))}>
                        -15°
                      </button>
                      <button type="button" className="ui-btn ui-btn--small ui-btn--soft" onClick={() => setHeadingDegrees((current) => normalizeDegrees(current + 15))}>
                        +15°
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="weapon-heatmap-page__side-section">
            <SectionToggle title="Weapons" open={leftSectionsOpen.weapons} onClick={() => toggleLeftSection("weapons")} />
            {leftSectionsOpen.weapons ? (
              <div className="weapon-heatmap-page__mode-picker">
                <div className="members-combat-calc__section-pills">
                  <button type="button" className={`ui-btn ui-btn--small${viewMode === "single" ? " ui-btn--primary" : " ui-btn--soft"}`} onClick={() => setViewMode("single")}>
                    Single
                  </button>
                  <button type="button" className={`ui-btn ui-btn--small${viewMode === "combined" ? " ui-btn--primary" : " ui-btn--soft"}`} onClick={() => setViewMode("combined")}>
                    Combined
                  </button>
                </div>
                {viewMode === "combined" && resolvedWeapons.length ? (
                  <div className="weapon-heatmap-page__bulk-actions-wrap">
                    <span className="small">Select</span>
                    <div className="weapon-heatmap-page__bulk-actions">
                      <button
                        type="button"
                        className="ui-btn ui-btn--small ui-btn--soft"
                        onClick={() => setEnabledWeaponKeys(resolvedWeapons.map((weapon) => weapon.key))}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        className="ui-btn ui-btn--small ui-btn--soft"
                        onClick={() => setEnabledWeaponKeys([])}
                      >
                        None
                      </button>
                    </div>
                  </div>
                ) : null}
                {resolvedWeaponsLoading ? <p className="small">Loading linked weapons…</p> : null}
                {!resolvedWeaponsLoading && resolvedWeapons.length ? (
                  <div className="weapon-heatmap-page__weapon-list">
                    {resolvedWeapons.map((weapon) => (
                      <div key={weapon.key} className={`weapon-heatmap-page__weapon-option${weapon.key === selectedWeaponKey ? " is-active" : ""}`}>
                        <button
                          type="button"
                          className="weapon-heatmap-page__weapon-option-main"
                          onClick={() => setSelectedWeaponKey(weapon.key)}
                        >
                          <strong>{weapon.name ?? weapon.uid ?? "Unknown weapon"}</strong>
                          <span className="small">
                            {weapon.className ?? "Unknown class"}
                            {weapon.quantity > 1 ? ` · x${weapon.quantity}` : ""}
                            {weapon.arc ? ` · ${weapon.arc}` : ""}
                          </span>
                        </button>
                        {viewMode === "combined" ? (
                          <button
                            type="button"
                            className={`ui-btn ui-btn--small${enabledWeaponKeys.includes(weapon.key) ? " ui-btn--primary" : " ui-btn--soft"}`}
                            onClick={() => {
                              setEnabledWeaponKeys((current) => current.includes(weapon.key)
                                ? current.filter((key) => key !== weapon.key)
                                : [...current, weapon.key]
                              );
                            }}
                          >
                            {enabledWeaponKeys.includes(weapon.key) ? "On" : "Off"}
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
                {!resolvedWeaponsLoading && selectedPlatformDetail && !resolvedWeapons.length ? (
                  <p className="small">
                    {platformMode === "item"
                      ? "No matching weapon record found for this item."
                      : `No supported linked weapons found for this ${platformMode}.`}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {platformsLoading ? <p className="small">Loading stored {platformMode}s…</p> : null}
          {platformsError ? <p className="small">{platformsError}</p> : null}

          {query.trim() && !filteredPlatforms.length ? (
            <p className="small">No matching {platformMode}s found.</p>
          ) : null}
        </section>

        <section className="panel weapon-heatmap-page__main">
          <div className="weapon-heatmap-page__viz">
            <div className="weapon-heatmap-page__board-controls">
              <div className="members-combat-calc__section-pills">
                <button type="button" className={`ui-btn ui-btn--small${boardMode === "space" ? " ui-btn--primary" : " ui-btn--soft"}`} onClick={() => setBoardMode("space")}>
                  Space 20x20
                </button>
                <button type="button" className={`ui-btn ui-btn--small${boardMode === "atmo" ? " ui-btn--primary" : " ui-btn--soft"}`} onClick={() => setBoardMode("atmo")}>
                  Atmo {atmoBoardSize}x{atmoBoardSize}
                </button>
                <button type="button" className={`ui-btn ui-btn--small${boardMode === "ground" ? " ui-btn--primary" : " ui-btn--soft"}`} onClick={() => setBoardMode("ground")}>
                  Ground 21x21
                </button>
              </div>
              {boardMode === "atmo" ? (
                <div className="weapon-heatmap-page__atmo-picker">
                  <label className="small" htmlFor="weapon-heatmap-atmo-size">Atmosphere Grid Size (1-20)</label>
                  <input
                    id="weapon-heatmap-atmo-size"
                    className="input weapon-heatmap-page__atmo-size-input"
                    type="number"
                    min={1}
                    max={20}
                    step={1}
                    value={atmoBoardSize}
                    onChange={(event) => {
                      const parsed = Number(event.target.value);
                      if (Number.isNaN(parsed)) {
                        setAtmoBoardSize(20);
                        return;
                      }

                      setAtmoBoardSize(Math.max(1, Math.min(20, Math.round(parsed))));
                    }}
                  />
                  <div className="weapon-heatmap-page__atmo-meta">
                    <span className="small">
                      Atmosphere board: {atmoBoardSize}x{atmoBoardSize}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="weapon-heatmap-page__grid" style={{ gridTemplateColumns: `repeat(${gridColumns || 1}, minmax(0, 1fr))` }}>
              <div ref={gridRef} className="weapon-heatmap-page__grid-overlay-anchor" />
              {displayHeatCells.map((cell) => {
                  const isOrigin = cell.x === activeOrigin.x && cell.y === activeOrigin.y;
                  const isTarget = cell.x === activeTarget.x && cell.y === activeTarget.y;
                  return (
                    <button
                      key={`${cell.x}:${cell.y}`}
                      type="button"
                      className={`weapon-heatmap-page__cell${isOrigin ? " is-origin" : ""}${isTarget ? " is-target" : ""}`}
                      style={{ background: heatColor(cell.hitChance) }}
                      onMouseEnter={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const viewportRect = gridRef.current?.getBoundingClientRect() ?? rect;
                        const cellCenterX = rect.left - viewportRect.left + rect.width / 2;
                        const tooltipHalfWidth = HEATMAP_TOOLTIP_WIDTH_ESTIMATE / 2;
                        const maxLeft = viewportRect.width - HEATMAP_TOOLTIP_MARGIN - tooltipHalfWidth;
                        const minLeft = HEATMAP_TOOLTIP_MARGIN + tooltipHalfWidth;
                        const clampedLeft = Math.min(maxLeft, Math.max(minLeft, cellCenterX));
                        const preferredTop = rect.top - viewportRect.top - 10;
                        const canRenderAbove =
                          preferredTop - HEATMAP_TOOLTIP_HEIGHT_ESTIMATE >= HEATMAP_TOOLTIP_MARGIN;
                        const tooltipTop = canRenderAbove
                          ? preferredTop
                          : rect.bottom - viewportRect.top + 10;
                        setHoveredPopup({
                          cell,
                          left: clampedLeft,
                          top: tooltipTop,
                          transform: canRenderAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)",
                        });
                      }}
                      onFocus={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const viewportRect = gridRef.current?.getBoundingClientRect() ?? rect;
                        const cellCenterX = rect.left - viewportRect.left + rect.width / 2;
                        const tooltipHalfWidth = HEATMAP_TOOLTIP_WIDTH_ESTIMATE / 2;
                        const maxLeft = viewportRect.width - HEATMAP_TOOLTIP_MARGIN - tooltipHalfWidth;
                        const minLeft = HEATMAP_TOOLTIP_MARGIN + tooltipHalfWidth;
                        const clampedLeft = Math.min(maxLeft, Math.max(minLeft, cellCenterX));
                        const preferredTop = rect.top - viewportRect.top - 10;
                        const canRenderAbove =
                          preferredTop - HEATMAP_TOOLTIP_HEIGHT_ESTIMATE >= HEATMAP_TOOLTIP_MARGIN;
                        const tooltipTop = canRenderAbove
                          ? preferredTop
                          : rect.bottom - viewportRect.top + 10;
                        setHoveredPopup({
                          cell,
                          left: clampedLeft,
                          top: tooltipTop,
                          transform: canRenderAbove ? "translate(-50%, -100%)" : "translate(-50%, 0)",
                        });
                      }}
                      onClick={() => {
                        if (selectionMode === "origin") {
                          setSelectedOrigin({ x: cell.x, y: cell.y });
                        } else if (selectionMode === "target") {
                          setSelectedTarget({ x: cell.x, y: cell.y });
                        }
                      }}
                      onMouseLeave={() => {
                        setHoveredPopup((current) =>
                          current?.cell.x === cell.x && current?.cell.y === cell.y ? null : current
                        );
                      }}
                      onBlur={() => {
                        setHoveredPopup((current) =>
                          current?.cell.x === cell.x && current?.cell.y === cell.y ? null : current
                        );
                      }}
                      aria-label={`${
                        selectionMode === "origin"
                          ? "Set weapon grid"
                          : selectionMode === "target"
                            ? "Set target grid"
                            : "Inspect heatmap cell"
                      } ${cell.x}, ${cell.y}`}
                    >
                      <span>{formatNumber(cell.hitChance * 100, 0)}</span>
                      {isOrigin ? <i className="weapon-heatmap-page__marker weapon-heatmap-page__marker--origin" aria-hidden="true" /> : null}
                      {isTarget ? <i className="weapon-heatmap-page__marker weapon-heatmap-page__marker--target" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              {hoveredPopup ? (
                <div
                  className="weapon-heatmap-page__hover"
                  style={{
                    left: hoveredPopup.left,
                    top: hoveredPopup.top,
                    transform: hoveredPopup.transform,
                  }}
                >
                  <strong>
                    {hoveredPopup.cell.x}, {hoveredPopup.cell.y}
                  </strong>
                  <div className="weapon-heatmap-page__hover-group">
                    <span className="small weapon-heatmap-page__hover-label">Distance</span>
                    <span className="small">{formatNumber(hoveredPopup.cell.distance, 2)}</span>
                  </div>
                  {usesDirectionalArcs ? (
                    <div className="weapon-heatmap-page__hover-group">
                      <span className="small weapon-heatmap-page__hover-label">Bearing</span>
                      <span className="small">{formatNumber(bearingFromPoint(activeOrigin.x, activeOrigin.y, hoveredPopup.cell.x, hoveredPopup.cell.y), 0)}°</span>
                    </div>
                  ) : null}
                  <div className="weapon-heatmap-page__hover-group">
                    <span className="small weapon-heatmap-page__hover-label">Hit Chance</span>
                    <span className="small">{formatNumber(hoveredPopup.cell.hitChance * 100, 0)}%</span>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="weapon-heatmap-page__click-controls">
              <div className="members-combat-calc__section-pills">
                <button type="button" className={`ui-btn ui-btn--small${selectionMode === "none" ? " ui-btn--primary" : " ui-btn--soft"}`} onClick={() => setSelectionMode("none")}>
                  Inspect Only
                </button>
                <button type="button" className={`ui-btn ui-btn--small${selectionMode === "origin" ? " ui-btn--primary" : " ui-btn--soft"}`} onClick={() => setSelectionMode("origin")}>
                  Set Weapon Grid
                </button>
                <button type="button" className={`ui-btn ui-btn--small${selectionMode === "target" ? " ui-btn--primary" : " ui-btn--soft"}`} onClick={() => setSelectionMode("target")}>
                  Set Target Grid
                </button>
                <button
                  type="button"
                  className="ui-btn ui-btn--small ui-btn--soft"
                  onClick={() => {
                    setSelectedOrigin(defaultOrigin);
                    setSelectedTarget(defaultOrigin);
                    setHoveredPopup(null);
                  }}
                >
                  Reset Markers
                </button>
              </div>
            </div>
          </div>
        </section>

        <aside className="panel weapon-heatmap-page__side">
                <div className="weapon-heatmap-page__side-section">
                  <SectionToggle title="Summary" open={sideSectionsOpen.summary} onClick={() => toggleSideSection("summary")} />
                  {sideSectionsOpen.summary ? (
                    <div className="weapon-heatmap-page__side-head">
                      {viewMode === "combined" ? (
                        <>
                          <strong>{enabledWeapons.length ? "Combined Battery" : "No Weapons Enabled"}</strong>
                          <span className="small">
                            {enabledWeapons.length} linked weapons enabled
                            {combinedWeaponCount > 0 ? ` · ${combinedWeaponCount} total mounts` : ""}
                          </span>
                        </>
                      ) : (
                        <>
                          <strong>{selectedWeapon?.name ?? "No Weapon Selected"}</strong>
                          <span className="small">
                            {selectedWeapon
                              ? `${selectedWeapon.className ?? "Unknown class"}${(selectedWeapon.quantity ?? 0) > 1 ? ` · x${selectedWeapon.quantity}` : ""}`
                              : "Pick a linked weapon to see its live stats."}
                          </span>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="weapon-heatmap-page__side-section">
                  <SectionToggle title="Stats" open={sideSectionsOpen.stats} onClick={() => toggleSideSection("stats")} />
                  {sideSectionsOpen.stats ? (
                    <div className="weapon-heatmap-page__stats weapon-heatmap-page__stats--side">
                      {viewMode === "combined" ? (
                        <>
                          <article className="weapon-heatmap-page__stat"><span className="small">Enabled Weapons</span><strong>{formatNumber(enabledWeapons.length, 0)}</strong></article>
                          <article className="weapon-heatmap-page__stat"><span className="small">Total Mount Count</span><strong>{formatNumber(combinedWeaponCount, 0)}</strong></article>
                          <article className="weapon-heatmap-page__stat"><span className="small">Composite Logic</span><strong>Weighted %</strong></article>
                        </>
                      ) : selectedWeapon ? (
                        <>
                          <article className="weapon-heatmap-page__stat"><span className="small">Optimum Range</span><strong>{formatNumber(selectedWeapon.weapon.optimum_range, 1)}</strong></article>
                          <article className="weapon-heatmap-page__stat"><span className="small">Drop Off</span><strong>{formatNumber(selectedWeapon.weapon.drop_off, 1)}</strong></article>
                          <article className="weapon-heatmap-page__stat"><span className="small">Max Hits / Round</span><strong>{formatNumber(selectedMaxHits, 0)}</strong></article>
                        </>
                      ) : (
                        <>
                          <article className="weapon-heatmap-page__stat"><span className="small">Optimum Range</span><strong>0</strong></article>
                          <article className="weapon-heatmap-page__stat"><span className="small">Drop Off</span><strong>0</strong></article>
                          <article className="weapon-heatmap-page__stat"><span className="small">Max Hits / Round</span><strong>0</strong></article>
                        </>
                      )}
                      {usesDirectionalArcs ? (
                        <article className="weapon-heatmap-page__stat"><span className="small">Heading</span><strong>{headingDegrees}°</strong></article>
                      ) : null}
                      {usesDirectionalArcs ? (
                        <article className="weapon-heatmap-page__stat"><span className="small">Arc</span><strong>{viewMode === "combined" ? "Per Weapon" : (selectedWeapon?.arc ?? "Omnidirectional")}</strong></article>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="weapon-heatmap-page__side-section">
                  <SectionToggle title="Legend" open={sideSectionsOpen.legend} onClick={() => toggleSideSection("legend")} />
                  {sideSectionsOpen.legend ? (
                    <div className="weapon-heatmap-page__legend">
                      <div className="weapon-heatmap-page__legend-scale" />
                      <div className="weapon-heatmap-page__legend-labels small">
                        <span>Low Hit Chance</span>
                        <span>High Hit Chance</span>
                      </div>
                      <p className="small">Orange marker = weapon grid. Red marker = target grid.</p>
                      <p className="small">Use `Inspect Only` to read the board without moving markers, or switch to `Set Weapon Grid` / `Set Target Grid` when you want to reposition them.</p>
                    </div>
                  ) : null}
                </div>
        </aside>
      </div>
    </div>
  );
};

export default WeaponHeatmapTool;
