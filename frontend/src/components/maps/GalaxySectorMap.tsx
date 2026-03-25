import React, { useEffect, useMemo, useRef, useState } from "react";
import systemIconUrl from "../../assets/map/SystemIcon.png";
import type { SectorCellAnnotation, StoredMapSystem, StoredSectorSummary } from "../../api/universe";

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
  onSystemSelect?: (systemIdentifier: string, sectorUid?: string | null) => void;
  onSaveAnnotation?: (payload: {
    sector_uid: string;
    galx: number;
    galy: number;
    notes?: string | null;
  }) => Promise<SectorCellAnnotation | null> | SectorCellAnnotation | null;
  focusRequest?: FocusRequest | null;
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
  systemName: string | null;
};

type SelectedCellInfo = {
  galx: number;
  galy: number;
  sectorUid: string | null;
  system: StoredMapSystem | null;
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
  polygon: SectorCell[];
  cells: SectorCell[];
  boundarySegments: BoundarySegment[];
};

const CELL_SIZE = 18;
const VIEW_PADDING = 32;
const GRID_VISIBILITY_THRESHOLD = 0.76;
const DRAG_THRESHOLD = 4;
const MIN_ZOOM = 0.25;
const ZOOM_STEP = 0.05;

function snapZoom(value: number) {
  return Number((Math.round(value / ZOOM_STEP) * ZOOM_STEP).toFixed(2));
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
  annotations = [],
  onSystemSelect,
  onSaveAnnotation,
  focusRequest,
}) => {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const draggedRef = useRef(false);
  const fittedRef = useRef(false);
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState<ViewportSize>({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [systemIcon, setSystemIcon] = useState<HTMLImageElement | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [selectedCell, setSelectedCell] = useState<SelectedCellInfo | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);

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

      return {
        ...sector,
        centerGalx,
        centerGaly,
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

  useEffect(() => {
    setNoteDraft(selectedCell?.annotation?.notes ?? "");
    setIsEditingNote(false);
  }, [selectedCell]);

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

    const { zoom: nextZoom, offset: nextOffset } = fitWorldToViewport(
      viewportRef.current,
      worldBounds.width,
      worldBounds.height
    );

    fittedRef.current = true;
    setZoom(nextZoom);
    setOffset(nextOffset);
  }, [worldKey, worldBounds]);

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

    const viewportWidth = viewportRef.current.clientWidth || 1;
    const viewportHeight = viewportRef.current.clientHeight || 1;

    setZoom(nextZoom);
    setOffset({
      x: viewportWidth / 2 - worldX * nextZoom,
      y: viewportHeight / 2 - worldY * nextZoom,
    });
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

      const rect = viewport.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const delta = event.deltaY < 0 ? 0.1 : -0.1;

      setZoom((currentZoom) => {
        const nextZoom = Math.min(5, Math.max(MIN_ZOOM, snapZoom(currentZoom + delta)));

        if (nextZoom === currentZoom) return currentZoom;

        const worldX = (mouseX - offset.x) / currentZoom;
        const worldY = (mouseY - offset.y) / currentZoom;

        setOffset({
          x: mouseX - worldX * nextZoom,
          y: mouseY - worldY * nextZoom,
        });

        return nextZoom;
      });
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [isDragging, offset, worldBounds]);

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
      setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
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

        const overlap = zoom < GRID_VISIBILITY_THRESHOLD ? 0.8 : 0.5;
        context.fillRect(
          screenX - overlap,
          screenY - overlap,
          cellSize + overlap * 2,
          cellSize + overlap * 2
        );
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
      const markerSize = Math.max(5, CELL_SIZE * zoom * 0.72);

      for (const system of systemMarkers) {
        if (system.galx == null || system.galy == null) {
          continue;
        }

        const center = worldCellCenter(
          Number(system.galx),
          Number(system.galy),
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
          systemIcon,
          markerX - markerSize / 2,
          markerY - markerSize / 2,
          markerSize,
          markerSize
        );
      }
    }

    if (zoom >= 0.45) {
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.font = "700 13px monospace";

      for (const sector of outlinedSectors) {
        const labelWorld = worldCellCenter(
          sector.centerGalx,
          sector.centerGaly,
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
        context.lineWidth = 3;
        context.strokeStyle = "rgba(0,0,0,0.72)";
        context.strokeText(text, labelX, labelY);
        context.fillStyle = "rgba(255,255,255,0.92)";
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
    viewportSize.height,
    viewportSize.width,
    worldBounds,
    systemIcon,
    systemMarkers,
    zoom,
  ]);

  if (!worldBounds || outlinedSectors.length === 0) {
    return (
      <section className="panel admin-card">
        <div className="admin-card__header">
          <h3 className="admin-card__title">Galaxy Map</h3>
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
        <h3 className="admin-card__title">Galaxy Map</h3>
        <p className="admin-card__desc">
          Sector footprint view. Scroll to zoom, drag to pan, and click a sector area to inspect it.
        </p>
      </div>

      <div className="members-universe-map__meta">
        <span className="small">Prepared sectors on map: {outlinedSectors.length}</span>
        <span className="small">Zoom: {zoom.toFixed(2)}x</span>
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
          const systemName =
            systems[0]?.name ?? systems[0]?.identifier ?? systems[0]?.uid ?? null;

          setHoverInfo({
            galx,
            galy,
            screenX,
            screenY,
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

          setSelectedCell({
            galx,
            galy,
            sectorUid,
            system: systems[0] ?? null,
            annotation,
          });
        }}
      >
        <div className="members-universe-map__stars" />
        <div className="members-universe-map__status">
          <span className="small">{`Prepared ${outlinedSectors.length} sectors`}</span>
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
            {hoverInfo.systemName ? <span>{hoverInfo.systemName}</span> : null}
          </div>
        ) : null}
        {selectedCell ? (
          <div
            className="members-universe-map__selection"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="members-universe-map__selection-head">
              <strong>
                {selectedCell.galx}, {selectedCell.galy}
              </strong>
              {selectedCell.sectorUid ? (
                <span className="small">{selectedCell.sectorUid}</span>
              ) : null}
            </div>
            {selectedCell.annotation?.label ? (
              <span className="small">{selectedCell.annotation.label}</span>
            ) : null}
            {selectedCell.annotation?.notes ? (
              <p className="small" style={{ margin: 0 }}>
                {selectedCell.annotation.notes}
              </p>
            ) : null}
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
            {isEditingNote ? (
              <>
                <textarea
                  className="input"
                  rows={4}
                  value={noteDraft}
                  onChange={(event) => setNoteDraft(event.target.value)}
                  placeholder="Add a note for this grid cell"
                />
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
            {!selectedCell.annotation?.notes && !noteDraft ? (
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
