import React, { useEffect, useMemo, useRef, useState } from "react";
import systemIconUrl from "../../assets/map/SystemIcon.png";
import asteroidFieldIconUrl from "../../assets/map/AsteroidFieldIcon.png";
import asteroidFieldIconUnknownUrl from "../../assets/map/AsteroidFieldIconUnknown.png";
import asteroidFieldIcon1x1Url from "../../assets/map/AsteroidFieldIcon1x1.png";
import asteroidFieldIcon1x1DoubleUrl from "../../assets/map/AsteroidFieldIcon1x1-2.png";
import asteroidFieldIcon1x1And2x2Url from "../../assets/map/AsteroidFieldIcon1x1and2x2.png";
import asteroidFieldIcon2x2Url from "../../assets/map/AsteroidFieldIcon2x2.png";
import scannedDuelconUrl from "../../assets/map/ScannedDuelcon.png";
import rescanDueIconUrl from "../../assets/map/RescanDueIcon.png";
import shipsDuelconUrl from "../../assets/map/ShipsDuelcon.png";
import stationsDuelconUrl from "../../assets/map/StationsDuelcon.png";
import type {
  SectorCellAnnotation,
  SectorSearchRecord,
  StoredMapSystem,
  StoredSectorSummary,
  StoredSystemDetail,
} from "../../api/universe";
import {
  formatTimestampAsCgt,
  getCgtTime,
  type CgtResponse,
} from "../../api/time";
import BBCodeView from "../bbcode/BBCodeView";

type FocusRequest =
  | {
      kind: "sector";
      sectorUid: string;
      nonce: number;
      zoom?: number;
    }
  | {
      kind: "coords";
      galx: number;
      galy: number;
      nonce: number;
      zoom?: number;
    };

type GalaxySectorMapProps = {
  sectors: StoredSectorSummary[];
  systemMarkers?: StoredMapSystem[];
  activeSectorUid?: string | null;
  onSelectSector?: (sectorUid: string) => void;
  annotations?: SectorCellAnnotation[];
  loadedAnnotationSectorUids?: string[];
  searchRecords?: SectorSearchRecord[];
  onSystemSelect?: (systemIdentifier: string, sectorUid?: string | null) => void;
  onSaveAnnotation?: (payload: {
    sector_uid: string;
    galx: number;
    galy: number;
    notes?: string | null;
  }) => Promise<SectorCellAnnotation | null> | SectorCellAnnotation | null;
  onSaveSearchRecord?: (payload: {
    sector_uid?: string | null;
    galx: number;
    galy: number;
    planetoids_checked?: boolean | null;
    planetoid_1_type?: string | null;
    planetoid_1_size?: "1x1" | "2x2" | null;
    planetoid_2_type?: string | null;
    planetoid_2_size?: "1x1" | "2x2" | null;
    has_ships?: boolean | null;
    has_stations?: boolean | null;
  }) => Promise<SectorSearchRecord> | SectorSearchRecord;
  ensureSectorAnnotationsLoaded?: (sectorUid: string) => Promise<SectorCellAnnotation[]>;
  canViewCellIntel?: boolean;
  canViewScanWindow?: boolean;
  canEditCellIntel?: boolean;
  loadSystemDetail?: (systemIdentifier: string) => Promise<StoredSystemDetail | null>;
  focusRequest?: FocusRequest | null;
  onClearFocusRequest?: () => void;
  controlsOverlay?: React.ReactNode;
};

type Offset = {
  x: number;
  y: number;
};

type ViewportSize = {
  width: number;
  height: number;
};

type HoverInfo = {
  galx: number;
  galy: number;
  screenX: number;
  screenY: number;
  sectorName: string | null;
  systemName: string | null;
};

type SelectedCellInfo = {
  galx: number;
  galy: number;
  sectorUid: string | null;
  sectorName: string | null;
  system: StoredMapSystem | null;
  searchRecord: SectorSearchRecord | null;
  annotation:
    | SectorCellAnnotation
    | null;
};

type SectorCell = {
  galx: number;
  galy: number;
};

type BoundarySegment = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type PreparedSector = StoredSectorSummary & {
  centerGalx: number;
  centerGaly: number;
  labelGalx: number;
  labelGaly: number;
  polygon: SectorCell[];
  cells: SectorCell[];
  boundarySegments: BoundarySegment[];
};

type ScanBadgeMarker = {
  key: string;
  left: number;
  top: number;
  size: number;
  kind: "scanned" | "rescan";
};

type PlanetoidEntry = {
  size: "1x1" | "2x2";
};

type AsteroidMarker = {
  key: string;
  left: number;
  top: number;
  size: number;
  record: SectorSearchRecord;
  planetoids: PlanetoidEntry[];
};

type IntelFlagMarker = {
  key: string;
  left: number;
  top: number;
  size: number;
  hasShips: boolean;
  hasStations: boolean;
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
  scanned: true,
  rescan: true,
};

type LegendEntry = {
  key: LegendFilterKey;
  label: string;
  icon: string;
};

const CELL_SIZE = 18;
const VIEW_PADDING = 32;
const GRID_VISIBILITY_THRESHOLD = 1.25;
const DRAG_THRESHOLD = 4;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;

type SystemBodyKind = "sun" | "moon" | "asteroid" | "comet" | "black_hole" | "planet";

function formatSwcDisplayId(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [prefix, rest] = value.split(":", 2);
  if (rest && /^\d+$/.test(prefix)) {
    return rest;
  }

  return value;
}

function formatPopulationDelta(current: number, previous: number | null) {
  if (previous === null) {
    return "0";
  }

  const delta = current - previous;
  const prefix = delta > 0 ? "+" : "";

  return `${prefix}${delta.toLocaleString()}`;
}

function formatRelativeAge(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestampMs = new Date(value).getTime();

  if (Number.isNaN(timestampMs)) {
    return null;
  }

  const elapsedMs = Math.max(0, Date.now() - timestampMs);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const monthMs = 30 * dayMs;
  const yearMs = 365 * dayMs;

  if (elapsedMs >= yearMs) {
    const years = Math.floor(elapsedMs / yearMs);
    return `${years} year${years === 1 ? "" : "s"} ago`;
  }

  if (elapsedMs >= monthMs) {
    const months = Math.floor(elapsedMs / monthMs);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }

  if (elapsedMs >= dayMs) {
    const days = Math.floor(elapsedMs / dayMs);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  if (elapsedMs >= hourMs) {
    const hours = Math.floor(elapsedMs / hourMs);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const minutes = Math.max(1, Math.floor(elapsedMs / minuteMs));

  return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}

function findSectorLabelCell(cells: SectorCell[], centerGalx: number, centerGaly: number): SectorCell | null {
  if (!cells.length) {
    return null;
  }

  const cellMap = new Map<string, SectorCell>();
  const edgeQueue: SectorCell[] = [];
  const distanceByKey = new Map<string, number>();
  const neighborOffsets = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1],
  ] as const;

  for (const cell of cells) {
    cellMap.set(`${cell.galx}:${cell.galy}`, cell);
  }

  for (const cell of cells) {
    const isEdge = neighborOffsets.some(([dx, dy]) => !cellMap.has(`${cell.galx + dx}:${cell.galy + dy}`));

    if (isEdge) {
      const key = `${cell.galx}:${cell.galy}`;
      distanceByKey.set(key, 0);
      edgeQueue.push(cell);
    }
  }

  while (edgeQueue.length > 0) {
    const cell = edgeQueue.shift()!;
    const key = `${cell.galx}:${cell.galy}`;
    const baseDistance = distanceByKey.get(key) ?? 0;

    for (const [dx, dy] of neighborOffsets) {
      const nextKey = `${cell.galx + dx}:${cell.galy + dy}`;
      const nextCell = cellMap.get(nextKey);
      if (!nextCell || distanceByKey.has(nextKey)) {
        continue;
      }

      distanceByKey.set(nextKey, baseDistance + 1);
      edgeQueue.push(nextCell);
    }
  }

  let best = cells[0];
  let bestDepth = -1;
  let bestCenterDistance = Number.POSITIVE_INFINITY;

  for (const cell of cells) {
    const key = `${cell.galx}:${cell.galy}`;
    const depth = distanceByKey.get(key) ?? 0;
    const dx = cell.galx - centerGalx;
    const dy = cell.galy - centerGaly;
    const centerDistance = dx * dx + dy * dy;

    if (depth > bestDepth || (depth === bestDepth && centerDistance < bestCenterDistance)) {
      best = cell;
      bestDepth = depth;
      bestCenterDistance = centerDistance;
    }
  }

  return best;
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
    entries.push({
      size: record.planetoid_1_size,
    });
  }

  if (record.planetoid_2_size) {
    entries.push({
      size: record.planetoid_2_size,
    });
  }

  return entries;
}

function getAsteroidMarkerIcon(planetoids: PlanetoidEntry[], planetoidsChecked: boolean | null | undefined) {
  if (planetoids.length === 1) {
    return planetoids[0].size === "2x2"
      ? asteroidFieldIcon2x2Url
      : asteroidFieldIcon1x1Url;
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

function getSearchRecordSquareName(record: SectorSearchRecord | null | undefined) {
  const value = record?.square_name?.trim();
  return value ? value : null;
}

function getPrimaryCellName(
  system: StoredMapSystem | null | undefined,
  record: SectorSearchRecord | null | undefined,
  canViewCellIntel: boolean
) {
  const importedName = getSearchRecordSquareName(record);

  if (canViewCellIntel && record?.has_asteroids && importedName) {
    return importedName;
  }

  return (
    system?.name
    ?? system?.identifier
    ?? formatSwcDisplayId(system?.uid)
    ?? (canViewCellIntel ? importedName : null)
    ?? null
  );
}

function isEventImportedSearchRecord(record: SectorSearchRecord | null | undefined) {
  if (!record) {
    return false;
  }

  return Boolean(record.square_name || record.has_asteroids);
}

function wrapTextareaSelection(
  textarea: HTMLTextAreaElement | null,
  value: string,
  setValue: (value: string) => void,
  openTag: string,
  closeTag: string
) {
  if (!textarea) {
    setValue(`${value}${openTag}${closeTag}`);
    return;
  }

  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  const selected = value.slice(start, end);
  const next =
    value.slice(0, start) +
    openTag +
    selected +
    closeTag +
    value.slice(end);

  setValue(next);

  requestAnimationFrame(() => {
    textarea.focus();
    const selectionStart = start + openTag.length;
    const selectionEnd = selectionStart + selected.length;
    textarea.setSelectionRange(selectionStart, selectionEnd);
  });
}

function snapZoom(value: number) {
  return Number((Math.round(value / ZOOM_STEP) * ZOOM_STEP).toFixed(2));
}

function drawCenteredMapMarkers(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  markers: Array<{ galx: number | null; galy: number | null }>,
  worldBounds: { minX: number; maxY: number },
  offset: Offset,
  zoom: number,
  viewportSize: ViewportSize
) {
  const markerSize = Math.max(5, CELL_SIZE * zoom * 0.72);

  for (const marker of markers) {
    if (marker.galx == null || marker.galy == null) {
      continue;
    }

    const center = worldCellCenter(
      Number(marker.galx),
      Number(marker.galy),
      worldBounds.minX,
      worldBounds.maxY
    );
    const markerX = offset.x + center.x * zoom;
    const markerY = offset.y + center.y * zoom;

    if (
      markerX < -markerSize ||
      markerX > viewportSize.width + markerSize ||
      markerY < -markerSize ||
      markerY > viewportSize.height + markerSize
    ) {
      continue;
    }

    context.drawImage(
      image,
      markerX - markerSize / 2,
      markerY - markerSize / 2,
      markerSize,
      markerSize
    );
  }
}

function classifySystemBody(planet: StoredSystemDetail["planets"][number]): SystemBodyKind {
  const planetType = String(planet.planet_type_name ?? "").trim().toLowerCase();

  if (planetType === "sun") {
    return "sun";
  }

  if (planetType === "asteroid field") {
    return "asteroid";
  }

  if (planetType === "moon") {
    return "moon";
  }

  if (planetType === "comet") {
    return "comet";
  }

  if (planetType === "black hole") {
    return "black_hole";
  }

  return "planet";
}

function bresenham(x0: number, y0: number, x1: number, y1: number): SectorCell[] {
  const points: SectorCell[] = [];
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  let sx = x0 < x1 ? 1 : -1;
  let sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let currentX = x0;
  let currentY = y0;

  while (true) {
    points.push({ galx: currentX, galy: currentY });

    if (currentX === x1 && currentY === y1) {
      break;
    }

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      currentX += sx;
    }
    if (e2 < dx) {
      err += dx;
      currentY += sy;
    }
  }

  return points;
}

function expandOutlinePoints(points: SectorCell[]) {
  if (points.length === 0) return [];

  const expanded: SectorCell[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];

    for (const point of bresenham(current.galx, current.galy, next.galx, next.galy)) {
      expanded.push(point);
    }
  }

  return expanded;
}

function pointInPolygon(
  x: number,
  y: number,
  polygon: Array<{ galx: number; galy: number }>
) {
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].galx;
    const yi = polygon[i].galy;
    const xj = polygon[j].galx;
    const yj = polygon[j].galy;

    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;

    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function cellOverlapsPolygon(
  galx: number,
  galy: number,
  polygon: Array<{ galx: number; galy: number }>
) {
  const samplePoints = [
    [galx + 0.5, galy + 0.5],
    [galx + 0.15, galy + 0.15],
    [galx + 0.85, galy + 0.15],
    [galx + 0.15, galy + 0.85],
    [galx + 0.85, galy + 0.85],
  ];

  const hits = samplePoints.filter(([x, y]) => pointInPolygon(x, y, polygon)).length;

  return hits >= 3;
}

function buildSectorCells(
  polygon: Array<{ galx: number; galy: number }>,
  bounds: StoredSectorSummary["bounds"]
) {
  const areaSet = new Set<string>();
  const expandedOutline = expandOutlinePoints(polygon);

  if (bounds && polygon.length >= 3) {
    for (let galx = bounds.min_galx; galx <= bounds.max_galx; galx += 1) {
      for (let galy = bounds.min_galy; galy <= bounds.max_galy; galy += 1) {
        if (cellOverlapsPolygon(galx, galy, polygon)) {
          areaSet.add(`${galx}:${galy}`);
        }
      }
    }
  }

  for (const point of expandedOutline) {
    areaSet.add(`${point.galx}:${point.galy}`);
  }

  return Array.from(areaSet, (key) => {
    const [galx, galy] = key.split(":").map(Number);
    return { galx, galy };
  });
}

function buildBoundarySegments(cells: SectorCell[]): BoundarySegment[] {
  const cellSet = new Set(cells.map((cell) => `${cell.galx}:${cell.galy}`));
  const segments: BoundarySegment[] = [];

  for (const cell of cells) {
    const { galx, galy } = cell;

    if (!cellSet.has(`${galx}:${galy + 1}`)) {
      segments.push({ x1: galx, y1: galy, x2: galx + 1, y2: galy });
    }
    if (!cellSet.has(`${galx + 1}:${galy}`)) {
      segments.push({ x1: galx + 1, y1: galy, x2: galx + 1, y2: galy - 1 });
    }
    if (!cellSet.has(`${galx}:${galy - 1}`)) {
      segments.push({ x1: galx, y1: galy - 1, x2: galx + 1, y2: galy - 1 });
    }
    if (!cellSet.has(`${galx - 1}:${galy}`)) {
      segments.push({ x1: galx, y1: galy, x2: galx, y2: galy - 1 });
    }
  }

  return segments;
}

function healOwnershipGaps(
  ownership: Map<string, string>,
  sectors: PreparedSector[],
  worldBounds: { minX: number; maxX: number; minY: number; maxY: number } | null
) {
  if (!worldBounds) {
    return ownership;
  }

  const healed = new Map(ownership);
  const sectorByUid = new Map(sectors.map((sector) => [sector.uid, sector]));
  const deltas = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ] as const;

  let changed = true;
  let passes = 0;

  while (changed && passes < 3) {
    changed = false;
    passes += 1;
    const pending: Array<{ key: string; uid: string }> = [];

    for (let galx = worldBounds.minX; galx <= worldBounds.maxX; galx += 1) {
      for (let galy = worldBounds.minY; galy <= worldBounds.maxY; galy += 1) {
        const key = `${galx}:${galy}`;
        if (healed.has(key)) {
          continue;
        }

        const neighborCounts = new Map<string, number>();

        for (const [dx, dy] of deltas) {
          const neighborUid = healed.get(`${galx + dx}:${galy + dy}`);
          if (!neighborUid) {
            continue;
          }

          neighborCounts.set(neighborUid, (neighborCounts.get(neighborUid) ?? 0) + 1);
        }

        const winner = Array.from(neighborCounts.entries()).sort((left, right) => {
          if (left[1] !== right[1]) {
            return right[1] - left[1];
          }

          return left[0].localeCompare(right[0]);
        })[0];

        if (!winner || winner[1] < 3) {
          continue;
        }

        const sector = sectorByUid.get(winner[0]);
        if (!sector) {
          continue;
        }

        if (sector.bounds) {
          if (
            galx < sector.bounds.min_galx ||
            galx > sector.bounds.max_galx ||
            galy < sector.bounds.min_galy ||
            galy > sector.bounds.max_galy
          ) {
            continue;
          }
        }

        pending.push({ key, uid: winner[0] });
      }
    }

    for (const entry of pending) {
      healed.set(entry.key, entry.uid);
      changed = true;
    }
  }

  return healed;
}

function worldPoint(galx: number, galy: number, minX: number, maxY: number) {
  return {
    x: (galx - minX) * CELL_SIZE,
    y: (maxY - galy) * CELL_SIZE,
  };
}

function worldCellCenter(galx: number, galy: number, minX: number, maxY: number) {
  const origin = worldPoint(galx, galy, minX, maxY);

  return {
    x: origin.x + CELL_SIZE / 2,
    y: origin.y + CELL_SIZE / 2,
  };
}

function alignCanvasStroke(value: number) {
  return Math.round(value) + 0.5;
}

function fitWorldToViewport(
  viewport: HTMLDivElement | null,
  worldWidth: number,
  worldHeight: number
) {
  if (!viewport || worldWidth <= 0 || worldHeight <= 0) {
    return {
      zoom: 1,
      offset: { x: 0, y: 0 } satisfies Offset,
    };
  }

  const viewportWidth = viewport.clientWidth || 1;
  const viewportHeight = viewport.clientHeight || 1;
  const scaleX = (viewportWidth - VIEW_PADDING * 2) / worldWidth;
  const scaleY = (viewportHeight - VIEW_PADDING * 2) / worldHeight;
  const zoom = Math.min(2.6, Math.max(MIN_ZOOM, snapZoom(Math.min(scaleX, scaleY))));

  return {
    zoom,
    offset: {
      x: (viewportWidth - worldWidth * zoom) / 2,
      y: (viewportHeight - worldHeight * zoom) / 2,
    } satisfies Offset,
  };
}

function hashString(value: string): number {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function themedSectorColor(
  sector: Pick<StoredSectorSummary, "uid" | "name" | "color_r" | "color_g" | "color_b">,
  alpha = 0.28
): string {
  const sourceRed = Number(sector.color_r ?? 120);
  const sourceGreen = Number(sector.color_g ?? 120);
  const sourceBlue = Number(sector.color_b ?? 120);
  const seed = hashString(sector.uid ?? sector.name ?? "sector");
  const luminance = Math.round(sourceRed * 0.2126 + sourceGreen * 0.7152 + sourceBlue * 0.0722);
  const variation = (seed % 1000) / 1000;
  const grayscale = Math.max(
    70,
    Math.min(168, Math.round(luminance * 0.35 + 58 + variation * 42))
  );

  return `rgba(${grayscale}, ${grayscale}, ${grayscale}, ${alpha})`;
}

const GalaxySectorMap: React.FC<GalaxySectorMapProps> = ({
  sectors,
  systemMarkers = [],
  activeSectorUid,
  onSelectSector,
  annotations = [],
  loadedAnnotationSectorUids = [],
  searchRecords = [],
  onSystemSelect,
  onSaveAnnotation,
  onSaveSearchRecord,
  ensureSectorAnnotationsLoaded,
  canViewCellIntel = false,
  canViewScanWindow = false,
  canEditCellIntel = false,
  loadSystemDetail,
  focusRequest,
  onClearFocusRequest,
  controlsOverlay,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const selectionBodyRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const selectionDragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const clickTimeoutRef = useRef<number | null>(null);
  const draggedRef = useRef(false);
  const fittedRef = useRef(false);
  const zoomRef = useRef(1);
  const centerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cameraCenter, setCameraCenter] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [systemIcon, setSystemIcon] = useState<HTMLImageElement | null>(null);
  const [asteroidFieldIcon, setAsteroidFieldIcon] = useState<HTMLImageElement | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCellInfo | null>(null);
  const [selectedCellPosition, setSelectedCellPosition] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [intelDraft, setIntelDraft] = useState<{
    planetoids_checked: boolean | null;
    planetoid_1_size: "" | "1x1" | "2x2";
    planetoid_2_size: "" | "1x1" | "2x2";
    has_ships: boolean;
    has_stations: boolean;
  }>({
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
  const [cgtState, setCgtState] = useState<CgtResponse | null>(null);
  const [showSelectionFade, setShowSelectionFade] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [legendFilters, setLegendFilters] = useState<LegendFilters>(DEFAULT_LEGEND_FILTERS);
  const [controlsOpen, setControlsOpen] = useState(false);
  const offset = useMemo<Offset>(
    () => ({
      x: viewportSize.width / 2 - cameraCenter.x * zoom,
      y: viewportSize.height / 2 - cameraCenter.y * zoom,
    }),
    [cameraCenter, viewportSize.height, viewportSize.width, zoom]
  );

  useEffect(() => {
    let cancelled = false;

    const loadCgt = async () => {
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
    };

    loadCgt();

    return () => {
      cancelled = true;
    };
  }, []);

  const sourceSectors = useMemo(
    () =>
      sectors.filter(
        (sector) => !!sector.bounds && (sector.outline_coordinates?.length ?? 0) >= 3
      ),
    [sectors]
  );

  const preparedSectors = useMemo<PreparedSector[]>(() => {
    fittedRef.current = false;

    return sourceSectors.map((sector) => {
      const polygon = sector.outline_coordinates ?? [];
      const cells = buildSectorCells(polygon, sector.bounds);
      const centerGalx = sector.bounds
        ? sector.bounds.min_galx + sector.bounds.width / 2
        : polygon.reduce((sum, point) => sum + point.galx, 0) / Math.max(polygon.length, 1);
      const centerGaly = sector.bounds
        ? sector.bounds.min_galy + sector.bounds.height / 2
        : polygon.reduce((sum, point) => sum + point.galy, 0) / Math.max(polygon.length, 1);
      const labelCell = findSectorLabelCell(cells, centerGalx, centerGaly);

      return {
        ...sector,
        centerGalx,
        centerGaly,
        labelGalx: labelCell?.galx ?? Math.round(centerGalx),
        labelGaly: labelCell?.galy ?? Math.round(centerGaly),
        polygon,
        cells,
        boundarySegments: [],
      };
    });
  }, [sourceSectors]);

  const worldBounds = useMemo(() => {
    const allBounds = preparedSectors
      .map((sector) => sector.bounds)
      .filter((bounds): bounds is NonNullable<StoredSectorSummary["bounds"]> => !!bounds);

    if (allBounds.length === 0) return null;

    const minX = Math.min(...allBounds.map((bounds) => bounds.min_galx));
    const maxX = Math.max(...allBounds.map((bounds) => bounds.max_galx));
    const minY = Math.min(...allBounds.map((bounds) => bounds.min_galy));
    const maxY = Math.max(...allBounds.map((bounds) => bounds.max_galy));

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: Math.max(1, (maxX - minX + 1) * CELL_SIZE),
      height: Math.max(1, (maxY - minY + 1) * CELL_SIZE),
    };
  }, [preparedSectors]);

  const worldKey = useMemo(() => {
    if (!worldBounds) return "none";
    return `${worldBounds.minX}:${worldBounds.maxX}:${worldBounds.minY}:${worldBounds.maxY}:${worldBounds.width}:${worldBounds.height}`;
  }, [worldBounds]);

  const resolvedSectors = useMemo<PreparedSector[]>(() => {
    const ownership = new Map<string, string>();
    const sorted = [...preparedSectors].sort((left, right) => {
      const leftArea = left.cells.length || Number.MAX_SAFE_INTEGER;
      const rightArea = right.cells.length || Number.MAX_SAFE_INTEGER;

      if (leftArea !== rightArea) {
        return leftArea - rightArea;
      }

      return (left.uid ?? "").localeCompare(right.uid ?? "");
    });

    for (const sector of sorted) {
      for (const cell of sector.cells) {
        const key = `${cell.galx}:${cell.galy}`;
        if (!ownership.has(key)) {
          ownership.set(key, sector.uid);
        }
      }
    }

    const healedOwnership = healOwnershipGaps(ownership, preparedSectors, worldBounds);

    return preparedSectors.map((sector) => ({
      ...sector,
      cells: Array.from(healedOwnership.entries(), ([key, uid]) => {
        if (uid !== sector.uid) {
          return null;
        }

        const [galx, galy] = key.split(":").map(Number);
        return { galx, galy };
      }).filter((cell): cell is SectorCell => !!cell),
      boundarySegments: [],
    }));
  }, [preparedSectors, worldBounds]);

  const outlinedSectors = useMemo<PreparedSector[]>(
    () =>
      resolvedSectors.map((sector) => ({
        ...sector,
        boundarySegments: buildBoundarySegments(sector.cells),
      })),
    [resolvedSectors]
  );

  const focusMarker = useMemo(() => {
    if (!worldBounds || !focusRequest || focusRequest.kind !== "coords") return null;
    return worldCellCenter(
      focusRequest.galx,
      focusRequest.galy,
      worldBounds.minX,
      worldBounds.maxY
    );
  }, [focusRequest, worldBounds]);

  const focusKey = focusRequest
    ? focusRequest.kind === "sector"
      ? `sector:${focusRequest.sectorUid}:${focusRequest.nonce}:${focusRequest.zoom ?? ""}`
      : `coords:${focusRequest.galx}:${focusRequest.galy}:${focusRequest.nonce}:${focusRequest.zoom ?? ""}`
    : "none";

  const activeSector = useMemo(
    () => outlinedSectors.find((sector) => sector.uid === activeSectorUid) ?? null,
    [activeSectorUid, outlinedSectors]
  );

  const legendSections = useMemo(() => {
    const sections: Array<{ label: string; items: LegendEntry[] }> = [
      {
        label: "Map Markers",
        items: [{ key: "system", label: "System", icon: systemIconUrl }],
      },
    ];

    if (canViewCellIntel) {
      sections.push(
        {
          label: "Asteroid Types",
          items: [
            { key: "asteroid_unknown", label: "Asteroid Field, Unsearched", icon: asteroidFieldIconUnknownUrl },
            { key: "asteroid_none", label: "Asteroid Field, No Planetoids", icon: asteroidFieldIconUrl },
            { key: "asteroid_1x1", label: "Asteroid Field, 1x1 Planetoid", icon: asteroidFieldIcon1x1Url },
            { key: "asteroid_1x1_double", label: "Asteroid Field, 2 1x1 Planetoids", icon: asteroidFieldIcon1x1DoubleUrl },
            { key: "asteroid_2x2", label: "Asteroid Field, 2x2 Planetoid", icon: asteroidFieldIcon2x2Url },
            { key: "asteroid_1x1_2x2", label: "Asteroid Field, 1x1 And 2x2 Planetoids", icon: asteroidFieldIcon1x1And2x2Url },
          ],
        },
        {
          label: "Intel Flags",
          items: [
            { key: "ships", label: "Ships Present", icon: shipsDuelconUrl },
            { key: "stations", label: "Stations Present", icon: stationsDuelconUrl },
            { key: "scanned", label: "Recently Scanned (<1 yr)", icon: scannedDuelconUrl },
            { key: "rescan", label: "Rescan Due (>1 yr)", icon: rescanDueIconUrl },
          ],
        }
      );
    } else if (canViewScanWindow) {
      sections.push({
        label: "Scan Flags",
        items: [
          { key: "scanned", label: "Recently Scanned (<1 yr)", icon: scannedDuelconUrl },
          { key: "rescan", label: "Rescan Due (>1 yr)", icon: rescanDueIconUrl },
        ],
      });
    }

    return sections;
  }, [canViewCellIntel, canViewScanWindow]);

  const availableLegendKeys = useMemo(
    () => legendSections.flatMap((section) => section.items.map((item) => item.key)),
    [legendSections]
  );
  const showLegendBulkToggle = availableLegendKeys.length > 1;
  const hasAnyLegendFilterEnabled = availableLegendKeys.some((key) => legendFilters[key]);

  const visibleSystemMarkers = useMemo(
    () => (legendFilters.system ? systemMarkers : []),
    [legendFilters.system, systemMarkers]
  );

  const sectorNameByUid = useMemo(
    () => new Map(outlinedSectors.map((sector) => [sector.uid, sector.name ?? null])),
    [outlinedSectors]
  );

  const selectedCellOverlayStyle = useMemo(() => {
    if (!selectedCell || !worldBounds) {
      return undefined;
    }

    if (selectedCellPosition) {
      return {
        left: `${selectedCellPosition.left}px`,
        top: `${selectedCellPosition.top}px`,
        maxWidth: `min(320px, calc(100% - 24px))`,
      };
    }

    const point = worldPoint(
      selectedCell.galx,
      selectedCell.galy,
      worldBounds.minX,
      worldBounds.maxY
    );
    const cellSize = CELL_SIZE * zoom;
    const preferredLeft = offset.x + point.x * zoom + cellSize + 14;
    const preferredTop = offset.y + point.y * zoom + 8;
    const panelWidth = Math.min(320, Math.max(220, viewportSize.width - 24));

    return {
      left: `${Math.min(preferredLeft, Math.max(12, viewportSize.width - panelWidth - 12))}px`,
      top: `${Math.min(preferredTop, Math.max(12, viewportSize.height - 260))}px`,
      maxWidth: `min(${panelWidth}px, calc(100% - 24px))`,
    };
  }, [offset, selectedCell, selectedCellPosition, viewportSize.height, viewportSize.width, worldBounds, zoom]);

  const sectorUidByCoordinate = useMemo(() => {
    const map = new Map<string, string>();

    for (const sector of outlinedSectors) {
      for (const cell of sector.cells) {
        map.set(`${cell.galx}:${cell.galy}`, sector.uid);
      }
    }

    return map;
  }, [outlinedSectors]);

  const systemsByCoordinate = useMemo(() => {
    const map = new Map<string, StoredMapSystem[]>();

    for (const system of systemMarkers) {
      if (system.galx == null || system.galy == null) {
        continue;
      }

      const key = `${system.galx}:${system.galy}`;
      const existing = map.get(key);
      if (existing) {
        existing.push(system);
      } else {
        map.set(key, [system]);
      }
    }

    return map;
  }, [systemMarkers]);

  const annotationsByCoordinate = useMemo(() => {
    const map = new Map<string, Array<(typeof annotations)[number]>>();

    for (const annotation of annotations) {
      const key = `${annotation.galx}:${annotation.galy}`;
      const existing = map.get(key);
      if (existing) {
        existing.push(annotation);
      } else {
        map.set(key, [annotation]);
      }
    }

    return map;
  }, [annotations]);

  const loadedAnnotationSectorUidSet = useMemo(
    () => new Set(loadedAnnotationSectorUids),
    [loadedAnnotationSectorUids]
  );

  const searchRecordsByCoordinate = useMemo(() => {
    const map = new Map<string, Array<(typeof searchRecords)[number]>>();

    for (const searchRecord of searchRecords) {
      const key = `${searchRecord.galx}:${searchRecord.galy}`;
      const existing = map.get(key) ?? [];
      existing.push(searchRecord);
      map.set(key, existing);
    }

    return map;
  }, [searchRecords]);

  const asteroidMarkers = useMemo<AsteroidMarker[]>(() => {
    if (!worldBounds) {
      return [];
    }

    const markerSize = Math.max(5, CELL_SIZE * zoom * 0.72);

    return searchRecords
      .filter((record) => {
        if (!record.has_asteroids) {
          return false;
        }

        const planetoids = getPlanetoidEntries(record);
        return legendFilters[getAsteroidLegendKey(planetoids, record.planetoids_checked)];
      })
      .map((record) => {
        const planetoids = getPlanetoidEntries(record);
        const center = worldCellCenter(
          Number(record.galx),
          Number(record.galy),
          worldBounds.minX,
          worldBounds.maxY
        );
        const left = offset.x + center.x * zoom - markerSize / 2;
        const top = offset.y + center.y * zoom - markerSize / 2;

        return {
          key: `${record.id}:${record.galx}:${record.galy}`,
          left,
          top,
          size: markerSize,
          record,
          planetoids,
        };
      })
      .filter(
        (marker) =>
          marker.left >= -marker.size &&
          marker.left <= viewportSize.width + marker.size &&
          marker.top >= -marker.size &&
          marker.top <= viewportSize.height + marker.size
      );
  }, [legendFilters, offset, searchRecords, viewportSize.height, viewportSize.width, worldBounds, zoom]);

  const intelFlagMarkers = useMemo<IntelFlagMarker[]>(() => {
    if (!worldBounds) {
      return [];
    }

    const markerSize = Math.max(5, CELL_SIZE * zoom * 0.72);

    return searchRecords
      .filter(
        (record) =>
          !record.has_asteroids &&
          ((record.has_ships === true && legendFilters.ships) ||
            (record.has_stations === true && legendFilters.stations))
      )
      .map((record) => {
        const center = worldCellCenter(
          Number(record.galx),
          Number(record.galy),
          worldBounds.minX,
          worldBounds.maxY
        );
        const left = offset.x + center.x * zoom - markerSize / 2;
        const top = offset.y + center.y * zoom - markerSize / 2;

        return {
          key: `${record.id}:${record.galx}:${record.galy}:intel`,
          left,
          top,
          size: markerSize,
          hasShips: record.has_ships === true && legendFilters.ships,
          hasStations: record.has_stations === true && legendFilters.stations,
        };
      })
      .filter((marker) => marker.hasShips || marker.hasStations)
      .filter(
        (marker) =>
          marker.left >= -marker.size &&
          marker.left <= viewportSize.width + marker.size &&
          marker.top >= -marker.size &&
          marker.top <= viewportSize.height + marker.size
      );
  }, [legendFilters, offset, searchRecords, viewportSize.height, viewportSize.width, worldBounds, zoom]);

  const scanBadgeMarkers = useMemo<ScanBadgeMarker[]>(() => {
    if (!worldBounds || zoom < 1.25) {
      return [];
    }

    const systemMarkerSize = Math.max(5, CELL_SIZE * zoom * 0.72);
    const markerSize = Math.max(6, systemMarkerSize * 0.4);
    const badgeInset = Math.max(1.5, markerSize * 0.12);

    return searchRecords
      .filter((record) => !!record.legacy_recorded_at)
      .map((record) => {
        const daysSince = getDaysSince(record.legacy_recorded_at);
        if (daysSince === null) {
          return null;
        }

        const point = worldPoint(
          Number(record.galx),
          Number(record.galy),
          worldBounds.minX,
          worldBounds.maxY
        );
        const screenX = offset.x + point.x * zoom;
        const screenY = offset.y + point.y * zoom;
        const left = screenX + badgeInset;
        const top = screenY + badgeInset;

        const kind = daysSince >= 365 ? "rescan" : "scanned";

        if (!legendFilters[kind]) {
          return null;
        }

        return {
          key: `${record.id}:${record.galx}:${record.galy}`,
          left,
          top,
          size: markerSize,
          kind,
        };
      })
      .filter((marker): marker is ScanBadgeMarker => !!marker)
      .filter(
        (marker) =>
          marker.left >= -marker.size &&
          marker.left <= viewportSize.width + marker.size &&
          marker.top >= -marker.size &&
          marker.top <= viewportSize.height + marker.size
      );
  }, [legendFilters, offset, searchRecords, viewportSize.height, viewportSize.width, worldBounds, zoom]);

  const hideSecondaryIcons = zoom >= 0.3 && zoom <= 1.2;

  useEffect(() => {
    setNoteDraft(selectedCell?.annotation?.notes ?? "");
    setIsEditingNote(false);
    setIntelDraft({
      planetoids_checked: selectedCell?.searchRecord?.planetoids_checked ?? null,
      planetoid_1_size: selectedCell?.searchRecord?.planetoid_1_size ?? "",
      planetoid_2_size: selectedCell?.searchRecord?.planetoid_2_size ?? "",
      has_ships: selectedCell?.searchRecord?.has_ships === true,
      has_stations: selectedCell?.searchRecord?.has_stations === true,
    });
    setIsEditingIntel(false);
    setSelectedCellPosition(null);
  }, [selectedCell]);

  useEffect(() => {
    if (!selectedCell) {
      return;
    }

    const key = `${selectedCell.galx}:${selectedCell.galy}`;
    const nextSectorUid =
      sectorUidByCoordinate.get(key) ?? selectedCell.sectorUid ?? null;
    const nextSectorName = nextSectorUid
      ? sectorNameByUid.get(nextSectorUid) ?? selectedCell.sectorName ?? null
      : null;
    const nextSystem = (systemsByCoordinate.get(key) ?? [])[0] ?? null;
    const nextSearchRecord = (searchRecordsByCoordinate.get(key) ?? [])[0] ?? null;
    const nextAnnotation = (annotationsByCoordinate.get(key) ?? [])[0] ?? null;

    const sameSectorUid = nextSectorUid === selectedCell.sectorUid;
    const sameSectorName = nextSectorName === selectedCell.sectorName;
    const sameSystem = nextSystem === selectedCell.system;
    const sameSearchRecord = nextSearchRecord === selectedCell.searchRecord;
    const sameAnnotation = nextAnnotation === selectedCell.annotation;

    if (sameSectorUid && sameSectorName && sameSystem && sameSearchRecord && sameAnnotation) {
      return;
    }

    setSelectedCell({
      ...selectedCell,
      sectorUid: nextSectorUid,
      sectorName: nextSectorName,
      system: nextSystem,
      searchRecord: nextSearchRecord,
      annotation: nextAnnotation,
    });
  }, [
    annotationsByCoordinate,
    searchRecordsByCoordinate,
    sectorNameByUid,
    sectorUidByCoordinate,
    selectedCell,
    systemsByCoordinate,
  ]);

  useEffect(() => {
    if (!selectedCell?.sectorUid || !ensureSectorAnnotationsLoaded) {
      return;
    }

    if (loadedAnnotationSectorUidSet.has(selectedCell.sectorUid)) {
      return;
    }

    void ensureSectorAnnotationsLoaded(selectedCell.sectorUid);
  }, [
    ensureSectorAnnotationsLoaded,
    loadedAnnotationSectorUidSet,
    selectedCell?.sectorUid,
  ]);

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
  }, [
    selectedCell,
    isEditingIntel,
    isEditingNote,
    noteDraft,
    selectedSystemDetail,
    selectedSystemDetailLoading,
  ]);

  useEffect(() => {
    const systemIdentifier = selectedCell?.system?.identifier ?? selectedCell?.system?.uid ?? null;

    if (!selectedCell?.system || !systemIdentifier || !loadSystemDetail) {
      setSelectedSystemDetail(null);
      setSelectedSystemDetailLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setSelectedSystemDetailLoading(true);
        const detail = await loadSystemDetail(systemIdentifier);

        if (!cancelled) {
          setSelectedSystemDetail(detail);
        }
      } catch {
        if (!cancelled) {
          setSelectedSystemDetail(null);
        }
      } finally {
        if (!cancelled) {
          setSelectedSystemDetailLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loadSystemDetail, selectedCell?.system?.identifier, selectedCell?.system?.uid]);

  const selectedSystemSummary = useMemo(() => {
    if (!selectedSystemDetail) {
      return null;
    }

    const planets = selectedSystemDetail.planets ?? [];
    const stations = selectedSystemDetail.stations ?? [];
    const population = planets.reduce((sum, planet) => sum + (planet.population ?? 0), 0);
    const planetsWithPreviousPopulation = planets.filter(
      (planet) => planet.previous_population !== null && planet.previous_population !== undefined
    );
    const previousPopulation =
      planetsWithPreviousPopulation.length > 0
        ? planetsWithPreviousPopulation.reduce(
            (sum, planet) => sum + (planet.previous_population ?? 0),
            0
          )
        : null;
    const counts = planets.reduce(
      (acc, planet) => {
        const kind = classifySystemBody(planet);
        acc[kind] += 1;
        return acc;
      },
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
    const oneByOneCount = selectedCellPlanetoids.filter(
      (planetoid) => planetoid.size === "1x1"
    ).length;
    const twoByTwoCount = selectedCellPlanetoids.filter(
      (planetoid) => planetoid.size === "2x2"
    ).length;

    if (oneByOneCount > 0) {
      pills.push(`1x1 ${oneByOneCount}`);
    }

    if (twoByTwoCount > 0) {
      pills.push(`2x2 ${twoByTwoCount}`);
    }

    if (selectedCell?.searchRecord?.planetoids_checked === false) {
      pills.push("No Planetoids Found");
    }

    if (selectedCell?.searchRecord?.has_ships) {
      pills.push("Ships");
    }

    if (selectedCell?.searchRecord?.has_stations) {
      pills.push("Stations");
    }

    return pills;
  }, [selectedCell?.searchRecord, selectedCellPlanetoids]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!selectionDragRef.current || !viewportRef.current) {
        return;
      }

      const nextLeft =
        selectionDragRef.current.startLeft +
        (event.clientX - selectionDragRef.current.startClientX);
      const nextTop =
        selectionDragRef.current.startTop +
        (event.clientY - selectionDragRef.current.startClientY);

      const viewportWidth = viewportRef.current.clientWidth || 0;
      const viewportHeight = viewportRef.current.clientHeight || 0;

      setSelectedCellPosition({
        left: Math.min(Math.max(12, nextLeft), Math.max(12, viewportWidth - 232)),
        top: Math.min(Math.max(12, nextTop), Math.max(12, viewportHeight - 220)),
      });
    };

    const handleMouseUp = () => {
      selectionDragRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    const image = new Image();
    image.src = systemIconUrl;
    image.onload = () => setSystemIcon(image);
    return () => {
      image.onload = null;
    };
  }, []);

  useEffect(() => {
    const image = new Image();
    image.src = asteroidFieldIconUrl;
    image.onload = () => setAsteroidFieldIcon(image);
    return () => {
      image.onload = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current != null) {
        window.clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const updateViewportSize = () => {
      const width = viewport.clientWidth || 0;
      const height = viewport.clientHeight || 0;

      setViewportSize((current) =>
        current.width === width && current.height === height ? current : { width, height }
      );
    };

    updateViewportSize();

    const observer = new ResizeObserver(updateViewportSize);
    observer.observe(viewport);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!worldBounds || fittedRef.current) return;

    const { zoom: nextZoom } = fitWorldToViewport(
      viewportRef.current,
      worldBounds.width,
      worldBounds.height
    );
    const nextCenter = {
      x: worldBounds.width / 2,
      y: worldBounds.height / 2,
    };

    fittedRef.current = true;
    zoomRef.current = nextZoom;
    centerRef.current = nextCenter;
    setZoom(nextZoom);
    setCameraCenter(nextCenter);
  }, [worldKey, worldBounds]);

  useEffect(() => {
    fittedRef.current = false;
  }, [worldKey]);

  useEffect(() => {
    if (!focusRequest || !worldBounds || !viewportRef.current) return;

    let worldX = worldBounds.width / 2;
    let worldY = worldBounds.height / 2;
    let nextZoom = zoomRef.current;

    if (focusRequest.kind === "sector") {
      const target = preparedSectors.find((sector) => sector.uid === focusRequest.sectorUid);
      if (!target) return;

      const center = worldCellCenter(
        target.centerGalx,
        target.centerGaly,
        worldBounds.minX,
        worldBounds.maxY
      );

      worldX = center.x;
      worldY = center.y;
      nextZoom = focusRequest.zoom ?? nextZoom;
    } else {
      const center = worldCellCenter(
        focusRequest.galx,
        focusRequest.galy,
        worldBounds.minX,
        worldBounds.maxY
      );

      worldX = center.x;
      worldY = center.y;
      nextZoom = focusRequest.zoom ?? nextZoom;
    }

    const nextCenter = {
      x: worldX,
      y: worldY,
    };

    zoomRef.current = nextZoom;
    centerRef.current = nextCenter;
    setZoom(nextZoom);
    setCameraCenter(nextCenter);
  }, [focusKey, preparedSectors, worldBounds]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !worldBounds) return;

    const handleWheel = (event: WheelEvent) => {
      if (dragRef.current || isDragging) {
        event.preventDefault();
        return;
      }

      event.preventDefault();

      const currentZoom = zoomRef.current;
      const currentCenter = centerRef.current;
      const nextZoom = Math.min(
        MAX_ZOOM,
        Math.max(MIN_ZOOM, snapZoom(currentZoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)))
      );

      if (nextZoom === currentZoom) {
        return;
      }

      zoomRef.current = nextZoom;
      centerRef.current = currentCenter;
      setZoom(nextZoom);
      setCameraCenter(currentCenter);
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [isDragging, worldBounds]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragRef.current) return;

      const dx = event.clientX - dragRef.current.x;
      const dy = event.clientY - dragRef.current.y;

      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        draggedRef.current = true;
      }

      dragRef.current = { x: event.clientX, y: event.clientY };
      const currentZoom = zoomRef.current;
      const nextCenter = {
        x: centerRef.current.x - dx / currentZoom,
        y: centerRef.current.y - dy / currentZoom,
      };
      centerRef.current = nextCenter;
      setCameraCenter(nextCenter);
    };

    const stopDragging = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopDragging);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopDragging);
    };
  }, [isDragging]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !worldBounds || viewportSize.width <= 0 || viewportSize.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(viewportSize.width * dpr));
    canvas.height = Math.max(1, Math.floor(viewportSize.height * dpr));
    canvas.style.width = `${viewportSize.width}px`;
    canvas.style.height = `${viewportSize.height}px`;

    const context = canvas.getContext("2d");
    if (!context) return;

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(dpr, dpr);
    context.imageSmoothingEnabled = true;
    context.clearRect(0, 0, viewportSize.width, viewportSize.height);
    
    for (const sector of outlinedSectors) {
      if (sector.bounds) {
        const sectorTopLeft = worldPoint(
          sector.bounds.min_galx,
          sector.bounds.max_galy,
          worldBounds.minX,
          worldBounds.maxY
        );
        const sectorWidth = sector.bounds.width * CELL_SIZE * zoom;
        const sectorHeight = sector.bounds.height * CELL_SIZE * zoom;
        const sectorScreenX = offset.x + sectorTopLeft.x * zoom;
        const sectorScreenY = offset.y + sectorTopLeft.y * zoom;

        if (
          sectorScreenX > viewportSize.width ||
          sectorScreenY > viewportSize.height ||
          sectorScreenX + sectorWidth < 0 ||
          sectorScreenY + sectorHeight < 0
        ) {
          continue;
        }
      }

      context.fillStyle = themedSectorColor(
        sector,
        activeSectorUid === sector.uid ? 0.5 : 0.32
      );

      for (const cell of sector.cells) {
        const point = worldPoint(cell.galx, cell.galy, worldBounds.minX, worldBounds.maxY);
        const screenX = offset.x + point.x * zoom;
        const screenY = offset.y + point.y * zoom;
        const cellSize = CELL_SIZE * zoom;

        if (
          screenX > viewportSize.width ||
          screenY > viewportSize.height ||
          screenX + cellSize < 0 ||
          screenY + cellSize < 0
        ) {
          continue;
        }

        if (zoom < GRID_VISIBILITY_THRESHOLD) {
          // At low zoom, derive each cell from shared rounded boundaries so
          // adjacent cells tile cleanly without the checkerboard seam effect.
          const nextPoint = worldPoint(
            cell.galx + 1,
            cell.galy - 1,
            worldBounds.minX,
            worldBounds.maxY
          );
          const left = Math.round(screenX);
          const top = Math.round(screenY);
          const right = Math.round(offset.x + nextPoint.x * zoom);
          const bottom = Math.round(offset.y + nextPoint.y * zoom);
          context.fillRect(
            left,
            top,
            Math.max(1, right - left),
            Math.max(1, bottom - top)
          );
        } else {
          const overlap = 0.5;
          context.fillRect(
            screenX - overlap,
            screenY - overlap,
            cellSize + overlap * 2,
            cellSize + overlap * 2
          );
        }
      }

      context.beginPath();
      for (const segment of sector.boundarySegments) {
        const start = worldPoint(segment.x1, segment.y1, worldBounds.minX, worldBounds.maxY);
        const end = worldPoint(segment.x2, segment.y2, worldBounds.minX, worldBounds.maxY);
        context.moveTo(
          alignCanvasStroke(offset.x + start.x * zoom),
          alignCanvasStroke(offset.y + start.y * zoom)
        );
        context.lineTo(
          alignCanvasStroke(offset.x + end.x * zoom),
          alignCanvasStroke(offset.y + end.y * zoom)
        );
      }
      context.lineWidth = activeSectorUid === sector.uid ? 1.5 : 1;
      context.strokeStyle =
        activeSectorUid === sector.uid
          ? "rgba(246,163,0,0.48)"
          : "rgba(246,163,0,0.24)";
      context.stroke();
    }

    if (zoom >= GRID_VISIBILITY_THRESHOLD) {
      const gridStep = CELL_SIZE * zoom;
      const startGridX =
        offset.x + Math.floor((-offset.x / zoom) / CELL_SIZE) * CELL_SIZE * zoom;
      const startGridY =
        offset.y + Math.floor((-offset.y / zoom) / CELL_SIZE) * CELL_SIZE * zoom;

      context.strokeStyle = "rgba(255,255,255,0.25)";
      context.lineWidth = 1;

      for (let x = startGridX; x <= viewportSize.width + gridStep; x += gridStep) {
        context.beginPath();
        context.moveTo(Math.round(x) + 0.5, 0);
        context.lineTo(Math.round(x) + 0.5, viewportSize.height);
        context.stroke();
      }

      for (let y = startGridY; y <= viewportSize.height + gridStep; y += gridStep) {
        context.beginPath();
        context.moveTo(0, Math.round(y) + 0.5);
        context.lineTo(viewportSize.width, Math.round(y) + 0.5);
        context.stroke();
      }
    }

    if (systemIcon) {
      drawCenteredMapMarkers(
        context,
        systemIcon,
        visibleSystemMarkers,
        worldBounds,
        offset,
        zoom,
        viewportSize
      );
    }

    if (selectedCell) {
      const point = worldPoint(
        selectedCell.galx,
        selectedCell.galy,
        worldBounds.minX,
        worldBounds.maxY
      );
      const screenX = offset.x + point.x * zoom;
      const screenY = offset.y + point.y * zoom;
      const cellSize = CELL_SIZE * zoom;

      context.save();
      context.fillStyle = "rgba(246,163,0,0.16)";
      context.fillRect(screenX, screenY, cellSize, cellSize);
      context.strokeStyle = "rgba(246,163,0,0.98)";
      context.lineWidth = Math.max(1.5, zoom >= GRID_VISIBILITY_THRESHOLD ? 2 : 1.5);
      context.strokeRect(
        alignCanvasStroke(screenX),
        alignCanvasStroke(screenY),
        Math.max(1, Math.round(cellSize)),
        Math.max(1, Math.round(cellSize))
      );
      context.restore();
    }

    if (zoom <= 1.2) {
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = `700 ${Math.max(9, Math.min(13, zoom < 0.45 ? 9 + zoom * 6 : 13))}px "Tektur", sans-serif`;

      for (const sector of outlinedSectors) {
        const labelWorld = worldCellCenter(
          sector.labelGalx,
          sector.labelGaly,
          worldBounds.minX,
          worldBounds.maxY
        );
        const labelX = offset.x + labelWorld.x * zoom;
        const labelY = offset.y + labelWorld.y * zoom;

        if (
          labelX < -120 ||
          labelX > viewportSize.width + 120 ||
          labelY < -40 ||
          labelY > viewportSize.height + 40
        ) {
          continue;
        }

        const text = sector.name ?? sector.uid;
        context.lineWidth = zoom < 0.45 ? 2.25 : 3;
        context.strokeStyle = "rgba(0,0,0,0.72)";
        context.strokeText(text, labelX, labelY);
        context.fillStyle = "rgba(246,163,0,0.96)";
        context.fillText(text, labelX, labelY);
      }
    }

    if (focusMarker) {
      const markerX = offset.x + focusMarker.x * zoom;
      const markerY = offset.y + focusMarker.y * zoom;

      context.strokeStyle = "rgba(255,255,255,0.92)";
      context.lineWidth = 1.5;
      context.fillStyle = "rgba(255,255,255,0.12)";

      context.beginPath();
      context.arc(markerX, markerY, 6, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      context.beginPath();
      context.moveTo(markerX - 12, markerY);
      context.lineTo(markerX + 12, markerY);
      context.moveTo(markerX, markerY - 12);
      context.lineTo(markerX, markerY + 12);
      context.stroke();
    }

  }, [
    activeSector,
    activeSectorUid,
    focusMarker,
    offset,
    outlinedSectors,
    selectedCell,
    asteroidMarkers,
    viewportSize.height,
    viewportSize.width,
    worldBounds,
    asteroidFieldIcon,
    systemIcon,
    visibleSystemMarkers,
    zoom,
  ]);

  if (!worldBounds || outlinedSectors.length === 0) {
    return (
      <section className="panel admin-card">
        <div className="admin-card__header">
          <h3 className="admin-card__title">Astrogation Chart</h3>
          <p className="admin-card__desc">
            No stored sector data is ready yet.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel admin-card">
      <div className="admin-card__header">
        <h3 className="admin-card__title">Astrogation Chart</h3>
        <p className="admin-card__desc">
          Sector footprint view. Scroll to zoom, drag to pan, single-click a grid to inspect it, and double-click a sector to highlight it.
        </p>
      </div>

      <div className="members-universe-map__meta">
        <span className="small">Zoom: {zoom.toFixed(2)}x</span>
        {focusRequest?.kind === "coords" ? (
          <button
            className="btn btn--small"
            type="button"
            onClick={onClearFocusRequest}
          >
            Clear Marker
          </button>
        ) : null}
      </div>

      <div
        ref={viewportRef}
        className={`members-universe-map ${isDragging ? "is-dragging" : ""}`}
        style={{ touchAction: "none" }}
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          setIsDragging(true);
          draggedRef.current = false;
          dragRef.current = { x: event.clientX, y: event.clientY };
        }}
        onMouseUp={() => {
          setIsDragging(false);
          dragRef.current = null;
        }}
        onMouseLeave={() => {
          setHoverInfo(null);
          if (!isDragging) {
            dragRef.current = null;
          }
        }}
        onMouseMove={(event) => {
          if (!worldBounds || isDragging) {
            setHoverInfo(null);
            return;
          }

          const rect = event.currentTarget.getBoundingClientRect();
          const screenX = event.clientX - rect.left;
          const screenY = event.clientY - rect.top;
          const worldX = (screenX - offset.x) / zoom;
          const worldY = (screenY - offset.y) / zoom;
          const galx = Math.floor(worldX / CELL_SIZE) + worldBounds.minX;
          const galy = worldBounds.maxY - Math.floor(worldY / CELL_SIZE);

          const systems = systemsByCoordinate.get(`${galx}:${galy}`) ?? [];
          const searchRecord = (searchRecordsByCoordinate.get(`${galx}:${galy}`) ?? [])[0] ?? null;
          const sectorUid = sectorUidByCoordinate.get(`${galx}:${galy}`) ?? null;
          const systemName = getPrimaryCellName(systems[0] ?? null, searchRecord, canViewCellIntel);

          setHoverInfo({
            galx,
            galy,
            screenX,
            screenY,
            sectorName: sectorUid ? sectorNameByUid.get(sectorUid) ?? null : null,
            systemName,
          });
        }}
        onClick={(event) => {
          if (!worldBounds || draggedRef.current) {
            draggedRef.current = false;
            return;
          }

          const rect = event.currentTarget.getBoundingClientRect();
          const screenX = event.clientX - rect.left;
          const screenY = event.clientY - rect.top;
          const worldX = (screenX - offset.x) / zoom;
          const worldY = (screenY - offset.y) / zoom;
          const galx = Math.floor(worldX / CELL_SIZE) + worldBounds.minX;
          const galy = worldBounds.maxY - Math.floor(worldY / CELL_SIZE);
          const systems = systemsByCoordinate.get(`${galx}:${galy}`) ?? [];
          const sectorUid = sectorUidByCoordinate.get(`${galx}:${galy}`) ?? null;
          const annotation = (annotationsByCoordinate.get(`${galx}:${galy}`) ?? [])[0] ?? null;
          const searchRecord = (searchRecordsByCoordinate.get(`${galx}:${galy}`) ?? [])[0] ?? null;

          if (clickTimeoutRef.current != null) {
            window.clearTimeout(clickTimeoutRef.current);
          }

          clickTimeoutRef.current = window.setTimeout(() => {
            setSelectedCell({
              galx,
              galy,
              sectorUid,
              sectorName: sectorUid ? sectorNameByUid.get(sectorUid) ?? null : null,
              system: systems[0] ?? null,
              searchRecord,
              annotation,
            });
            clickTimeoutRef.current = null;
          }, 180);
        }}
        onDoubleClick={(event) => {
          if (!worldBounds || !onSelectSector || draggedRef.current) {
            return;
          }

          if (clickTimeoutRef.current != null) {
            window.clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
          }

          const rect = event.currentTarget.getBoundingClientRect();
          const screenX = event.clientX - rect.left;
          const screenY = event.clientY - rect.top;
          const worldX = (screenX - offset.x) / zoom;
          const worldY = (screenY - offset.y) / zoom;
          const galx = Math.floor(worldX / CELL_SIZE) + worldBounds.minX;
          const galy = worldBounds.maxY - Math.floor(worldY / CELL_SIZE);
          const sectorUid = sectorUidByCoordinate.get(`${galx}:${galy}`) ?? null;

          if (sectorUid) {
            onSelectSector(sectorUid);
          }
        }}
      >
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
              className="members-universe-map__legend-body"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onWheelCapture={(event) => event.stopPropagation()}
            >
              {showLegendBulkToggle ? (
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

                        return {
                          ...current,
                          ...updates,
                        };
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
                      <img src={item.icon} alt="" className="members-universe-map__legend-icon" />
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
        <div className="members-universe-map__overlays" aria-hidden="true">
          {canViewCellIntel ? asteroidMarkers.map((marker) => (
          <div
            key={marker.key}
            className="members-universe-map__asteroid-marker"
              style={{
                left: `${marker.left}px`,
                top: `${marker.top}px`,
                width: `${marker.size}px`,
                height: `${marker.size}px`,
              }}
            >
              <img
                src={getAsteroidMarkerIcon(
                  marker.planetoids,
                  marker.record.planetoids_checked
                )}
                alt=""
                className="members-universe-map__asteroid-marker-icon"
              />
              {!hideSecondaryIcons && marker.record.has_ships ? (
                <img
                  src={shipsDuelconUrl}
                  alt=""
                  className="members-universe-map__asteroid-flag members-universe-map__asteroid-flag--ships"
                />
              ) : null}
              {!hideSecondaryIcons && marker.record.has_stations ? (
                <img
                  src={stationsDuelconUrl}
                  alt=""
                  className="members-universe-map__asteroid-flag members-universe-map__asteroid-flag--stations"
                />
              ) : null}
            </div>
          )) : null}
          {canViewCellIntel && !hideSecondaryIcons ? intelFlagMarkers.map((marker) => (
            <div
              key={marker.key}
              className="members-universe-map__intel-flag-marker"
              style={{
                left: `${marker.left}px`,
                top: `${marker.top}px`,
                width: `${marker.size}px`,
                height: `${marker.size}px`,
              }}
            >
              {marker.hasShips ? (
                <img
                  src={shipsDuelconUrl}
                  alt=""
                  className="members-universe-map__asteroid-flag members-universe-map__asteroid-flag--ships"
                />
              ) : null}
              {marker.hasStations ? (
                <img
                  src={stationsDuelconUrl}
                  alt=""
                  className="members-universe-map__asteroid-flag members-universe-map__asteroid-flag--stations"
                />
              ) : null}
            </div>
          )) : null}
          {(canViewCellIntel || canViewScanWindow) && !hideSecondaryIcons ? scanBadgeMarkers.map((marker) => (
            <img
              key={marker.key}
              src={marker.kind === "rescan" ? rescanDueIconUrl : scannedDuelconUrl}
              alt=""
              className={`members-universe-map__scan-badge members-universe-map__scan-badge--${marker.kind}`}
              style={{
                left: `${marker.left}px`,
                top: `${marker.top}px`,
                width: `${marker.size}px`,
                height: `${marker.size}px`,
              }}
            />
          )) : null}
        </div>
        {hoverInfo ? (
          <div
            className="members-universe-map__hover"
            style={{
              left: `${Math.min(hoverInfo.screenX + 14, Math.max(12, viewportSize.width - 180))}px`,
              top: `${Math.max(12, hoverInfo.screenY + 14)}px`,
            }}
          >
            <strong>
              {hoverInfo.galx}, {hoverInfo.galy}
            </strong>
            {hoverInfo.sectorName ? <span>{hoverInfo.sectorName}</span> : null}
            {hoverInfo.systemName ? <span>{hoverInfo.systemName}</span> : null}
          </div>
        ) : null}
        {selectedCell ? (
          <div
            className={`members-universe-map__selection${showSelectionFade ? " is-scrollable" : ""}`}
            style={selectedCellOverlayStyle}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="members-universe-map__selection-head"
              onMouseDown={(event) => {
                event.stopPropagation();
                const target = event.currentTarget.parentElement;
                if (!target) {
                  return;
                }

                const left = Number.parseFloat(target.style.left || "0");
                const top = Number.parseFloat(target.style.top || "0");
                selectionDragRef.current = {
                  startClientX: event.clientX,
                  startClientY: event.clientY,
                  startLeft: left,
                  startTop: top,
                };
              }}
            >
              <div className="members-universe-map__selection-copy">
                <strong>
                  {selectedCell.galx}, {selectedCell.galy}
                </strong>
                {selectedCell.sectorUid ? (
                  <span className="members-universe-map__selection-label">
                    {selectedCell.sectorName ??
                      `Sector ${formatSwcDisplayId(selectedCell.sectorUid) ?? selectedCell.sectorUid}`}
                  </span>
                ) : null}
                {getPrimaryCellName(selectedCell.system, selectedCell.searchRecord, canViewCellIntel) ? (
                  <span className="members-universe-map__selection-label">
                    {getPrimaryCellName(selectedCell.system, selectedCell.searchRecord, canViewCellIntel)}
                  </span>
                ) : null}
              </div>
              <div className="members-universe-map__selection-head-actions">
                <button
                  type="button"
                  className="members-universe-map__selection-close"
                  onClick={() => setSelectedCell(null)}
                  aria-label="Clear selected grid cell"
                >
                  <span className="members-universe-map__selection-close-glyph" aria-hidden="true">
                    x
                  </span>
                </button>
              </div>
            </div>
            <div
              className="members-universe-map__selection-body"
              ref={selectionBodyRef}
              onWheelCapture={(event) => {
                event.stopPropagation();
              }}
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
            {selectedCell.searchRecord?.handle ? (
              <span className="small">
                {isEventImportedSearchRecord(selectedCell.searchRecord)
                  ? `Searched by: ${selectedCell.searchRecord.handle}`
                  : `Searched by: ${selectedCell.searchRecord.handle}`}
              </span>
            ) : null}
            {selectedCell.searchRecord?.legacy_recorded_at ? (
              <>
                <span className="small">
                  {formatTimestampAsCgt(selectedCell.searchRecord.legacy_recorded_at, cgtState)}
                </span>
                {formatRelativeAge(selectedCell.searchRecord.legacy_recorded_at) ? (
                  <span className="small">
                    {formatRelativeAge(selectedCell.searchRecord.legacy_recorded_at)}
                  </span>
                ) : null}
              </>
            ) : null}
            {selectedCellIntelPills.length > 0 ? (
              <div className="members-universe__meta">
                {selectedCellIntelPills.map((pill) => (
                  <span key={pill} className="admin-badge admin-badge--soft">
                    {pill}
                  </span>
                ))}
              </div>
            ) : null}
            {selectedCell.system ? (
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
                        <span className="small">
                          Change: {selectedSystemSummary.populationChange}
                        </span>
                      ) : null}
                    </div>
                    <div className="members-universe__meta">
                      {selectedSystemSummary.bodyPills.map(([label, count]) => (
                        <span key={label} className="admin-badge admin-badge--soft">
                          {label} {count}
                        </span>
                      ))}
                      <span className="admin-badge admin-badge--soft">
                        Stations {selectedSystemSummary.stations}
                      </span>
                      <span className="admin-badge admin-badge--soft">
                        Hyperlanes {selectedSystemSummary.hyperlanes}
                      </span>
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
                          value={
                            intelDraft.planetoids_checked === null
                              ? ""
                              : intelDraft.planetoids_checked
                                ? "yes"
                                : "no"
                          }
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
                            setIntelDraft((current) => ({
                              ...current,
                              has_ships: event.target.checked,
                            }))
                          }
                        />
                        <span>Has Ships</span>
                      </label>
                      <label className="members-universe-map__intel-check">
                        <input
                          type="checkbox"
                          checked={intelDraft.has_stations}
                          onChange={(event) =>
                            setIntelDraft((current) => ({
                              ...current,
                              has_stations: event.target.checked,
                            }))
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
                          if (!onSaveSearchRecord || !selectedCell) {
                            return;
                          }

                          const twoByTwoCount = [
                            intelDraft.planetoid_1_size,
                            intelDraft.planetoid_2_size,
                          ].filter((value) => value === "2x2").length;

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
                              current
                                ? {
                                    ...current,
                                    searchRecord: saved,
                                  }
                                : current
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
                    if (!selectedCell.sectorUid || !onSaveAnnotation) {
                      return;
                    }

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
                        current
                          ? {
                              ...current,
                              annotation: null,
                            }
                          : current
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
                  <button
                    className="btn btn--tiny"
                    type="button"
                    onClick={() =>
                      wrapTextareaSelection(
                        noteTextareaRef.current,
                        noteDraft,
                        setNoteDraft,
                        "[b]",
                        "[/b]"
                      )
                    }
                  >
                    B
                  </button>
                  <button
                    className="btn btn--tiny"
                    type="button"
                    onClick={() =>
                      wrapTextareaSelection(
                        noteTextareaRef.current,
                        noteDraft,
                        setNoteDraft,
                        "[i]",
                        "[/i]"
                      )
                    }
                  >
                    I
                  </button>
                  <button
                    className="btn btn--tiny"
                    type="button"
                    onClick={() =>
                      wrapTextareaSelection(
                        noteTextareaRef.current,
                        noteDraft,
                        setNoteDraft,
                        "[u]",
                        "[/u]"
                      )
                    }
                  >
                    U
                  </button>
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
                    <BBCodeView
                      value={noteDraft}
                      className="small members-universe-map__note-body"
                    />
                  </div>
                ) : null}
                <div className="members-universe__inline">
                  <button
                    className="btn btn--small"
                    type="button"
                    disabled={!selectedCell.sectorUid || !onSaveAnnotation || savingNote}
                    onClick={async () => {
                      if (!selectedCell.sectorUid || !onSaveAnnotation) {
                        return;
                      }

                      setSavingNote(true);
                      try {
                        const saved = await onSaveAnnotation({
                          sector_uid: selectedCell.sectorUid,
                          galx: selectedCell.galx,
                          galy: selectedCell.galy,
                          notes: noteDraft || null,
                        });

                        setSelectedCell((current) =>
                          current
                            ? {
                                ...current,
                                annotation: saved,
                              }
                            : current
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
            {selectedCell.system ? (
              <button
                className="btn btn--small"
                type="button"
                onClick={() => {
                  const system = selectedCell.system;
                  const identifier = system?.identifier ?? system?.uid ?? null;
                  if (!system || !identifier || !onSystemSelect) {
                    return;
                  }

                  onSystemSelect(identifier, system.sector_uid);
                }}
              >
                Open {selectedCell.system.name ?? selectedCell.system.identifier ?? "System"}
              </button>
            ) : null}
            </div>
          </div>
        ) : null}
        <div className="members-universe-map__canvas">
          <canvas
            ref={canvasRef}
            className="members-universe-map__bitmap"
            aria-label="Stored galaxy sector map"
          />
        </div>
      </div>
    </section>
  );
};

export default GalaxySectorMap;
