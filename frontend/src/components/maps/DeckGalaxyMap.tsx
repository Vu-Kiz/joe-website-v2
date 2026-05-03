import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { OrthographicView } from "@deck.gl/core";
import { IconLayer, LineLayer, PathLayer, PolygonLayer, TextLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import systemIconUrl from "../../assets/map/SystemIcon.png";
import asteroidFieldIconUrl from "../../assets/map/AsteroidFieldIcon.png";
import asteroidFieldIconUnknownUrl from "../../assets/map/AsteroidFieldIconUnknown.png";
import asteroidFieldIcon1x1Url from "../../assets/map/AsteroidFieldIcon1x1.png";
import asteroidFieldIcon1x1DoubleUrl from "../../assets/map/AsteroidFieldIcon1x1-2.png";
import asteroidFieldIcon1x1And2x2Url from "../../assets/map/AsteroidFieldIcon1x1-2x2.png";
import asteroidFieldIcon2x2Url from "../../assets/map/AsteroidFieldIcon2x2.png";
import scannedDuelconUrl from "../../assets/map/ScannedDuelcon.png";
import rescanDueIconUrl from "../../assets/map/RescanDueIcon.png";
import shipsDuelconUrl from "../../assets/map/ShipsDuelcon.png";
import stationsDuelconUrl from "../../assets/map/StationsDuelcon.png";
import hasNotesIconUrl from "../../assets/map/HasNotesIcon.png";
import BBCodeView from "../bbcode/BBCodeView";
import type {
  SectorCellAnnotation,
  SectorSearchRecord,
  StoredMapSystem,
  StoredSectorSummary,
  StoredSystemDetail,
} from "../../api/universe";

type DeckFocusRequest =
  | { kind: "sector"; sectorUid: string; nonce: number; zoom?: number }
  | { kind: "coords"; galx: number; galy: number; nonce: number; zoom?: number; highlightCell?: boolean }
  | null;

type DeckGalaxyMapProps = {
  sectors: StoredSectorSummary[];
  systemMarkers?: StoredMapSystem[];
  searchRecords?: SectorSearchRecord[];
  annotations?: SectorCellAnnotation[];
  canViewCellIntel?: boolean;
  canViewScanWindow?: boolean;
  canEditCellIntel?: boolean;
  activeSectorUid?: string | null;
  focusRequest?: DeckFocusRequest;
  onClearFocusRequest?: () => void;
  onSelectSector?: (sectorUid: string) => void;
  onSystemSelect?: (systemIdentifier: string, sectorUid?: string | null) => void;
  onLocationSelect?: (galx: number, galy: number, sectorUid?: string | null) => void;
  onSaveAnnotation?: (payload: { sector_uid: string; galx: number; galy: number; notes?: string | null }) => Promise<SectorCellAnnotation | null> | SectorCellAnnotation | null;
  onSaveSearchRecord?: (payload: { sector_uid?: string | null; galx: number; galy: number; planetoids_checked?: boolean | null; planetoid_1_size?: "1x1" | "2x2" | null; planetoid_2_size?: "1x1" | "2x2" | null; has_ships?: boolean | null; has_stations?: boolean | null }) => Promise<SectorSearchRecord> | SectorSearchRecord;
  loadSystemDetail?: (systemIdentifier: string) => Promise<StoredSystemDetail | null>;
  onCameraChange?: (galx: number, galy: number, zoom: number) => void;
  controlsOverlay?: React.ReactNode;
};

type HoverState = {
  x: number;
  y: number;
  galx: number | null;
  galy: number | null;
  title: string | null;
  subtitle: string | null;
};

type SelectedCellState = {
  galx: number;
  galy: number;
  sectorUid: string | null;
  sectorName: string | null;
  systems: StoredMapSystem[];
  searchRecord: SectorSearchRecord | null;
  annotation: SectorCellAnnotation | null;
};

type ViewState = {
  target: [number, number, number];
  zoom: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

type RenderBounds = {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
};

type SectorPolygonDatum = {
  uid: string;
  name: string | null;
  polygon: [number, number][];
  renderPolygon: [number, number][];
  center: [number, number];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
};

type SectorCellDatum = {
  id: string;
  uid: string;
  galx: number;
  galy: number;
};

type SectorBoundaryDatum = {
  id: string;
  uid: string;
  path: [number, number][];
};

type SystemPointDatum = {
  uid: string | null;
  identifier: string | null;
  name: string | null;
  sector_uid: string | null;
  position: [number, number];
};

type AsteroidIconDatum = {
  id: string;
  position: [number, number];
  icon: string;
};

type IntelFlagDatum = {
  id: string;
  position: [number, number];
  hasShips: boolean;
  hasStations: boolean;
  hasNotes: boolean;
};

type IntelIconDatum = {
  id: string;
  position: [number, number];
  icon: string;
  offset: [number, number];
};

type ScanBadgeDatum = {
  id: string;
  position: [number, number];
  icon: string;
};



type PlanetoidEntry = {
  size: "1x1" | "2x2";
};

type LegendFilterKey =
  | "system"
  | "asteroid_unknown"
  | "asteroid_none"
  | "asteroid_1x1"
  | "asteroid_1x1_double"
  | "asteroid_2x2"
  | "asteroid_1x1_2x2"
  | "ships"
  | "stations"
  | "notes"
  | "scanned"
  | "rescan";

type LegendFilters = Record<LegendFilterKey, boolean>;

const DEFAULT_LEGEND_FILTERS: LegendFilters = {
  system: true,
  asteroid_unknown: true,
  asteroid_none: true,
  asteroid_1x1: true,
  asteroid_1x1_double: true,
  asteroid_2x2: true,
  asteroid_1x1_2x2: true,
  ships: true,
  stations: true,
  notes: true,
  scanned: true,
  rescan: true,
};

type SystemBodyKind = "sun" | "moon" | "asteroid" | "comet" | "black_hole" | "planet";

type IntelDraft = {
  planetoids_checked: boolean | null;
  planetoid_1_size: "" | "1x1" | "2x2";
  planetoid_2_size: "" | "1x1" | "2x2";
  has_ships: boolean;
  has_stations: boolean;
};

function formatSwcDisplayId(value: string | null | undefined): string | null {
  if (!value) return null;
  const [prefix, rest] = value.split(":", 2);
  if (rest && /^\d+$/.test(prefix)) return rest;
  return value;
}

function formatRelativeAge(value: string | null | undefined): string | null {
  if (!value) return null;
  const timestampMs = new Date(value).getTime();
  if (Number.isNaN(timestampMs)) return null;
  const elapsed = Math.max(0, Date.now() - timestampMs);
  const min = 60000, hour = 3600000, day = 86400000, month = day * 30, year = day * 365;
  if (elapsed >= year) { const n = Math.floor(elapsed / year); return `${n} year${n === 1 ? "" : "s"} ago`; }
  if (elapsed >= month) { const n = Math.floor(elapsed / month); return `${n} month${n === 1 ? "" : "s"} ago`; }
  if (elapsed >= day) { const n = Math.floor(elapsed / day); return `${n} day${n === 1 ? "" : "s"} ago`; }
  if (elapsed >= hour) { const n = Math.floor(elapsed / hour); return `${n} hour${n === 1 ? "" : "s"} ago`; }
  const n = Math.max(1, Math.floor(elapsed / min));
  return `${n} minute${n === 1 ? "" : "s"} ago`;
}

function formatAsteroidUid(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.replace(/^5:/, "");
}

function formatPopulationDelta(current: number, previous: number | null): string {
  if (previous === null) return "0";
  const delta = current - previous;
  return `${delta > 0 ? "+" : ""}${delta.toLocaleString()}`;
}

function classifySystemBody(planet: StoredSystemDetail["planets"][number]): SystemBodyKind {
  const t = String(planet.planet_type_name ?? "").trim().toLowerCase();
  if (t === "sun") return "sun";
  if (t === "asteroid field") return "asteroid";
  if (t === "moon") return "moon";
  if (t === "comet") return "comet";
  if (t === "black hole") return "black_hole";
  return "planet";
}

function getSearchRecordSquareName(record: SectorSearchRecord | null | undefined): string | null {
  const value = record?.square_name?.trim();
  return value ? value : null;
}

function getPrimaryCellName(
  system: StoredMapSystem | null | undefined,
  record: SectorSearchRecord | null | undefined,
  canViewCellIntel: boolean
): string | null {
  const importedName = getSearchRecordSquareName(record);
  if (canViewCellIntel && record?.has_asteroids && importedName) return importedName;
  return system?.name ?? system?.identifier ?? formatSwcDisplayId(system?.uid) ?? (canViewCellIntel ? importedName : null) ?? null;
}


function wrapTextareaSelection(
  textarea: HTMLTextAreaElement | null,
  value: string,
  setValue: (v: string) => void,
  openTag: string,
  closeTag: string
) {
  if (!textarea) { setValue(`${value}${openTag}${closeTag}`); return; }
  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const selected = value.slice(start, end);
  const next = `${value.slice(0, start)}${openTag}${selected}${closeTag}${value.slice(end)}`;
  setValue(next);
  requestAnimationFrame(() => {
    textarea.focus();
    textarea.setSelectionRange(start + openTag.length, start + openTag.length + selected.length);
  });
}

const SECTOR_FILL_ACTIVE: [number, number, number, number] = [57, 62, 70, 255];
const SECTOR_FILL_IDLE: [number, number, number, number] = [49, 54, 62, 255];
const SECTOR_LINE_ACTIVE: [number, number, number, number] = [248, 181, 72, 238];
const SECTOR_LINE_IDLE: [number, number, number, number] = [228, 165, 68, 214];
const LABEL_COLOR_ACTIVE: [number, number, number, number] = [255, 196, 92, 248];
const LABEL_COLOR_IDLE: [number, number, number, number] = [242, 172, 70, 232];
const SHOW_PERF_QUERY = "map_perf";
const VIEW_INIT_SCALE = 0.82;
const RENDER_BOUNDS_PAD = 3;
// log2(MIN_ZOOM * CELL_SIZE) and log2(MAX_ZOOM * CELL_SIZE) from GalaxySectorMap (0.3/4, 18px)
const CAMERA_ZOOM_MIN = 2.43;
const CAMERA_ZOOM_MAX = 6.17;
const HOVER_OFFSET_PX = 16;
const HOVER_WIDTH_PX = 210;
const HOVER_HEIGHT_PX = 120;
const ASTEROID_ICONS_MIN_CELL_PX = 10;
const GRID_MIN_CELL_PX = ASTEROID_ICONS_MIN_CELL_PX;
const INTEL_FLAGS_MIN_CELL_PX = 14;
const SCAN_BADGES_MIN_CELL_PX = ASTEROID_ICONS_MIN_CELL_PX;
const PERF_DEBUG_STYLE: React.CSSProperties = {
  left: "0.85rem",
  right: "auto",
  bottom: "0.85rem",
  gap: "0.55rem",
  display: "grid",
};

const LEGEND_ITEMS: Array<{ key: LegendFilterKey; label: string; icon: string }> = [
  { key: "system", label: "System", icon: systemIconUrl },
  { key: "asteroid_unknown", label: "Planetoids", icon: asteroidFieldIconUnknownUrl },
  { key: "asteroid_none", label: "No Planetoids", icon: asteroidFieldIconUrl },
  { key: "asteroid_1x1", label: "1x1", icon: asteroidFieldIcon1x1Url },
  { key: "asteroid_1x1_double", label: "1x1 + 1x1", icon: asteroidFieldIcon1x1DoubleUrl },
  { key: "asteroid_2x2", label: "2x2", icon: asteroidFieldIcon2x2Url },
  { key: "asteroid_1x1_2x2", label: "1x1 + 2x2", icon: asteroidFieldIcon1x1And2x2Url },
  { key: "ships", label: "Ships Present", icon: shipsDuelconUrl },
  { key: "stations", label: "Stations Present", icon: stationsDuelconUrl },
  { key: "notes", label: "Notes Present", icon: hasNotesIconUrl },
  { key: "scanned", label: "Recently Scanned (<1 yr)", icon: scannedDuelconUrl },
  { key: "rescan", label: "Rescan Due (≥1 yr)", icon: rescanDueIconUrl },
];

function isSameHoverState(a: HoverState | null, b: HoverState | null) {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.galx === b.galx &&
    a.galy === b.galy &&
    a.title === b.title &&
    a.subtitle === b.subtitle
  );
}

function isSameSelectedCellState(a: SelectedCellState | null, b: SelectedCellState | null) {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  if (
    a.galx !== b.galx ||
    a.galy !== b.galy ||
    a.sectorUid !== b.sectorUid ||
    a.sectorName !== b.sectorName
  ) {
    return false;
  }
  if (a.searchRecord?.id !== b.searchRecord?.id) {
    return false;
  }
  if (a.annotation?.id !== b.annotation?.id) {
    return false;
  }
  if (a.systems.length !== b.systems.length) {
    return false;
  }
  for (let index = 0; index < a.systems.length; index += 1) {
    const left = a.systems[index];
    const right = b.systems[index];
    if (
      left.uid !== right.uid ||
      left.identifier !== right.identifier ||
      left.name !== right.name ||
      left.sector_uid !== right.sector_uid
    ) {
      return false;
    }
  }
  return true;
}

function getDaysSince(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const timestampMs = new Date(value).getTime();
  if (Number.isNaN(timestampMs)) {
    return null;
  }
  return Math.max(0, Math.floor((Date.now() - timestampMs) / (24 * 60 * 60 * 1000)));
}

function getPlanetoidEntries(record: SectorSearchRecord | null | undefined): PlanetoidEntry[] {
  if (!record) {
    return [];
  }

  const entries: PlanetoidEntry[] = [];
  if (record.planetoid_1_size) {
    entries.push({ size: record.planetoid_1_size });
  }
  if (record.planetoid_2_size) {
    entries.push({ size: record.planetoid_2_size });
  }
  return entries;
}

function getAsteroidMarkerIcon(planetoids: PlanetoidEntry[], planetoidsChecked: boolean | null | undefined) {
  if (planetoids.length === 1) {
    return planetoids[0].size === "2x2" ? asteroidFieldIcon2x2Url : asteroidFieldIcon1x1Url;
  }
  if (planetoids.length >= 2) {
    const sizes = planetoids.map((entry) => entry.size).sort();
    if (sizes[0] === "1x1" && sizes[1] === "1x1") {
      return asteroidFieldIcon1x1DoubleUrl;
    }
    if (sizes[0] === "1x1" && sizes[1] === "2x2") {
      return asteroidFieldIcon1x1And2x2Url;
    }
  }
  if (planetoidsChecked == null) {
    return asteroidFieldIconUnknownUrl;
  }
  return asteroidFieldIconUrl;
}

function getAsteroidLegendKey(
  planetoids: PlanetoidEntry[],
  planetoidsChecked: boolean | null | undefined
): LegendFilterKey {
  if (planetoids.length === 1) {
    return planetoids[0].size === "2x2" ? "asteroid_2x2" : "asteroid_1x1";
  }
  if (planetoids.length >= 2) {
    const sizes = planetoids.map((entry) => entry.size).sort();
    if (sizes[0] === "1x1" && sizes[1] === "1x1") {
      return "asteroid_1x1_double";
    }
    if (sizes[0] === "1x1" && sizes[1] === "2x2") {
      return "asteroid_1x1_2x2";
    }
  }
  if (planetoidsChecked == null) {
    return "asteroid_unknown";
  }
  return "asteroid_none";
}

function polygonCentroid(polygon: Array<[number, number]>): [number, number] {
  let area = 0;
  let cx = 0;
  let cy = 0;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const cross = polygon[j][0] * polygon[i][1] - polygon[i][0] * polygon[j][1];
    area += cross;
    cx += (polygon[j][0] + polygon[i][0]) * cross;
    cy += (polygon[j][1] + polygon[i][1]) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-10) {
    // Degenerate polygon — fall back to vertex average
    const sumX = polygon.reduce((s, p) => s + p[0], 0);
    const sumY = polygon.reduce((s, p) => s + p[1], 0);
    return [sumX / n, sumY / n];
  }
  return [cx / (6 * area), cy / (6 * area)];
}

function pointInPolygon(x: number, y: number, polygon: Array<[number, number]>) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}



function isInsideRenderBounds(position: [number, number], bounds: RenderBounds | null) {
  if (!bounds) {
    return true;
  }
  const [x, y] = position;
  return x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;
}

function toCellKey(galx: number, galy: number) {
  return `${galx}:${galy}`;
}

function isImageIcon(icon: string) {
  return icon.startsWith("http") || icon.startsWith("/");
}

const CAMERA_STORAGE_KEY = "joe-galaxy-camera-v1";

function readCameraFromStorage(): { galx: number; galy: number; zoom: number } | null {
  try {
    const raw = localStorage.getItem(CAMERA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed.galx === "number" && typeof parsed.galy === "number" && typeof parsed.zoom === "number") {
      return parsed;
    }
  } catch { /* ignore */ }
  return null;
}

function writeCameraToStorage(galx: number, galy: number, zoom: number) {
  try {
    localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify({ galx, galy, zoom }));
  } catch { /* ignore */ }
}

function initViewStateFromFocusOrStorage(focusRequest: DeckFocusRequest): ViewState {
  if (focusRequest?.kind === "coords" && focusRequest.zoom != null) {
    return {
      target: [focusRequest.galx + 0.5, focusRequest.galy + 0.5, 0],
      zoom: Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, focusRequest.zoom)),
    };
  }
  const saved = readCameraFromStorage();
  if (saved) {
    return {
      target: [saved.galx + 0.5, saved.galy + 0.5, 0],
      zoom: Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, saved.zoom)),
    };
  }
  return { target: [0, 0, 0], zoom: -2 };
}

const DeckGalaxyMap: React.FC<DeckGalaxyMapProps> = ({
  sectors,
  systemMarkers = [],
  searchRecords = [],
  annotations = [],
  canViewCellIntel = false,
  canViewScanWindow = false,
  canEditCellIntel = false,
  activeSectorUid,
  focusRequest,
  onClearFocusRequest,
  onSelectSector,
  onSystemSelect,
  onLocationSelect,
  onSaveAnnotation,
  onSaveSearchRecord,
  loadSystemDetail,
  onCameraChange,
  controlsOverlay,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const legendBodyRef = useRef<HTMLDivElement | null>(null);
  const cameraChangeTimerRef = useRef<number | null>(null);
  const [viewState, setViewState] = useState<ViewState>(() => initViewStateFromFocusOrStorage(focusRequest ?? null));
  const [hover, setHover] = useState<HoverState | null>(null);
  const [hasInitializedView, setHasInitializedView] = useState<boolean>(() => {
    if (focusRequest?.kind === "coords" && focusRequest.zoom != null) return true;
    return readCameraFromStorage() != null;
  });
  const [legendOpen, setLegendOpen] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [legendFilters, setLegendFilters] = useState<LegendFilters>(DEFAULT_LEGEND_FILTERS);
  const [legendMaxHeight, setLegendMaxHeight] = useState<number | null>(null);
  const [legendShouldScroll, setLegendShouldScroll] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCellState | null>(null);
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 1, height: 1 });
  const hoverFrameRef = useRef<number | null>(null);
  const pendingHoverRef = useRef<HoverState | null>(null);
  const hoverStateRef = useRef<HoverState | null>(null);
  const viewFrameRef = useRef<number | null>(null);
  const pendingViewRef = useRef<ViewState | null>(null);
  const lastFocusNonceRef = useRef<number | null>(null);
  const lastClickRef = useRef<{ galx: number; galy: number; time: number } | null>(null);
  const geometryWorkerRef = useRef<Worker | null>(null);
  const geometryWorkerRequestIdRef = useRef(0);
  const [computedSectorGeometry, setComputedSectorGeometry] = useState<Array<{
    uid: string;
    cells: Array<{ galx: number; galy: number }>;
    boundarySegments: Array<{ x1: number; y1: number; x2: number; y2: number }>;
  }>>([]);
  const [computedLabelCentroids, setComputedLabelCentroids] = useState<Record<string, [number, number]>>({});
  const [highlightedCell, setHighlightedCell] = useState<{ galx: number; galy: number } | null>(null);
  const selectionBodyRef = useRef<HTMLDivElement | null>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionDragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const [selectionPanelPos, setSelectionPanelPos] = useState<{ left: number; top: number } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [intelDraft, setIntelDraft] = useState<IntelDraft>({
    planetoids_checked: null,
    planetoid_1_size: "",
    planetoid_2_size: "",
    has_ships: false,
    has_stations: false,
  });
  const [isEditingIntel, setIsEditingIntel] = useState(false);
  const [savingIntel, setSavingIntel] = useState(false);
  const [selectedSystemDetail, setSelectedSystemDetail] = useState<StoredSystemDetail | null>(null);
  const [selectedSystemDetailLoading, setSelectedSystemDetailLoading] = useState(false);
  const [showSelectionFade, setShowSelectionFade] = useState(false);

  const orthoView = useMemo(
    () => new OrthographicView({ id: "ortho", controller: true, flipY: false }),
    []
  );
  const deckController = useMemo(
    () => ({
      dragPan: true,
      dragRotate: false,
      doubleClickZoom: false,
      scrollZoom: {
        speed: 0.02,
        smooth: true,
      },
    }),
    []
  );
  const showPerfDebug = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return new URLSearchParams(window.location.search).get(SHOW_PERF_QUERY) === "1";
  }, []);

  const worldBounds = useMemo(() => {
    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const sector of sectors) {
      const bounds = sector.bounds;
      if (!bounds) {
        continue;
      }
      minX = Math.min(minX, bounds.min_galx);
      maxX = Math.max(maxX, bounds.max_galx);
      minY = Math.min(minY, bounds.min_galy);
      maxY = Math.max(maxY, bounds.max_galy);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(maxX) || !Number.isFinite(minY) || !Number.isFinite(maxY)) {
      return null;
    }
    return { minX, maxX, minY, maxY };
  }, [sectors]);

  useEffect(() => {
    if (!worldBounds || !viewportRef.current || hasInitializedView) {
      return;
    }
    const width = Math.max(1, viewportRef.current.clientWidth || 1);
    const height = Math.max(1, viewportRef.current.clientHeight || 1);
    const worldWidth = Math.max(1, worldBounds.maxX - worldBounds.minX + 1);
    const worldHeight = Math.max(1, worldBounds.maxY - worldBounds.minY + 1);
    const scale = Math.max(0.0001, Math.min(width / worldWidth, height / worldHeight) * VIEW_INIT_SCALE);
    const zoom = Math.min(CAMERA_ZOOM_MAX, Math.max(CAMERA_ZOOM_MIN, Math.log2(scale)));

    setViewState({
      target: [
        (worldBounds.minX + worldBounds.maxX) / 2,
        (worldBounds.minY + worldBounds.maxY) / 2,
        0,
      ],
      zoom,
    });
    setHasInitializedView(true);
  }, [hasInitializedView, worldBounds]);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) {
      return;
    }
    const updateSize = () => {
      setViewportSize({
        width: Math.max(1, node.clientWidth || 1),
        height: Math.max(1, node.clientHeight || 1),
      });
    };
    updateSize();

    const observer = new ResizeObserver(() => updateSize());
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const renderBounds = useMemo<RenderBounds | null>(() => {
    if (!Number.isFinite(viewState.zoom)) {
      return null;
    }
    const scale = Math.max(0.0001, Math.pow(2, viewState.zoom));
    const halfWorldWidth = viewportSize.width / (2 * scale);
    const halfWorldHeight = viewportSize.height / (2 * scale);
    return {
      minX: viewState.target[0] - halfWorldWidth - RENDER_BOUNDS_PAD,
      maxX: viewState.target[0] + halfWorldWidth + RENDER_BOUNDS_PAD,
      minY: viewState.target[1] - halfWorldHeight - RENDER_BOUNDS_PAD,
      maxY: viewState.target[1] + halfWorldHeight + RENDER_BOUNDS_PAD,
    };
  }, [viewState.target, viewState.zoom, viewportSize.height, viewportSize.width]);

  const sectorPolygons = useMemo<SectorPolygonDatum[]>(() => {
    const data: SectorPolygonDatum[] = [];
    for (const sector of sectors) {
      const points = sector.outline_coordinates
        .map((point) => [point.galx, point.galy] as [number, number])
        .filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]));
      if (points.length < 3) {
        continue;
      }
      let minX = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;
      for (const [x, y] of points) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      const center = points.length >= 3 ? polygonCentroid(points) : points[Math.floor(points.length / 2)];
      data.push({
        uid: sector.uid,
        name: sector.name,
        polygon: points,
        // Draw borders on grid lines (cell edges), not through cell centers.
        renderPolygon: points.map(([x, y]) => [x - 0.5, y - 0.5] as [number, number]),
        center,
        bounds: { minX, maxX, minY, maxY },
      });
    }
    return data;
  }, [sectors]);

  // Keep all sector polygons rendered to prevent visible seams/gaps between touching sector borders.
  // We still cull labels/icons separately for performance.
  const visibleSectorPolygons = sectorPolygons;

  const sectorGeometry = computedSectorGeometry;
  const sectorCellCentroidByUid = useMemo(() => {
    const map = new Map<string, [number, number]>();
    for (const [uid, centroid] of Object.entries(computedLabelCentroids)) {
      map.set(uid, centroid);
    }
    return map;
  }, [computedLabelCentroids]);

  useEffect(() => {
    if (!geometryWorkerRef.current) {
      geometryWorkerRef.current = new Worker(
        new URL("../../workers/sectorGeometryWorker.ts", import.meta.url),
        { type: "module" }
      );
      geometryWorkerRef.current.onmessage = (event: MessageEvent) => {
        const { requestId, sectorGeometry: geo, labelCentroids } = event.data;
        if (requestId !== geometryWorkerRequestIdRef.current) return;
        setComputedSectorGeometry(geo);
        setComputedLabelCentroids(labelCentroids);
      };
    }

    const requestId = ++geometryWorkerRequestIdRef.current;
    geometryWorkerRef.current.postMessage({ requestId, sectors });
  }, [sectors]);

  useEffect(() => {
    return () => {
      geometryWorkerRef.current?.terminate();
      geometryWorkerRef.current = null;
    };
  }, []);

  const sectorByUid = useMemo(() => {
    const map = new Map<string, SectorPolygonDatum>();
    for (const sector of sectorPolygons) {
      map.set(sector.uid, sector);
    }
    return map;
  }, [sectorPolygons]);

  const sectorOwnerByCellKey = useMemo(() => {
    const ownership = new Map<string, string>();
    for (const sector of sectorGeometry) {
      for (const cell of sector.cells) {
        ownership.set(toCellKey(cell.galx, cell.galy), sector.uid);
      }
    }
    return ownership;
  }, [sectorGeometry]);

  const visibleSectorFillCells = useMemo<SectorCellDatum[]>(() => {
    const entries: SectorCellDatum[] = [];
    for (const sector of sectorGeometry) {
      for (const cell of sector.cells) {
        if (!isInsideRenderBounds([cell.galx, cell.galy], renderBounds)) {
          continue;
        }
        entries.push({
          id: `${sector.uid}:${cell.galx}:${cell.galy}`,
          uid: sector.uid,
          galx: cell.galx,
          galy: cell.galy,
        });
      }
    }
    return entries;
  }, [renderBounds, sectorGeometry]);

  const visibleSectorBoundaries = useMemo<SectorBoundaryDatum[]>(() => {
    const entries: SectorBoundaryDatum[] = [];
    for (const sector of sectorGeometry) {
      for (let index = 0; index < sector.boundarySegments.length; index += 1) {
        const segment = sector.boundarySegments[index];
        const midpointX = (segment.x1 + segment.x2) / 2;
        const midpointY = (segment.y1 + segment.y2) / 2;
        if (!isInsideRenderBounds([midpointX, midpointY], renderBounds)) {
          continue;
        }
        entries.push({
          id: `${sector.uid}:seg:${index}`,
          uid: sector.uid,
          path: [
            [segment.x1, segment.y1],
            [segment.x2, segment.y2],
          ],
        });
      }
    }
    return entries;
  }, [renderBounds, sectorGeometry]);

  const pixelCellSize = Math.max(1, Math.pow(2, viewState.zoom));
  const markerSizePx = Math.max(5, pixelCellSize * 0.72);
  const flagSizePx = Math.max(6, markerSizePx * 0.4);
  const markerOffsetPx = Math.max(6, markerSizePx * 0.40);
  const scanOffsetPx = Math.max(3, markerSizePx * 0.38);

  const sectorLabels = useMemo(() => {
    if (pixelCellSize >= ASTEROID_ICONS_MIN_CELL_PX) return [];
    return visibleSectorPolygons
      .map((sector) => {
        const text = sector.name ?? sector.uid;
        const width = sector.bounds.maxX - sector.bounds.minX + 1;
        const height = sector.bounds.maxY - sector.bounds.minY + 1;
        const sizeByWidth = (width * 0.85) / (Math.max(1, text.length) * 0.58);
        const sizeByHeight = height * 0.35;
        const labelSize = Math.min(sizeByWidth, sizeByHeight, 2.5);
        const position = sectorCellCentroidByUid.get(sector.uid) ?? sector.center;
        return { uid: sector.uid, text, position, labelSize };
      })
      .filter((entry) => isInsideRenderBounds(entry.position, renderBounds));
  }, [pixelCellSize, renderBounds, sectorCellCentroidByUid, visibleSectorPolygons]);

  const systemPoints = useMemo<SystemPointDatum[]>(
    () =>
      (legendFilters.system ? systemMarkers : [])
        .filter((system) => system.galx != null && system.galy != null)
        .map((system) => ({
          uid: system.uid ?? null,
          identifier: system.identifier ?? null,
          name: system.name ?? null,
          sector_uid: system.sector_uid,
          position: [Number(system.galx) + 0.5, Number(system.galy) + 0.5] as [number, number],
        }))
        .filter((system) => isInsideRenderBounds(system.position, renderBounds)),
    [legendFilters.system, renderBounds, systemMarkers]
  );

  const systemsByKey = useMemo(() => {
    const map = new Map<string, StoredMapSystem[]>();
    for (const system of systemMarkers) {
      if (system.galx == null || system.galy == null) {
        continue;
      }
      const key = toCellKey(system.galx, system.galy);
      const current = map.get(key) ?? [];
      current.push(system);
      map.set(key, current);
    }
    return map;
  }, [systemMarkers]);

  const searchRecordByKey = useMemo(() => {
    const map = new Map<string, SectorSearchRecord>();
    for (const record of searchRecords) {
      map.set(toCellKey(record.galx, record.galy), record);
    }
    return map;
  }, [searchRecords]);

  useEffect(() => {
    if (!selectedCell) return;
    const fresh = searchRecordByKey.get(toCellKey(selectedCell.galx, selectedCell.galy)) ?? null;
    if (fresh === selectedCell.searchRecord) return;
    setSelectedCell((current) => current ? { ...current, searchRecord: fresh } : null);
  }, [searchRecordByKey]);

  const annotationByKey = useMemo(() => {
    const map = new Map<string, SectorCellAnnotation>();
    for (const annotation of annotations) {
      map.set(toCellKey(annotation.galx, annotation.galy), annotation);
    }
    return map;
  }, [annotations]);

  const gridLines = useMemo(() => {
    if (pixelCellSize < GRID_MIN_CELL_PX || !renderBounds) {
      return [];
    }
    const minX = Math.floor(renderBounds.minX);
    const maxX = Math.ceil(renderBounds.maxX);
    const minY = Math.floor(renderBounds.minY);
    const maxY = Math.ceil(renderBounds.maxY);
    const lines: { start: [number, number]; end: [number, number] }[] = [];
    for (let x = minX; x <= maxX; x++) {
      lines.push({ start: [x, minY], end: [x, maxY] });
    }
    for (let y = minY; y <= maxY; y++) {
      lines.push({ start: [minX, y], end: [maxX, y] });
    }
    return lines;
  }, [pixelCellSize, renderBounds]);

  const visibleSearchRecords = useMemo(
    () =>
      searchRecords.filter((record) =>
        isInsideRenderBounds([Number(record.galx), Number(record.galy)], renderBounds)
      ),
    [renderBounds, searchRecords]
  );

  const visibleAnnotationsWithNotes = useMemo(
    () =>
      annotations.filter(
        (annotation) =>
          Boolean(annotation.notes?.trim()) &&
          isInsideRenderBounds([Number(annotation.galx), Number(annotation.galy)], renderBounds)
      ),
    [annotations, renderBounds]
  );

  const annotationKeysWithNotes = useMemo(
    () =>
      new Set(
        visibleAnnotationsWithNotes.map((annotation) => toCellKey(annotation.galx, annotation.galy))
      ),
    [visibleAnnotationsWithNotes]
  );

  const asteroidIcons = useMemo<AsteroidIconDatum[]>(() => {
    if (!canViewCellIntel || pixelCellSize < ASTEROID_ICONS_MIN_CELL_PX) {
      return [];
    }

    return visibleSearchRecords
      .filter((record) => record.has_asteroids)
      .map((record) => {
        const planetoids = getPlanetoidEntries(record);
        const legendKey = getAsteroidLegendKey(planetoids, record.planetoids_checked);
        if (!legendFilters[legendKey]) {
          return null;
        }
        return {
          id: `asteroid:${record.id}`,
          position: [Number(record.galx) + 0.5, Number(record.galy) + 0.5] as [number, number],
          icon: getAsteroidMarkerIcon(planetoids, record.planetoids_checked),
        };
      })
      .filter((entry): entry is AsteroidIconDatum => !!entry);
  }, [canViewCellIntel, legendFilters, pixelCellSize, visibleSearchRecords]);

  const intelFlags = useMemo<IntelFlagDatum[]>(() => {
    if (!canViewCellIntel || pixelCellSize < INTEL_FLAGS_MIN_CELL_PX) {
      return [];
    }

    const recordsByKey = new Map<string, SectorSearchRecord | null>();
    for (const record of visibleSearchRecords) {
      recordsByKey.set(toCellKey(record.galx, record.galy), record);
    }
    for (const key of annotationKeysWithNotes) {
      if (!recordsByKey.has(key)) {
        recordsByKey.set(key, null);
      }
    }

    return Array.from(recordsByKey.entries())
      .map(([key, record]) => {
        const [galx, galy] = key.split(":").map(Number);
        return {
          id: `intel:${key}`,
          position: [galx + 0.5, galy + 0.5] as [number, number],
          hasShips: record?.has_ships === true && legendFilters.ships,
          hasStations: record?.has_stations === true && legendFilters.stations,
          hasNotes: annotationKeysWithNotes.has(key) && legendFilters.notes,
        };
      })
      .filter(
        (
          entry
        ): entry is IntelFlagDatum => !!entry && (entry.hasShips || entry.hasStations || entry.hasNotes)
      );
  }, [annotationKeysWithNotes, canViewCellIntel, legendFilters.notes, legendFilters.ships, legendFilters.stations, pixelCellSize, visibleSearchRecords]);

  const scanBadges = useMemo<ScanBadgeDatum[]>(() => {
    if (!(canViewCellIntel || canViewScanWindow) || pixelCellSize < SCAN_BADGES_MIN_CELL_PX) {
      return [];
    }

    return visibleSearchRecords
      .filter((record) => !!record.legacy_recorded_at || record.is_system_searched)
      .map((record) => {
        const dateForAge = record.legacy_recorded_at ?? record.updated_at;
        const daysSince = getDaysSince(dateForAge);
        const kind = daysSince != null && daysSince >= 365 ? "rescan" : "scanned";
        if (!legendFilters[kind]) {
          return null;
        }
        return {
          id: `scan:${record.id}`,
          position: [Number(record.galx) + 0.5, Number(record.galy) + 0.5] as [number, number],
          icon: kind === "rescan" ? rescanDueIconUrl : scannedDuelconUrl,
        };
      })
      .filter((entry): entry is ScanBadgeDatum => !!entry);
  }, [canViewCellIntel, canViewScanWindow, legendFilters, pixelCellSize, visibleSearchRecords]);

const intelIcons = useMemo<IntelIconDatum[]>(() => {
    const entries: IntelIconDatum[] = [];
    for (const entry of intelFlags) {
      if (entry.hasShips) {
        entries.push({
          id: `${entry.id}:ships`,
          position: entry.position,
          icon: shipsDuelconUrl,
          offset: [markerOffsetPx, markerOffsetPx],
        });
      }
      if (entry.hasStations) {
        entries.push({
          id: `${entry.id}:stations`,
          position: entry.position,
          icon: stationsDuelconUrl,
          offset: [markerOffsetPx, -markerOffsetPx],
        });
      }
      if (entry.hasNotes) {
        entries.push({
          id: `${entry.id}:notes`,
          position: entry.position,
          icon: hasNotesIconUrl,
          offset: [-markerOffsetPx, markerOffsetPx],
        });
      }
    }
    return entries;
  }, [intelFlags, markerOffsetPx]);

  const resolveSectorAt = useCallback(
    (galx: number, galy: number) => {
      const ownerUid = sectorOwnerByCellKey.get(toCellKey(galx, galy));
      if (ownerUid) {
        const sector = sectorByUid.get(ownerUid);
        return {
          uid: ownerUid,
          name: sector?.name ?? ownerUid,
        };
      }

      for (const sector of sectorPolygons) {
        const bounds = sector.bounds;
        if (
          bounds &&
          (galx < bounds.minX ||
            galx > bounds.maxX ||
            galy < bounds.minY ||
            galy > bounds.maxY)
        ) {
          continue;
        }
        if (sector.polygon.length && !pointInPolygon(galx, galy, sector.polygon)) {
          continue;
        }
        return {
          uid: sector.uid,
          name: sector.name ?? sector.uid,
        };
      }
      return {
        uid: null,
        name: null,
      };
    },
    [sectorByUid, sectorOwnerByCellKey, sectorPolygons]
  );

  const selectCellAt = useCallback(
    (galx: number, galy: number) => {
      const key = toCellKey(galx, galy);
      const sector = resolveSectorAt(galx, galy);
      const nextSelectedCell: SelectedCellState = {
        galx,
        galy,
        sectorUid: sector.uid,
        sectorName: sector.name,
        systems: systemsByKey.get(key) ?? [],
        searchRecord: searchRecordByKey.get(key) ?? null,
        annotation: annotationByKey.get(key) ?? null,
      };
      setSelectedCell((current) => (isSameSelectedCellState(current, nextSelectedCell) ? current : nextSelectedCell));
      return sector;
    },
    [annotationByKey, resolveSectorAt, searchRecordByKey, systemsByKey]
  );

  const scheduleHoverUpdate = useCallback((next: HoverState | null) => {
    if (isSameHoverState(hoverStateRef.current, next) && isSameHoverState(pendingHoverRef.current, next)) {
      return;
    }
    pendingHoverRef.current = next;
    if (hoverFrameRef.current != null) {
      return;
    }
    hoverFrameRef.current = window.requestAnimationFrame(() => {
      hoverFrameRef.current = null;
      const pending = pendingHoverRef.current;
      if (isSameHoverState(hoverStateRef.current, pending)) {
        return;
      }
      hoverStateRef.current = pending;
      setHover(pending);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (hoverFrameRef.current != null) {
        window.cancelAnimationFrame(hoverFrameRef.current);
        hoverFrameRef.current = null;
      }
      pendingHoverRef.current = null;
      hoverStateRef.current = null;
      if (viewFrameRef.current != null) {
        window.cancelAnimationFrame(viewFrameRef.current);
        viewFrameRef.current = null;
      }
    };
  }, []);

  const scheduleViewStateUpdate = useCallback((next: ViewState) => {
    pendingViewRef.current = next;
    if (viewFrameRef.current != null) {
      return;
    }
    viewFrameRef.current = window.requestAnimationFrame(() => {
      viewFrameRef.current = null;
      const pending = pendingViewRef.current;
      if (!pending) {
        return;
      }
      setViewState((current) => {
        const sameZoom = Math.abs(current.zoom - pending.zoom) < 0.0001;
        const sameX = Math.abs(current.target[0] - pending.target[0]) < 0.0001;
        const sameY = Math.abs(current.target[1] - pending.target[1]) < 0.0001;
        if (sameZoom && sameX && sameY) {
          return current;
        }
        return pending;
      });
    });
  }, []);

  useEffect(() => {
    if (!focusRequest) return;
    if (focusRequest.nonce === lastFocusNonceRef.current) return;
    lastFocusNonceRef.current = focusRequest.nonce;

    if (focusRequest.kind === "sector") {
      const sector = sectorByUid.get(focusRequest.sectorUid);
      if (!sector) {
        onClearFocusRequest?.();
        return;
      }
      const bounds = sector.bounds;
      let zoom: number;
      if (focusRequest.zoom != null) {
        zoom = focusRequest.zoom;
      } else {
        const worldW = Math.max(1, bounds.maxX - bounds.minX + 1);
        const worldH = Math.max(1, bounds.maxY - bounds.minY + 1);
        const vw = Math.max(1, viewportSize.width);
        const vh = Math.max(1, viewportSize.height);
        const scale = Math.min(vw / worldW, vh / worldH) * 0.75;
        zoom = Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, Math.log2(scale)));
      }
      setViewState({
        target: [sector.center[0], sector.center[1], 0],
        zoom,
      });
    } else if (focusRequest.kind === "coords") {
      const zoom = focusRequest.zoom != null
        ? Math.max(CAMERA_ZOOM_MIN, Math.min(CAMERA_ZOOM_MAX, focusRequest.zoom))
        : viewState.zoom;
      setViewState({
        target: [focusRequest.galx + 0.5, focusRequest.galy + 0.5, 0],
        zoom,
      });
      if (focusRequest.highlightCell) {
        const { galx, galy } = focusRequest;
        setHighlightedCell({ galx, galy });
        selectCellAt(galx, galy);
        setSelectionPanelPos({
          left: Math.round(viewportSize.width / 2),
          top: Math.round(viewportSize.height / 2 - 60),
        });
      }
    }

    onClearFocusRequest?.();
  }, [focusRequest, onClearFocusRequest, sectorByUid, selectCellAt, viewportSize, viewState.zoom]);

  const layerPack = useMemo(() => {
    const buildStart = typeof performance !== "undefined" ? performance.now() : 0;
    const layers = [
      new LineLayer({
        id: "deck-galaxy-grid",
        data: gridLines,
        pickable: false,
        getSourcePosition: (d: { start: [number, number] }) => d.start,
        getTargetPosition: (d: { end: [number, number] }) => d.end,
        getColor: [255, 255, 255, 45],
        getWidth: 1,
        widthUnits: "pixels",
      }),
      new PolygonLayer<SectorCellDatum>({
        id: "deck-galaxy-sectors-fill",
        data: visibleSectorFillCells,
        pickable: true,
        stroked: gridLines.length > 0,
        filled: true,
        lineWidthUnits: "pixels",
        getLineWidth: 1,
        getLineColor: [255, 255, 255, 40],
        getPolygon: (d) => [
          [d.galx, d.galy],
          [d.galx + 1, d.galy],
          [d.galx + 1, d.galy + 1],
          [d.galx, d.galy + 1],
        ],
        getFillColor: (d) =>
          activeSectorUid != null && d.uid === activeSectorUid ? SECTOR_FILL_ACTIVE : SECTOR_FILL_IDLE,
        updateTriggers: {
          getFillColor: [activeSectorUid],
        },
      }),
new PolygonLayer({
        id: "deck-galaxy-cell-highlight",
        data: highlightedCell ? [highlightedCell] : [],
        pickable: false,
        stroked: true,
        filled: true,
        lineWidthUnits: "pixels",
        getLineWidth: 2,
        getLineColor: [248, 181, 72, 255],
        getPolygon: (d: { galx: number; galy: number }) => [
          [d.galx, d.galy],
          [d.galx + 1, d.galy],
          [d.galx + 1, d.galy + 1],
          [d.galx, d.galy + 1],
        ],
        getFillColor: [248, 181, 72, 50],
        updateTriggers: { data: [highlightedCell] },
      }),
      new PathLayer<SectorBoundaryDatum>({
        id: "deck-galaxy-sectors-stroke",
        data: visibleSectorBoundaries,
        pickable: false,
        getPath: (d) => d.path,
        getColor: (d) =>
          activeSectorUid != null && d.uid === activeSectorUid ? SECTOR_LINE_ACTIVE : SECTOR_LINE_IDLE,
        widthUnits: "pixels",
        getWidth: (d) => (activeSectorUid != null && d.uid === activeSectorUid ? 2.2 : 1.7),
        updateTriggers: {
          getColor: [activeSectorUid],
          getWidth: [activeSectorUid],
        },
      }),
      new IconLayer<AsteroidIconDatum>({
        id: "deck-galaxy-asteroids",
        data: asteroidIcons,
        pickable: false,
        getPosition: (d) => d.position,
        getIcon: (d) => ({ url: d.icon, width: 96, height: 96, anchorX: 48, anchorY: 48 }),
        sizeUnits: "pixels",
        getSize: markerSizePx,
        updateTriggers: {
          getSize: [markerSizePx],
        },
      }),
      new IconLayer<SystemPointDatum>({
        id: "deck-galaxy-systems",
        data: systemPoints,
        pickable: true,
        getPosition: (d) => d.position,
        getIcon: () => ({ url: systemIconUrl, width: 96, height: 96, anchorX: 48, anchorY: 48 }),
        sizeUnits: "pixels",
        getSize: markerSizePx,
        updateTriggers: {
          getSize: [markerSizePx],
        },
      }),
      new IconLayer<IntelIconDatum>({
        id: "deck-galaxy-intel-icons",
        data: intelIcons,
        pickable: false,
        getPosition: (d) => d.position,
        getPixelOffset: (d) => d.offset,
        getIcon: (d) => ({ url: d.icon, width: 32, height: 32, anchorX: 16, anchorY: 16 }),
        sizeUnits: "pixels",
        getSize: flagSizePx,
        updateTriggers: {
          getPixelOffset: [markerOffsetPx],
          getSize: [flagSizePx],
        },
      }),
      new IconLayer<ScanBadgeDatum>({
        id: "deck-galaxy-scan-badges",
        data: scanBadges,
        pickable: false,
        getPosition: (d) => d.position,
        getPixelOffset: [-scanOffsetPx, -scanOffsetPx],
        getIcon: (d) => ({ url: d.icon, width: 32, height: 32, anchorX: 16, anchorY: 16 }),
        sizeUnits: "pixels",
        getSize: flagSizePx,
        updateTriggers: {
          getPixelOffset: [scanOffsetPx],
          getSize: [flagSizePx],
        },
      }),
      new TextLayer({
        id: "deck-galaxy-sector-labels",
        data: sectorLabels,
        pickable: false,
        getPosition: (d: { position: [number, number] }) => d.position,
        getText: (d: { text: string }) => d.text,
        sizeUnits: "meters",
        getSize: (d: { uid: string; labelSize: number }) =>
          activeSectorUid != null && d.uid === activeSectorUid ? d.labelSize * 1.15 : d.labelSize,
        sizeMinPixels: 7,
        sizeMaxPixels: 22,
        getColor: (d: { uid: string }) => (activeSectorUid != null && d.uid === activeSectorUid ? LABEL_COLOR_ACTIVE : LABEL_COLOR_IDLE),
        getOutlineColor: [0, 0, 0, 200],
        getOutlineWidth: 2.2,
        getTextAnchor: "middle",
        getAlignmentBaseline: "center",
        fontFamily: "Tektur, Orbitron, sans-serif",
        billboard: false,
        updateTriggers: {
          getSize: [activeSectorUid],
          getColor: [activeSectorUid],
        },
      }),
    ];

    const buildMs =
      typeof performance !== "undefined" ? Math.max(0, performance.now() - buildStart) : 0;
    return { layers, buildMs };
  },
    [
      activeSectorUid,
      highlightedCell,
      asteroidIcons,
      flagSizePx,
      gridLines,
      intelIcons,
      markerSizePx,
      scanBadges,
      scanOffsetPx,
      sectorLabels,
      visibleSectorBoundaries,
      visibleSectorFillCells,
      systemPoints,
    ]
  );

  const perfSnapshot = useMemo(
    () => ({
      sectorsVisible: visibleSectorPolygons.length,
      sectorLabelsVisible: sectorLabels.length,
      systemsVisible: systemPoints.length,
      asteroidsVisible: asteroidIcons.length,
      intelVisible: intelIcons.length,
      scansVisible: scanBadges.length,
      layerBuildMs: layerPack.buildMs,
    }),
    [
      asteroidIcons.length,
      intelIcons.length,
      layerPack.buildMs,
      scanBadges.length,
      sectorLabels.length,
      systemPoints.length,
      visibleSectorPolygons.length,
    ]
  );

  const legendSections = useMemo(() => {
    const sections: Array<{ label: string; items: Array<{ key: LegendFilterKey; label: string; icon: string }> }> = [];
    sections.push({
      label: "Map",
      items: LEGEND_ITEMS.filter((item) => item.key === "system"),
    });

    if (canViewCellIntel) {
      sections.push({
        label: "Planetoids",
        items: LEGEND_ITEMS.filter((item) => item.key.startsWith("asteroid_")),
      });
      sections.push({
        label: "Intel Flags",
        items: LEGEND_ITEMS.filter((item) => ["ships", "stations", "notes"].includes(item.key)),
      });
    }

    if (canViewCellIntel || canViewScanWindow) {
      sections.push({
        label: "Scan Status",
        items: LEGEND_ITEMS.filter((item) => ["scanned", "rescan"].includes(item.key)),
      });
    }

    return sections.filter((section) => section.items.length > 0);
  }, [canViewCellIntel, canViewScanWindow]);

  const availableLegendKeys = useMemo(
    () => legendSections.flatMap((section) => section.items.map((item) => item.key)),
    [legendSections]
  );

  const hasAnyLegendFilterEnabled = useMemo(
    () => availableLegendKeys.some((key) => legendFilters[key]),
    [availableLegendKeys, legendFilters]
  );

  useEffect(() => {
    if (!legendOpen) {
      setLegendMaxHeight(null);
      setLegendShouldScroll(false);
      return;
    }
    const viewport = viewportRef.current;
    const legendBody = legendBodyRef.current;
    if (!viewport || !legendBody) {
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const legendRect = legendBody.getBoundingClientRect();
    const bottomPadding = 12;
    const availableHeight = Math.max(120, Math.floor(viewportRect.bottom - legendRect.top - bottomPadding));
    setLegendMaxHeight(availableHeight);
    setLegendShouldScroll(availableHeight > 0 && legendBody.scrollHeight > availableHeight);
  }, [availableLegendKeys.length, legendOpen]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!selectionDragRef.current || !viewportRef.current) return;
      const nextLeft = selectionDragRef.current.startLeft + (event.clientX - selectionDragRef.current.startClientX);
      const nextTop = selectionDragRef.current.startTop + (event.clientY - selectionDragRef.current.startClientY);
      const vw = viewportRef.current.clientWidth || 0;
      const vh = viewportRef.current.clientHeight || 0;
      setSelectionPanelPos({
        left: Math.min(Math.max(12, nextLeft), Math.max(12, vw - 232)),
        top: Math.min(Math.max(12, nextTop), Math.max(12, vh - 220)),
      });
    };
    const handleMouseUp = () => { selectionDragRef.current = null; };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    setNoteDraft(selectedCell?.annotation?.notes ?? "");
    setIntelDraft({
      planetoids_checked: selectedCell?.searchRecord?.planetoids_checked ?? null,
      planetoid_1_size: selectedCell?.searchRecord?.planetoid_1_size ?? "",
      planetoid_2_size: selectedCell?.searchRecord?.planetoid_2_size ?? "",
      has_ships: selectedCell?.searchRecord?.has_ships === true,
      has_stations: selectedCell?.searchRecord?.has_stations === true,
    });
    setIsEditingNote(false);
    setIsEditingIntel(false);
  }, [selectedCell]);

  useEffect(() => {
    const system = selectedCell?.systems[0] ?? null;
    const systemIdentifier = system?.identifier ?? system?.uid ?? null;

    if (!system || !systemIdentifier || !loadSystemDetail) {
      setSelectedSystemDetail(null);
      setSelectedSystemDetailLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setSelectedSystemDetailLoading(true);
        const detail = await loadSystemDetail(systemIdentifier);
        if (!cancelled) setSelectedSystemDetail(detail);
      } catch {
        if (!cancelled) setSelectedSystemDetail(null);
      } finally {
        if (!cancelled) setSelectedSystemDetailLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [loadSystemDetail, selectedCell?.systems[0]?.identifier, selectedCell?.systems[0]?.uid]);

  useEffect(() => {
    const body = selectionBodyRef.current;
    if (!body || !selectedCell) {
      setShowSelectionFade(false);
      return;
    }

    const updateFade = () => {
      const canScroll = body.scrollHeight - body.clientHeight > 2;
      const hasMoreBelow = body.scrollTop + body.clientHeight < body.scrollHeight - 2;
      setShowSelectionFade(canScroll && hasMoreBelow);
    };

    updateFade();
    body.addEventListener("scroll", updateFade, { passive: true });
    window.addEventListener("resize", updateFade);
    return () => {
      body.removeEventListener("scroll", updateFade);
      window.removeEventListener("resize", updateFade);
    };
  }, [selectedCell, isEditingIntel, isEditingNote, noteDraft, selectedSystemDetail, selectedSystemDetailLoading]);

  const selectedSystemSummary = useMemo(() => {
    if (!selectedSystemDetail) return null;

    const planets = selectedSystemDetail.planets ?? [];
    const stations = selectedSystemDetail.stations ?? [];
    const population = planets.reduce((sum, planet) => sum + (planet.population ?? 0), 0);
    const planetsWithPrev = planets.filter(
      (planet) => planet.previous_population !== null && planet.previous_population !== undefined
    );
    const previousPopulation =
      planetsWithPrev.length > 0
        ? planetsWithPrev.reduce((sum, planet) => sum + (planet.previous_population ?? 0), 0)
        : null;
    const counts = planets.reduce(
      (acc, planet) => { const kind = classifySystemBody(planet); acc[kind] += 1; return acc; },
      { planet: 0, moon: 0, sun: 0, asteroid: 0, comet: 0, black_hole: 0 }
    );
    const controller = (selectedSystemDetail.system.owner_name ?? "").trim() || "Unknown";
    const bodyPills = [
      ["Planets", counts.planet],
      ["Moons", counts.moon],
      ["Suns", counts.sun],
      ["Asteroids", counts.asteroid],
      ["Comets", counts.comet],
      ["Black Holes", counts.black_hole],
    ].filter(([, count]) => Number(count) > 0);

    return {
      controller,
      population,
      populationChange: formatPopulationDelta(population, previousPopulation),
      hasPopulationHistory: previousPopulation !== null,
      bodyPills,
      stations: stations.length,
      hyperlanes: selectedSystemDetail.hyperlanes.length,
    };
  }, [selectedSystemDetail]);

  const selectedCellPlanetoids = useMemo(
    () => getPlanetoidEntries(selectedCell?.searchRecord),
    [selectedCell?.searchRecord]
  );

  const selectedCellIntelPills = useMemo(() => {
    const pills: string[] = [];
    const oneByOneCount = selectedCellPlanetoids.filter((p) => p.size === "1x1").length;
    const twoByTwoCount = selectedCellPlanetoids.filter((p) => p.size === "2x2").length;
    if (oneByOneCount > 0) pills.push(`1x1 ${oneByOneCount}`);
    if (twoByTwoCount > 0) pills.push(`2x2 ${twoByTwoCount}`);
    if (selectedCell?.searchRecord?.planetoids_checked === false) pills.push("No Planetoids Found");
    if (selectedCell?.searchRecord?.has_ships) pills.push("Ships");
    if (selectedCell?.searchRecord?.has_stations) pills.push("Stations");
    return pills;
  }, [selectedCell?.searchRecord, selectedCellPlanetoids]);

  return (
    <section className="panel admin-card">
      <div className="admin-card__header">
        <h3 className="admin-card__title">Astrogation Chart</h3>
        <p className="admin-card__desc">
          Navigate sectors, inspect intel flags, and open location records.
        </p>
      </div>

      <div className="members-universe-map__meta">
        <span className="small">Zoom: {Math.max(0.01, Math.pow(2, viewState.zoom)).toFixed(2)}x</span>
      </div>

      <div
        ref={viewportRef}
        className="members-universe-map"
        onMouseLeave={() => scheduleHoverUpdate(null)}
      >
        <DeckGL
          style={{ position: "absolute", inset: "0px" }}
          views={orthoView}
          viewState={viewState}
          controller={deckController}
          layers={layerPack.layers}
          onViewStateChange={({ viewState: next }) => {
            const target = Array.isArray(next.target) ? next.target : null;
            const nextZoom = typeof next.zoom === "number" ? next.zoom : null;
            const rawZoom = nextZoom != null && Number.isFinite(nextZoom) ? nextZoom : viewState.zoom;
            const zoom = Math.min(CAMERA_ZOOM_MAX, Math.max(CAMERA_ZOOM_MIN, rawZoom));
            const zoomClamped = zoom !== rawZoom;
            // When zoom hits the floor/ceiling, keep the current target so the
            // map doesn't drift while the user keeps scrolling.
            const currentTarget = zoomClamped
              ? viewState.target
              : target
                ? [target[0], target[1], 0] as [number, number, number]
                : viewState.target;
            scheduleViewStateUpdate({
              target: currentTarget,
              zoom,
            });
            if (cameraChangeTimerRef.current != null) window.clearTimeout(cameraChangeTimerRef.current);
            cameraChangeTimerRef.current = window.setTimeout(() => {
              const galx = Math.floor(currentTarget[0]);
              const galy = Math.floor(currentTarget[1]);
              writeCameraToStorage(galx, galy, zoom);
              onCameraChange?.(galx, galy, zoom);
            }, 800);
          }}
          onHover={(info: PickingInfo<SectorPolygonDatum | SystemPointDatum>) => {
            const coordinate = info.coordinate as [number, number] | undefined;
            const galx = coordinate ? Math.floor(coordinate[0]) : null;
            const galy = coordinate ? Math.floor(coordinate[1]) : null;
            if (!info.object) {
              scheduleHoverUpdate(
                galx == null || galy == null
                  ? null
                  : {
                      x: info.x,
                      y: info.y,
                      galx,
                      galy,
                      title: null,
                      subtitle: null,
                    }
              );
              return;
            }
            const object = info.object as { name?: string | null; uid?: string | null; identifier?: string | null };
            scheduleHoverUpdate({
              x: info.x,
              y: info.y,
              galx,
              galy,
              title: object.name ?? object.uid ?? null,
              subtitle: object.identifier ?? null,
            });
          }}
          onClick={(info: PickingInfo<SectorPolygonDatum | SystemPointDatum>) => {
            const coordinate = info.coordinate as [number, number] | undefined;
            if (!coordinate) {
              return;
            }
            const galx = Math.floor(coordinate[0]);
            const galy = Math.floor(coordinate[1]);

            const now = Date.now();
            const last = lastClickRef.current;
            const isDoubleClick = last != null && last.galx === galx && last.galy === galy && now - last.time < 400;
            lastClickRef.current = isDoubleClick ? null : { galx, galy, time: now };

            if (isDoubleClick) {
              const sector = resolveSectorAt(galx, galy);
              if (sector.uid) onSelectSector?.(sector.uid);
              return;
            }

            setHighlightedCell({ galx, galy });
            const selectedSector = selectCellAt(galx, galy);

            const panelWidth = Math.min(320, Math.max(220, viewportSize.width - 24));
            const preferredLeft = info.x + 14;
            const preferredTop = info.y + 8;
            setSelectionPanelPos({
              left: Math.min(preferredLeft, Math.max(12, viewportSize.width - panelWidth - 12)),
              top: Math.min(Math.max(12, preferredTop), Math.max(12, viewportSize.height - 260)),
            });

            if (selectedSector.uid) {
              onSelectSector?.(selectedSector.uid);
            }
          }}
        />

        <div className={`members-universe-map__legend${legendOpen ? " is-open" : ""}`}>
          <button
            className="btn btn--small members-universe-map__legend-toggle"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setLegendOpen((current) => !current);
            }}
          >
            {legendOpen ? "Hide Legend" : "Show Legend"}
          </button>
          {legendOpen ? (
            <div
              ref={legendBodyRef}
              className="members-universe-map__legend-body"
              style={{
                maxHeight: legendMaxHeight ? `${legendMaxHeight}px` : undefined,
                overflowY: legendShouldScroll ? "auto" : "visible",
              }}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onWheelCapture={(event) => event.stopPropagation()}
            >
              {availableLegendKeys.length > 1 ? (
                <div className="members-universe-map__legend-actions">
                  <button
                    type="button"
                    className="btn btn--small members-universe-map__legend-action"
                    onClick={() =>
                      setLegendFilters((current) => {
                        const nextValue = !hasAnyLegendFilterEnabled;
                        const updates = Object.fromEntries(
                          availableLegendKeys.map((key) => [key, nextValue])
                        ) as Partial<LegendFilters>;
                        return { ...current, ...updates };
                      })
                    }
                  >
                    {hasAnyLegendFilterEnabled ? "Unselect All" : "Select All"}
                  </button>
                </div>
              ) : null}
              {legendSections.map((section) => (
                <React.Fragment key={section.label}>
                  <div className="members-universe-map__legend-section-label small">{section.label}</div>
                  {section.items.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      className={`members-universe-map__legend-item${legendFilters[item.key] ? " is-active" : ""}`}
                      aria-pressed={legendFilters[item.key]}
                      onClick={() => setLegendFilters((current) => ({ ...current, [item.key]: !current[item.key] }))}
                    >
                      {isImageIcon(item.icon) ? (
                        <img className="members-universe-map__legend-icon" src={item.icon} alt="" />
                      ) : (
                        <span className="members-universe-map__legend-icon">{item.icon}</span>
                      )}
                      <span className="small">{item.label}</span>
                    </button>
                  ))}
                </React.Fragment>
              ))}
            </div>
          ) : null}
        </div>

        {controlsOverlay ? (
          <div className={`members-universe-map__controls-panel${controlsOpen ? " is-open" : ""}`}>
            <button
              className="btn btn--small members-universe-map__controls-toggle"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setControlsOpen((current) => !current);
              }}
            >
              {controlsOpen ? "Hide Controls" : "Show Controls"}
            </button>
            {controlsOpen ? (
              <div
                className="members-universe-map__controls-body"
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => event.stopPropagation()}
                onWheelCapture={(event) => event.stopPropagation()}
              >
                {controlsOverlay}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="members-universe-map__stars" />

        {showPerfDebug ? (
          <div
            className="members-universe-map__status"
            style={PERF_DEBUG_STYLE}
          >
            <span className="small">Perf Debug</span>
            <span className="small">Sectors: {perfSnapshot.sectorsVisible}</span>
            <span className="small">Labels: {perfSnapshot.sectorLabelsVisible}</span>
            <span className="small">Systems: {perfSnapshot.systemsVisible}</span>
            <span className="small">Asteroids: {perfSnapshot.asteroidsVisible}</span>
            <span className="small">Intel: {perfSnapshot.intelVisible}</span>
            <span className="small">Scans: {perfSnapshot.scansVisible}</span>
            <span className="small">Layer Build: {perfSnapshot.layerBuildMs.toFixed(2)}ms</span>
          </div>
        ) : null}

        {hover ? (
          <div
            className="members-universe-map__hover"
            style={{
              left: `${Math.min(
                hover.x + HOVER_OFFSET_PX,
                (viewportRef.current?.clientWidth ?? hover.x + HOVER_OFFSET_PX) - HOVER_WIDTH_PX
              )}px`,
              top: `${Math.min(
                hover.y + HOVER_OFFSET_PX,
                (viewportRef.current?.clientHeight ?? hover.y + HOVER_OFFSET_PX) - HOVER_HEIGHT_PX
              )}px`,
            }}
          >
            <strong>{hover.galx},{hover.galy}</strong>
            {hover.title ? <span>{hover.title}</span> : null}
            {hover.subtitle ? <span>{hover.subtitle}</span> : null}
          </div>
        ) : null}

        {selectedCell ? (
          <div
            className={`members-universe-map__selection${showSelectionFade ? " is-scrollable" : ""}`}
            style={selectionPanelPos ? { position: "absolute", left: `${selectionPanelPos.left}px`, top: `${selectionPanelPos.top}px`, maxWidth: "min(320px, calc(100% - 24px))" } : undefined}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="members-universe-map__selection-head"
              style={{ cursor: "grab" }}
              onMouseDown={(event) => {
                event.stopPropagation();
                const panel = event.currentTarget.parentElement;
                if (!panel) return;
                const left = Number.parseFloat(panel.style.left || "0");
                const top = Number.parseFloat(panel.style.top || "0");
                selectionDragRef.current = {
                  startClientX: event.clientX,
                  startClientY: event.clientY,
                  startLeft: left,
                  startTop: top,
                };
              }}
            >
              <div className="members-universe-map__selection-copy">
                <strong>{selectedCell.galx}, {selectedCell.galy}</strong>
                {selectedCell.sectorUid ? (
                  <span className="members-universe-map__selection-label">
                    {selectedCell.sectorName ?? `Sector ${formatSwcDisplayId(selectedCell.sectorUid) ?? selectedCell.sectorUid}`}
                  </span>
                ) : null}
                {getPrimaryCellName(selectedCell.systems[0], selectedCell.searchRecord, canViewCellIntel) ? (
                  <span className="members-universe-map__selection-label">
                    {getPrimaryCellName(selectedCell.systems[0], selectedCell.searchRecord, canViewCellIntel)}
                  </span>
                ) : null}
              </div>
              <div className="members-universe-map__selection-head-actions">
                <button
                  className="members-universe-map__selection-close"
                  type="button"
                  onClick={() => { setSelectedCell(null); setHighlightedCell(null); }}
                  aria-label="Clear selected grid cell"
                >
                  <span className="members-universe-map__selection-close-glyph" aria-hidden="true">×</span>
                </button>
              </div>
            </div>

            <div
              className="members-universe-map__selection-body"
              ref={selectionBodyRef}
              onWheelCapture={(event) => event.stopPropagation()}
            >
              {selectedCell.annotation?.label ? (
                <span className="small">{selectedCell.annotation.label}</span>
              ) : null}
              {selectedCell.searchRecord?.is_system_searched || selectedCell.searchRecord?.has_asteroids ? (
                <div className="members-universe__meta">
                  {selectedCell.searchRecord?.is_system_searched ? (
                    <span className="admin-badge admin-badge--soft">Searched</span>
                  ) : null}
                  {selectedCell.searchRecord?.has_asteroids ? (
                    <span className="admin-badge admin-badge--soft">Asteroids</span>
                  ) : null}
                </div>
              ) : null}
              {(selectedCell.searchRecord?.legacy_player ?? selectedCell.searchRecord?.handle) ? (
                <span className="small">Last scanned by: {selectedCell.searchRecord!.legacy_player ?? selectedCell.searchRecord!.handle}</span>
              ) : null}
              {selectedCell.searchRecord?.has_asteroids && selectedCell.searchRecord?.asteroid_uid ? (
                <span className="small">
                  Asteroid UID: {formatAsteroidUid(selectedCell.searchRecord.asteroid_uid)}
                </span>
              ) : null}
              {(() => {
                const rec = selectedCell.searchRecord;
                const scanDate = rec?.legacy_recorded_at ?? (rec?.is_system_searched ? rec?.updated_at : null);
                const age = formatRelativeAge(scanDate);
                return age ? <span className="small">{age}</span> : null;
              })()}
              {selectedCellIntelPills.length > 0 ? (
                <div className="members-universe__meta">
                  {selectedCellIntelPills.map((pill) => (
                    <span key={pill} className="admin-badge admin-badge--soft">{pill}</span>
                  ))}
                </div>
              ) : null}
              {selectedCell.systems[0] ? (
                <div className="members-universe-map__selection-system">
                  {selectedSystemDetailLoading ? (
                    <span className="small">Loading system stats...</span>
                  ) : selectedSystemSummary ? (
                    <>
                      <div className="members-universe-map__selection-stats">
                        <span className="small">{selectedSystemSummary.controller}</span>
                        <span className="small">
                          Population:{" "}
                          <span className="members-universe-map__selection-stat-value">
                            {selectedSystemSummary.population.toLocaleString()}
                          </span>
                        </span>
                        {selectedSystemSummary.hasPopulationHistory ? (
                          <span className="small">Change: {selectedSystemSummary.populationChange}</span>
                        ) : null}
                      </div>
                      <div className="members-universe__meta">
                        {selectedSystemSummary.bodyPills.map(([label, count]) => (
                          <span key={String(label)} className="admin-badge admin-badge--soft">
                            {label} {count}
                          </span>
                        ))}
                        <span className="admin-badge admin-badge--soft">Stations {selectedSystemSummary.stations}</span>
                        <span className="admin-badge admin-badge--soft">Hyperlanes {selectedSystemSummary.hyperlanes}</span>
                      </div>
                    </>
                  ) : (
                    <span className="small">No stored system stats yet.</span>
                  )}
                </div>
              ) : null}
              {canViewCellIntel && selectedCell.annotation?.notes ? (
                <BBCodeView
                  value={selectedCell.annotation.notes}
                  className="small members-universe-map__note-body"
                />
              ) : null}
              {canEditCellIntel ? (
                <div className="members-universe-map__intel-editor">
                  {isEditingIntel ? (
                    <>
                      <div className="members-universe-map__intel-grid">
                        <label className="members-universe-map__intel-field">
                          <span className="small">Planetoids</span>
                          <select
                            className="input"
                            value={intelDraft.planetoids_checked === null ? "" : intelDraft.planetoids_checked ? "yes" : "no"}
                            onChange={(event) => {
                              const value = event.target.value;
                              setIntelDraft((current) => ({
                                ...current,
                                planetoids_checked: value === "" ? null : value === "yes",
                                planetoid_1_size: value === "yes" ? current.planetoid_1_size : "",
                                planetoid_2_size: value === "yes" ? current.planetoid_2_size : "",
                              }));
                            }}
                          >
                            <option value="">Unknown</option>
                            <option value="yes">Planetoids present</option>
                            <option value="no">No planetoids found</option>
                          </select>
                        </label>
                        <label className="members-universe-map__intel-check">
                          <input
                            type="checkbox"
                            checked={intelDraft.has_ships}
                            onChange={(event) =>
                              setIntelDraft((current) => ({ ...current, has_ships: event.target.checked }))
                            }
                          />
                          <span>Has Ships</span>
                        </label>
                        <label className="members-universe-map__intel-check">
                          <input
                            type="checkbox"
                            checked={intelDraft.has_stations}
                            onChange={(event) =>
                              setIntelDraft((current) => ({ ...current, has_stations: event.target.checked }))
                            }
                          />
                          <span>Has Stations</span>
                        </label>
                      </div>
                      {intelDraft.planetoids_checked === true ? (
                        <div className="members-universe-map__intel-grid">
                          <label className="members-universe-map__intel-field">
                            <span className="small">Planetoid 1 Size</span>
                            <select
                              className="input"
                              value={intelDraft.planetoid_1_size}
                              onChange={(event) =>
                                setIntelDraft((current) => ({
                                  ...current,
                                  planetoid_1_size: event.target.value as "" | "1x1" | "2x2",
                                }))
                              }
                            >
                              <option value="">None</option>
                              <option value="1x1">1x1</option>
                              <option value="2x2">2x2</option>
                            </select>
                          </label>
                          <label className="members-universe-map__intel-field">
                            <span className="small">Planetoid 2 Size</span>
                            <select
                              className="input"
                              value={intelDraft.planetoid_2_size}
                              onChange={(event) =>
                                setIntelDraft((current) => ({
                                  ...current,
                                  planetoid_2_size: event.target.value as "" | "1x1" | "2x2",
                                }))
                              }
                            >
                              <option value="">None</option>
                              <option value="1x1">1x1</option>
                              <option value="2x2">2x2</option>
                            </select>
                          </label>
                        </div>
                      ) : null}
                      <div className="members-universe__inline">
                        <button
                          className="btn btn--small btn--ghost"
                          type="button"
                          disabled={!onSaveSearchRecord || savingIntel}
                          onClick={async () => {
                            if (!onSaveSearchRecord || !selectedCell) return;
                            const twoByTwoCount = [intelDraft.planetoid_1_size, intelDraft.planetoid_2_size].filter((v) => v === "2x2").length;
                            if (twoByTwoCount > 1) {
                              window.alert("Only one 2x2 planetoid can be set per cell.");
                              return;
                            }
                            setSavingIntel(true);
                            try {
                              const saved = await onSaveSearchRecord({
                                sector_uid: selectedCell.sectorUid,
                                galx: selectedCell.galx,
                                galy: selectedCell.galy,
                                planetoids_checked: intelDraft.planetoids_checked,
                                planetoid_1_size: intelDraft.planetoid_1_size || null,
                                planetoid_2_size: intelDraft.planetoid_2_size || null,
                                has_ships: intelDraft.has_ships,
                                has_stations: intelDraft.has_stations,
                              });
                              setSelectedCell((current) =>
                                current ? { ...current, searchRecord: saved } : current
                              );
                              setIsEditingIntel(false);
                            } finally {
                              setSavingIntel(false);
                            }
                          }}
                        >
                          {savingIntel ? "Saving..." : "Save Cell"}
                        </button>
                        <button
                          className="btn btn--small btn--ghost"
                          type="button"
                          disabled={savingIntel}
                          onClick={() => setIsEditingIntel(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      className="btn btn--small btn--ghost"
                      type="button"
                      onClick={() => setIsEditingIntel(true)}
                    >
                      Edit Cell
                    </button>
                  )}
                </div>
              ) : null}
              {canViewCellIntel ? (
                <div className="members-universe__inline">
                  <button
                    className="btn btn--small"
                    type="button"
                    disabled={!selectedCell.sectorUid || !onSaveAnnotation}
                    onClick={() => setIsEditingNote((current) => !current)}
                  >
                    {isEditingNote
                      ? "Close Editor"
                      : selectedCell.annotation?.notes
                        ? "Edit Note"
                        : "Add Note"}
                  </button>
                  {selectedCell.annotation?.notes ? (
                    <button
                      className="btn btn--small"
                      type="button"
                      disabled={!selectedCell.sectorUid || !onSaveAnnotation || savingNote}
                      onClick={async () => {
                        if (!selectedCell.sectorUid || !onSaveAnnotation) return;
                        setSavingNote(true);
                        try {
                          await onSaveAnnotation({
                            sector_uid: selectedCell.sectorUid,
                            galx: selectedCell.galx,
                            galy: selectedCell.galy,
                            notes: null,
                          });
                          setNoteDraft("");
                          setSelectedCell((current) =>
                            current ? { ...current, annotation: null } : current
                          );
                          setIsEditingNote(false);
                        } finally {
                          setSavingNote(false);
                        }
                      }}
                    >
                      Clear Note
                    </button>
                  ) : null}
                </div>
              ) : null}
              {canViewCellIntel && isEditingNote ? (
                <>
                  <div className="members-universe-map__note-toolbar">
                    <button className="btn btn--tiny" type="button" onClick={() => wrapTextareaSelection(noteTextareaRef.current, noteDraft, setNoteDraft, "[b]", "[/b]")}>B</button>
                    <button className="btn btn--tiny" type="button" onClick={() => wrapTextareaSelection(noteTextareaRef.current, noteDraft, setNoteDraft, "[i]", "[/i]")}>I</button>
                    <button className="btn btn--tiny" type="button" onClick={() => wrapTextareaSelection(noteTextareaRef.current, noteDraft, setNoteDraft, "[u]", "[/u]")}>U</button>
                  </div>
                  <textarea
                    ref={noteTextareaRef}
                    className="input"
                    rows={4}
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="Add a note for this grid cell"
                  />
                  {noteDraft.trim() ? (
                    <div className="members-universe-map__note-preview">
                      <span className="small">Preview</span>
                      <BBCodeView value={noteDraft} className="small members-universe-map__note-body" />
                    </div>
                  ) : null}
                  <div className="members-universe__inline">
                    <button
                      className="btn btn--small"
                      type="button"
                      disabled={!selectedCell.sectorUid || !onSaveAnnotation || savingNote}
                      onClick={async () => {
                        if (!selectedCell.sectorUid || !onSaveAnnotation) return;
                        setSavingNote(true);
                        try {
                          const saved = await onSaveAnnotation({
                            sector_uid: selectedCell.sectorUid,
                            galx: selectedCell.galx,
                            galy: selectedCell.galy,
                            notes: noteDraft || null,
                          });
                          setSelectedCell((current) =>
                            current ? { ...current, annotation: saved } : current
                          );
                          setIsEditingNote(false);
                        } finally {
                          setSavingNote(false);
                        }
                      }}
                    >
                      {savingNote ? "Saving..." : "Save Note"}
                    </button>
                  </div>
                </>
              ) : null}
              {canViewCellIntel && !selectedCell.annotation?.notes && !noteDraft ? (
                <span className="small">No note on this grid cell.</span>
              ) : null}
              {selectedCell.systems[0] ? (
                <button
                  className="btn btn--small"
                  type="button"
                  onClick={() => {
                    const system = selectedCell.systems[0];
                    const identifier = system?.identifier ?? system?.uid ?? null;
                    if (!system || !identifier || !onSystemSelect) return;
                    onSystemSelect(identifier, system.sector_uid ?? selectedCell.sectorUid);
                  }}
                >
                  Open {selectedCell.systems[0].name ?? selectedCell.systems[0].identifier ?? "System"}
                </button>
              ) : (
                <button
                  className="btn btn--small"
                  type="button"
                  onClick={() => onLocationSelect?.(selectedCell.galx, selectedCell.galy, selectedCell.sectorUid)}
                >
                  Open Location
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default DeckGalaxyMap;
