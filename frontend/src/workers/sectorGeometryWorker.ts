type InputSector = {
  uid: string;
  outline_coordinates: Array<{ galx: number; galy: number }>;
  bounds: { min_galx: number; max_galx: number; min_galy: number; max_galy: number } | null;
};

type SectorCell = { galx: number; galy: number };

type BoundarySegment = { x1: number; y1: number; x2: number; y2: number };

type GeometryRequest = {
  requestId: number;
  sectors: InputSector[];
};

type SectorGeometryEntry = {
  uid: string;
  cells: SectorCell[];
  boundarySegments: BoundarySegment[];
};

type GeometryResponse = {
  requestId: number;
  sectorGeometry: SectorGeometryEntry[];
  labelCentroids: Record<string, [number, number]>;
};

function toCellKey(galx: number, galy: number) {
  return `${galx}:${galy}`;
}

function pointInPolygon(x: number, y: number, polygon: Array<[number, number]>) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersects =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function bresenham(x0: number, y0: number, x1: number, y1: number): SectorCell[] {
  const points: SectorCell[] = [];
  let cx = x0, cy = y0;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (true) {
    points.push({ galx: cx, galy: cy });
    if (cx === x1 && cy === y1) break;
    const e2 = err * 2;
    if (e2 > -dy) { err -= dy; cx += sx; }
    if (e2 < dx) { err += dx; cy += sy; }
  }
  return points;
}

function expandOutlinePoints(points: Array<[number, number]>): SectorCell[] {
  if (points.length === 0) return [];
  const expanded: SectorCell[] = [];
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    for (const p of bresenham(x0, y0, x1, y1)) expanded.push(p);
  }
  return expanded;
}

function cellOverlapsPolygon(galx: number, galy: number, polygon: Array<[number, number]>) {
  const samples: Array<[number, number]> = [
    [galx + 0.5, galy + 0.5], [galx + 0.15, galy + 0.15],
    [galx + 0.85, galy + 0.15], [galx + 0.15, galy + 0.85],
    [galx + 0.85, galy + 0.85],
  ];
  return samples.filter(([x, y]) => pointInPolygon(x, y, polygon)).length >= 3;
}

function buildSectorCells(polygon: Array<[number, number]>, bounds: { minX: number; maxX: number; minY: number; maxY: number }): SectorCell[] {
  const areaSet = new Set<string>();
  const outline = expandOutlinePoints(polygon);

  if (polygon.length >= 3) {
    for (let galx = bounds.minX; galx <= bounds.maxX; galx++) {
      for (let galy = bounds.minY; galy <= bounds.maxY; galy++) {
        if (cellOverlapsPolygon(galx, galy, polygon)) {
          areaSet.add(toCellKey(galx, galy));
        }
      }
    }
  }
  for (const p of outline) areaSet.add(toCellKey(p.galx, p.galy));

  return Array.from(areaSet, (key) => {
    const [galx, galy] = key.split(":").map(Number);
    return { galx, galy };
  });
}

function buildBoundarySegments(cells: SectorCell[]): BoundarySegment[] {
  const cellSet = new Set(cells.map((c) => toCellKey(c.galx, c.galy)));
  const segments: BoundarySegment[] = [];
  for (const { galx, galy } of cells) {
    if (!cellSet.has(toCellKey(galx, galy + 1))) segments.push({ x1: galx, y1: galy + 1, x2: galx + 1, y2: galy + 1 });
    if (!cellSet.has(toCellKey(galx + 1, galy))) segments.push({ x1: galx + 1, y1: galy, x2: galx + 1, y2: galy + 1 });
    if (!cellSet.has(toCellKey(galx, galy - 1))) segments.push({ x1: galx, y1: galy, x2: galx + 1, y2: galy });
    if (!cellSet.has(toCellKey(galx - 1, galy))) segments.push({ x1: galx, y1: galy, x2: galx, y2: galy + 1 });
  }
  return segments;
}

function computeLabelCentroid(cells: SectorCell[]): [number, number] {
  if (cells.length === 0) return [0, 0];
  const cellSet = new Set(cells.map((c) => toCellKey(c.galx, c.galy)));
  const dist = new Map<string, number>();
  const queue: Array<[number, number, number]> = [];

  for (const c of cells) {
    const isBoundary =
      !cellSet.has(toCellKey(c.galx - 1, c.galy)) ||
      !cellSet.has(toCellKey(c.galx + 1, c.galy)) ||
      !cellSet.has(toCellKey(c.galx, c.galy - 1)) ||
      !cellSet.has(toCellKey(c.galx, c.galy + 1));
    if (isBoundary) {
      dist.set(toCellKey(c.galx, c.galy), 1);
      queue.push([c.galx, c.galy, 1]);
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y, d] = queue[i];
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nk = toCellKey(x + dx, y + dy);
      if (cellSet.has(nk) && !dist.has(nk)) {
        dist.set(nk, d + 1);
        queue.push([x + dx, y + dy, d + 1]);
      }
    }
  }

  const maxDist = Math.max(...dist.values());
  const deep = cells.filter((c) => dist.get(toCellKey(c.galx, c.galy)) === maxDist);
  const src = deep.length > 0 ? deep : cells;
  const sumX = src.reduce((s, c) => s + c.galx + 0.5, 0);
  const sumY = src.reduce((s, c) => s + c.galy + 0.5, 0);
  return [sumX / src.length, sumY / src.length];
}

function healOwnershipGaps(
  ownership: Map<string, string>,
  sectorBounds: Map<string, { minX: number; maxX: number; minY: number; maxY: number }>,
  worldBounds: { minX: number; maxX: number; minY: number; maxY: number }
): Map<string, string> {
  const healed = new Map(ownership);
  const deltas = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]] as const;
  let changed = true;
  let passes = 0;
  while (changed && passes < 3) {
    changed = false;
    passes++;
    const pending: Array<{ key: string; uid: string }> = [];
    for (let galx = worldBounds.minX; galx <= worldBounds.maxX; galx++) {
      for (let galy = worldBounds.minY; galy <= worldBounds.maxY; galy++) {
        const key = toCellKey(galx, galy);
        if (healed.has(key)) continue;
        const neighborCounts = new Map<string, number>();
        for (const [dx, dy] of deltas) {
          const uid = healed.get(toCellKey(galx + dx, galy + dy));
          if (uid) neighborCounts.set(uid, (neighborCounts.get(uid) ?? 0) + 1);
        }
        const winner = Array.from(neighborCounts.entries()).sort((a, b) =>
          b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])
        )[0];
        if (!winner || winner[1] < 3) continue;
        const bounds = sectorBounds.get(winner[0]);
        if (bounds && (galx < bounds.minX || galx > bounds.maxX || galy < bounds.minY || galy > bounds.maxY)) continue;
        pending.push({ key, uid: winner[0] });
      }
    }
    for (const { key, uid } of pending) { healed.set(key, uid); changed = true; }
  }
  return healed;
}

self.onmessage = (event: MessageEvent<GeometryRequest>) => {
  const { requestId, sectors } = event.data;

  // Build raw geometry per sector
  const rawGeometry = sectors.map((sector) => {
    const points = sector.outline_coordinates
      .map((p): [number, number] => [p.galx, p.galy])
      .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
    if (points.length < 3) return { uid: sector.uid, cells: [] as SectorCell[], sectorBounds: null as null | { minX: number; maxX: number; minY: number; maxY: number } };

    const b = sector.bounds;
    const bounds = b
      ? { minX: b.min_galx, maxX: b.max_galx, minY: b.min_galy, maxY: b.max_galy }
      : points.reduce(
          (acc, [x, y]) => ({
            minX: Math.min(acc.minX, x), maxX: Math.max(acc.maxX, x),
            minY: Math.min(acc.minY, y), maxY: Math.max(acc.maxY, y),
          }),
          { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
        );
    return { uid: sector.uid, cells: buildSectorCells(points, bounds), sectorBounds: bounds };
  });

  // Resolve cell ownership: smaller sectors win
  const ownership = new Map<string, string>();
  const sorted = [...rawGeometry].sort((a, b) => {
    if (a.cells.length !== b.cells.length) return a.cells.length - b.cells.length;
    return a.uid.localeCompare(b.uid);
  });
  for (const sector of sorted) {
    for (const cell of sector.cells) {
      const key = toCellKey(cell.galx, cell.galy);
      if (!ownership.has(key)) ownership.set(key, sector.uid);
    }
  }

  // Heal gaps: unowned cells surrounded by 3+ neighbours of the same sector get assigned to it
  const sectorBoundsMap = new Map(rawGeometry.filter(s => s.sectorBounds).map(s => [s.uid, s.sectorBounds!]));
  const allBounds = rawGeometry.map(s => s.sectorBounds).filter(Boolean) as Array<{ minX: number; maxX: number; minY: number; maxY: number }>;
  if (allBounds.length > 0) {
    const worldBounds = {
      minX: Math.min(...allBounds.map(b => b.minX)),
      maxX: Math.max(...allBounds.map(b => b.maxX)),
      minY: Math.min(...allBounds.map(b => b.minY)),
      maxY: Math.max(...allBounds.map(b => b.maxY)),
    };
    const healed = healOwnershipGaps(ownership, sectorBoundsMap, worldBounds);
    healed.forEach((uid, key) => { if (!ownership.has(key)) ownership.set(key, uid); });
  }

  // Build final geometry with owned cells only
  const sectorGeometry: SectorGeometryEntry[] = rawGeometry.map((sector) => {
    const cells = Array.from(ownership.entries())
      .filter(([, uid]) => uid === sector.uid)
      .map(([key]) => {
        const [galx, galy] = key.split(":").map(Number);
        return { galx, galy };
      });
    return { uid: sector.uid, cells, boundarySegments: buildBoundarySegments(cells) };
  });

  // Compute label centroids
  const labelCentroids: Record<string, [number, number]> = {};
  for (const sector of sectorGeometry) {
    if (sector.cells.length > 0) {
      labelCentroids[sector.uid] = computeLabelCentroid(sector.cells);
    }
  }

  const response: GeometryResponse = { requestId, sectorGeometry, labelCentroids };
  self.postMessage(response);
};
