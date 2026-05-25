import type { StoredWeaponTypeSummary } from "../../../api/universe/universe";

export type HeatCell = {
  x: number;
  y: number;
  distance: number;
  bearing: number;
  hitChance: number;
  averageRoundsToHit: number | null;
  likelyRoundsToHit: number | null;
};

export type HeatmapBoardMode = "auto" | "space" | "atmo" | "ground";
export type GridPoint = { x: number; y: number };
export type WeaponArcWindow = { start: number; end: number } | null;

export function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function roundsToFirstHit(hitChance: number, maxHits: number) {
  const normalizedHitChance = clamp01(hitChance);
  const normalizedMaxHits = Math.max(1, maxHits);
  const roundHitChance = 1 - Math.pow(1 - normalizedHitChance, normalizedMaxHits);

  if (roundHitChance <= 0) {
    return null;
  }

  return 1 / roundHitChance;
}

export function roundsToLikelyHit(hitChance: number, maxHits: number, targetConfidence = 0.9) {
  const normalizedHitChance = clamp01(hitChance);
  const normalizedMaxHits = Math.max(1, maxHits);
  const roundHitChance = 1 - Math.pow(1 - normalizedHitChance, normalizedMaxHits);

  if (roundHitChance <= 0) {
    return null;
  }

  if (roundHitChance >= 1) {
    return 1;
  }

  return Math.log(1 - targetConfidence) / Math.log(1 - roundHitChance);
}

export function formatNumber(value: number | null | undefined, digits = 2, fallback = "Unknown") {
  if (value == null || Number.isNaN(value)) {
    return fallback;
  }

  return Number(value)
    .toFixed(digits)
    .replace(/\.00$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

export function isHeatmapEligibleWeapon(weapon: StoredWeaponTypeSummary) {
  const normalizedClass = String(weapon.class_name ?? "").trim().toLowerCase();
  return normalizedClass !== "creature" && normalizedClass !== "non projectile";
}

export function getBoardDimensions(maxRange: number, boardMode: HeatmapBoardMode, atmoBoardSize = 20) {
  const autoRadius = Math.max(4, Math.min(18, Math.ceil(maxRange)));
  const normalizedAtmoSize = Math.max(1, Math.min(20, Math.round(atmoBoardSize)));
  const width = boardMode === "space"
    ? 20
    : boardMode === "atmo"
      ? normalizedAtmoSize
      : boardMode === "ground"
        ? 21
        : autoRadius * 2 + 1;
  const height = boardMode === "space"
    ? 20
    : boardMode === "atmo"
      ? normalizedAtmoSize
      : boardMode === "ground"
        ? 21
        : autoRadius * 2 + 1;
  const centerX = boardMode === "space"
    ? 9.5
    : boardMode === "atmo"
      ? (normalizedAtmoSize - 1) / 2
      : boardMode === "ground"
        ? 10
        : autoRadius;
  const centerY = boardMode === "space"
    ? 9.5
    : boardMode === "atmo"
      ? (normalizedAtmoSize - 1) / 2
      : boardMode === "ground"
        ? 10
        : autoRadius;

  return { width, height, centerX, centerY };
}

export function defaultOriginForBoard(maxRange: number, boardMode: HeatmapBoardMode, atmoBoardSize = 20): GridPoint {
  const { centerX, centerY } = getBoardDimensions(maxRange, boardMode, atmoBoardSize);
  return { x: Math.round(centerX), y: Math.round(centerY) };
}

export function clampPointToBoard(
  point: GridPoint | null,
  maxRange: number,
  boardMode: HeatmapBoardMode,
  atmoBoardSize = 20
): GridPoint {
  const { width, height } = getBoardDimensions(maxRange, boardMode, atmoBoardSize);
  const fallback = defaultOriginForBoard(maxRange, boardMode, atmoBoardSize);
  const nextPoint = point ?? fallback;

  return {
    x: Math.max(0, Math.min(width - 1, nextPoint.x)),
    y: Math.max(0, Math.min(height - 1, nextPoint.y)),
  };
}

function swcRangeDistance(fromX: number, fromY: number, toX: number, toY: number) {
  const offsetX = toX - fromX;
  const offsetY = toY - fromY;

  return Math.ceil(Math.sqrt((offsetX * offsetX) + (offsetY * offsetY)));
}

export function normalizeDegrees(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function bearingFromPoint(fromX: number, fromY: number, toX: number, toY: number) {
  const offsetX = toX - fromX;
  const offsetY = toY - fromY;

  if (offsetX === 0 && offsetY === 0) {
    return 0;
  }

  return normalizeDegrees((Math.atan2(offsetX, -offsetY) * 180) / Math.PI);
}

export function resolveWeaponArcWindow(arcName: string | null, arcFrom?: number | null, arcTo?: number | null): WeaponArcWindow {
  if (arcFrom != null && arcTo != null && !Number.isNaN(arcFrom) && !Number.isNaN(arcTo)) {
    return { start: normalizeDegrees(arcFrom), end: normalizeDegrees(arcTo) };
  }

  const normalized = String(arcName ?? "").trim().toLowerCase();
  const arcMap: Record<string, WeaponArcWindow> = {
    omnidirectional: { start: 0, end: 360 },
    frontal: { start: 225, end: 135 },
    "frontal 270": { start: 225, end: 135 },
    front: { start: 315, end: 45 },
    "front 90": { start: 315, end: 45 },
    port: { start: 225, end: 315 },
    "port 90": { start: 225, end: 315 },
    starboard: { start: 45, end: 135 },
    "starboard 90": { start: 45, end: 135 },
    rear: { start: 135, end: 225 },
    "rear 90": { start: 135, end: 225 },
    "port 180": { start: 180, end: 0 },
    "starboard 180": { start: 0, end: 180 },
    "port 50": { start: 180, end: 0 },
    "starboard 50": { start: 0, end: 180 },
    "front 50": { start: 270, end: 90 },
    "rear 50": { start: 90, end: 270 },
    "front 60": { start: 330, end: 30 },
    "rear 60": { start: 150, end: 210 },
    "port 60": { start: 240, end: 300 },
    "starboard 60": { start: 60, end: 120 },
    "port 120": { start: 210, end: 330 },
    "starboard 120": { start: 30, end: 150 },
    "front 120": { start: 300, end: 60 },
    "rear 120": { start: 120, end: 240 },
  };

  return arcMap[normalized] ?? null;
}

export function isBearingWithinArc(relativeBearing: number, arcWindow: WeaponArcWindow) {
  if (!arcWindow) {
    return true;
  }

  const bearing = normalizeDegrees(relativeBearing);
  const start = normalizeDegrees(arcWindow.start);
  const end = normalizeDegrees(arcWindow.end);

  if (start === end) {
    return true;
  }

  if (start < end) {
    return bearing >= start && bearing <= end;
  }

  return bearing >= start || bearing <= end;
}

export function buildHeatCells(
  weapon: StoredWeaponTypeSummary | null,
  boardMode: HeatmapBoardMode,
  origin: GridPoint | null,
  atmoBoardSize = 20
): HeatCell[] {
  if (!weapon) {
    return [];
  }

  const optimum = Math.max(0, Number(weapon.optimum_range ?? 0));
  const dropOff = Math.max(0, Number(weapon.drop_off ?? 0));
  const maxRange = Math.max(optimum, optimum + dropOff);
  const { width, height, centerX, centerY } = getBoardDimensions(maxRange, boardMode, atmoBoardSize);
  const originX = origin?.x ?? Math.round(centerX);
  const originY = origin?.y ?? Math.round(centerY);
  const maxHits = weapon.max_hits == null || Number.isNaN(Number(weapon.max_hits))
    ? 1
    : Math.max(1, Number(weapon.max_hits));
  const cells: HeatCell[] = [];

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const distance = swcRangeDistance(originX, originY, col, row);
      const bearing = bearingFromPoint(originX, originY, col, row);
      const deltaRange = Math.abs(optimum - distance);

      let hitChance = 0;

      if (maxRange === 0) {
        hitChance = 0;
      } else if (dropOff <= 0) {
        hitChance = deltaRange === 0 ? 1 : Math.max(0, 1 - 0.003 * deltaRange);
      } else {
        const logisticPenalty = 0.95 / (1 + Math.exp(-2 * (deltaRange - dropOff)));
        hitChance = (1 - logisticPenalty) - (0.003 * deltaRange);
      }

      hitChance = clamp01(hitChance);
      const averageRoundsToHit = roundsToFirstHit(hitChance, maxHits);
      const likelyRoundsToHit = roundsToLikelyHit(hitChance, maxHits);

      cells.push({
        x: col,
        y: row,
        distance,
        bearing,
        hitChance,
        averageRoundsToHit,
        likelyRoundsToHit,
      });
    }
  }

  return cells;
}

export function heatColor(hitChance: number) {
  const normalized = clamp01(hitChance);
  const alpha = 0.14 + normalized * 0.78;
  const red = Math.round(110 + normalized * 145);
  const green = Math.round(50 + normalized * 120);
  const blue = Math.round(24 + normalized * 40);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
