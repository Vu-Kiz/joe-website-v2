// Compass bearing convention for the galaxy's galx/galy axes: 0°=N, 90°=E, 180°=S, 270°=W.
// North (0°) is +galy (confirmed empirically — galy increases northward), east (90°) is +galx.
// Unit direction for a ray cast from a bearing: dx = sin(bearing), dy = cos(bearing).

import type { BountyRangeBand } from "../api/member/bountyHunting";

export type GalaxyPoint = { galx: number; galy: number };
export type LocationCluster = GalaxyPoint & { supportCount: number; polygon: GalaxyPoint[] };
type Point = { x: number; y: number };
type Polygon = Point[];

// The Tracking Fob only gives an 8-point compass bearing (45° steps), so a reading is
// really a ±22.5° uncertainty wedge, not a precise line — the true bearing could be
// anywhere within that range and still round to the same compass direction.
export const WEDGE_HALF_ANGLE_DEGREES = 22.5;

export function bearingToUnitVector(bearingDegrees: number): { dx: number; dy: number } {
  const rad = (bearingDegrees * Math.PI) / 180;
  return { dx: Math.sin(rad), dy: Math.cos(rad) };
}

// Standard ray-casting point-in-polygon test. Used to find every candidate world that
// genuinely falls within a cluster's uncertainty region — picking only the single
// nearest world to the centroid was misleading whenever the region was still wide
// enough to plausibly contain several different worlds.
export function pointInPolygon(point: GalaxyPoint, polygon: GalaxyPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].galx, yi = polygon[i].galy;
    const xj = polygon[j].galx, yj = polygon[j].galy;
    const intersects = yi > point.galy !== yj > point.galy
      && point.galx < ((xj - xi) * (point.galy - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

type Scan = { scanGalx: number; scanGaly: number; bearingDegrees: number; rangeBand?: BountyRangeBand | null };

// The galaxy's actual playable bounds. Nothing computed from scans — a wedge's
// truncation `radius`, the suggested-next-scan search ring, etc — should ever be
// allowed to represent a location outside this square; it doesn't exist.
const GALAXY_BOUND = 500;
const GALAXY_BOUNDS_SQUARE: Polygon = [
  { x: -GALAXY_BOUND, y: -GALAXY_BOUND },
  { x: GALAXY_BOUND, y: -GALAXY_BOUND },
  { x: GALAXY_BOUND, y: GALAXY_BOUND },
  { x: -GALAXY_BOUND, y: GALAXY_BOUND },
];

// Tracking Fob range bands (SWC docs): inner ~0-33, mid ~33-67, outer ~67-100,
// beyond_100 ranges past that. bearing_only means no range was given at all, so it
// doesn't constrain distance. Bounds are approximate band edges, not exact readings —
// shared with the single-scan candidate-world filter in BountyHuntingPanel.tsx.
export const RANGE_BAND_DISTANCE: Record<BountyRangeBand, { min: number; max: number }> = {
  bearing_only: { min: 0, max: Infinity },
  inner: { min: 0, max: 33 },
  mid: { min: 33, max: 67 },
  outer: { min: 67, max: 100 },
  beyond_100: { min: 100, max: Infinity },
};

// Clips `polygon` to the half-plane on whichever side of the line through `a` and `b`
// contains `keepSide` — without needing to know the clip polygon's winding order up
// front.
function clipBeyondLine(polygon: Polygon, a: Point, b: Point, keepSide: Point): Polygon {
  let pa = a;
  let pb = b;
  if (!isInside(keepSide, pa, pb)) [pa, pb] = [pb, pa];
  return clipPolygon(polygon, pa, pb);
}

// Same idea, but the line is given as a point plus a perpendicular direction rather
// than two explicit points (used for the max-distance cut, where cutting at the
// bisector is the safe bias — see buildWedgePolygon).
function clipPerpendicularAt(polygon: Polygon, point: Point, direction: { dx: number; dy: number }, keepSide: Point): Polygon {
  const big = 1e6;
  const perp = { x: -direction.dy, y: direction.dx };
  const a = { x: point.x - perp.x * big, y: point.y - perp.y * big };
  const b = { x: point.x + perp.x * big, y: point.y + perp.y * big };
  return clipBeyondLine(polygon, a, b, keepSide);
}

// Builds a scan's uncertainty wedge as a bounded polygon (apex at the scan position,
// two far corners along the ±22.5° boundary bearings) — a convex shape approximating
// the infinite cone, truncated far enough out (`radius`) to contain anywhere the scans
// could plausibly converge. If the scan has a logged range band, the wedge is further
// cut to that band's approximate min/max distance along its center bearing — not a
// true arc (an exact annulus sector isn't convex, and the existing intersection math
// only handles convex polygons), but a reasonable, convexity-preserving approximation
// given the range bands are themselves loose ~33-unit buckets.
function buildWedgePolygon(scan: Scan, radius: number): Polygon {
  const left = bearingToUnitVector(scan.bearingDegrees - WEDGE_HALF_ANGLE_DEGREES);
  const right = bearingToUnitVector(scan.bearingDegrees + WEDGE_HALF_ANGLE_DEGREES);
  let wedge: Polygon = [
    { x: scan.scanGalx, y: scan.scanGaly },
    { x: scan.scanGalx + left.dx * radius, y: scan.scanGaly + left.dy * radius },
    { x: scan.scanGalx + right.dx * radius, y: scan.scanGaly + right.dy * radius },
  ];

  const { min, max } = RANGE_BAND_DISTANCE[scan.rangeBand ?? "bearing_only"];
  if (min > 0 || Number.isFinite(max)) {
    const apex = { x: scan.scanGalx, y: scan.scanGaly };
    const bisector = bearingToUnitVector(scan.bearingDegrees);
    if (min > 0) {
      // A flat cut through the bisector's own point at distance `min` looks right but
      // isn't: a point near the wedge's edge angle has a smaller projection onto the
      // bisector than its true straight-line distance from the apex, so a real target
      // exactly at distance `min` (or just past it) near the edge can end up on the
      // wrong side of that cut and get wrongly excluded — this actually happened (a
      // real, confirmed-correct target at true distance 101 got excluded by a
      // beyond_100 band's min=100 cut). The arc of radius `min` always bulges farther
      // from the apex than the chord between its two wedge-edge points, so cutting
      // along that chord instead is guaranteed to never falsely exclude anything at or
      // beyond the true radius — the tradeoff is some extra area nearer than `min`
      // close to the bisector stays included, which is the safe direction to be wrong.
      const pMinLeft = { x: scan.scanGalx + left.dx * min, y: scan.scanGaly + left.dy * min };
      const pMinRight = { x: scan.scanGalx + right.dx * min, y: scan.scanGaly + right.dy * min };
      const farPoint = { x: scan.scanGalx + bisector.dx * radius, y: scan.scanGaly + bisector.dy * radius };
      wedge = clipBeyondLine(wedge, pMinLeft, pMinRight, farPoint);
    }
    if (Number.isFinite(max)) {
      const pMax = { x: scan.scanGalx + bisector.dx * max, y: scan.scanGaly + bisector.dy * max };
      wedge = clipPerpendicularAt(wedge, pMax, bisector, apex);
    }
  }

  // `radius` is sized off the spread between scans, not the actual galaxy — for
  // near-parallel scans (similar position, similar bearing) it can run far past the
  // real map edge before the cones meaningfully diverge, letting their "overlap"
  // balloon out to a nonsense, off-map result. Clipping to the real bounds here
  // guarantees every wedge — and therefore every cluster/suggestion derived from it —
  // stays inside the galaxy regardless of how generous `radius` needs to be.
  return intersectConvexPolygons(wedge, GALAXY_BOUNDS_SQUARE);
}

function signedArea(poly: Polygon): number {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    sum += p1.x * p2.y - p2.x * p1.y;
  }
  return sum / 2;
}

function ensureCCW(poly: Polygon): Polygon {
  return signedArea(poly) < 0 ? [...poly].reverse() : poly;
}

function isInside(p: Point, a: Point, b: Point): boolean {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= 0;
}

function lineIntersect(p1: Point, p2: Point, a: Point, b: Point): Point {
  const a1 = p2.y - p1.y;
  const b1 = p1.x - p2.x;
  const c1 = a1 * p1.x + b1 * p1.y;
  const a2 = b.y - a.y;
  const b2 = a.x - b.x;
  const c2 = a2 * a.x + b2 * a.y;
  const det = a1 * b2 - a2 * b1;
  if (Math.abs(det) < 1e-9) return p2; // parallel edges — shouldn't occur for our wedge shapes
  return { x: (b2 * c1 - b1 * c2) / det, y: (a1 * c2 - a2 * c1) / det };
}

// Sutherland-Hodgman: clips `polygon` to the half-plane inside the directed edge a→b.
function clipPolygon(polygon: Polygon, a: Point, b: Point): Polygon {
  const output: Polygon = [];
  const n = polygon.length;
  if (n === 0) return output;
  for (let i = 0; i < n; i++) {
    const current = polygon[i];
    const prev = polygon[(i - 1 + n) % n];
    const currentInside = isInside(current, a, b);
    const prevInside = isInside(prev, a, b);
    if (currentInside) {
      if (!prevInside) output.push(lineIntersect(prev, current, a, b));
      output.push(current);
    } else if (prevInside) {
      output.push(lineIntersect(prev, current, a, b));
    }
  }
  return output;
}

// Intersection of two convex polygons via repeated Sutherland-Hodgman clipping.
function intersectConvexPolygons(poly1: Polygon, poly2: Polygon): Polygon {
  let result = poly1;
  const clip = ensureCCW(poly2);
  for (let i = 0; i < clip.length && result.length > 0; i++) {
    result = clipPolygon(result, clip[i], clip[(i + 1) % clip.length]);
  }
  return result;
}

function polygonCentroidAndArea(poly: Polygon): { centroid: Point; area: number } {
  let area = 0;
  let cx = 0;
  let cy = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % n];
    const cross = p1.x * p2.y - p2.x * p1.y;
    area += cross;
    cx += (p1.x + p2.x) * cross;
    cy += (p1.y + p2.y) * cross;
  }
  area = area / 2;
  if (Math.abs(area) < 1e-9) {
    const avg = poly.reduce((sum, p) => ({ x: sum.x + p.x, y: sum.y + p.y }), { x: 0, y: 0 });
    return { centroid: { x: avg.x / n, y: avg.y / n }, area: 0 };
  }
  return { centroid: { x: cx / (6 * area), y: cy / (6 * area) }, area: Math.abs(area) };
}

function boundingBoxDiagonal(scans: Scan[]): number {
  const xs = scans.map((s) => s.scanGalx);
  const ys = scans.map((s) => s.scanGaly);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

// Given 2+ scans, builds each one's uncertainty wedge and finds where they geometrically
// overlap — the real model for an 8-point compass bearing, instead of pretending each
// reading is a precise line. For every scan as a starting point, greedily grows the
// largest group of wedges with a non-empty common intersection (Sutherland-Hodgman
// convex polygon clipping). Each surviving region is a distinct "possible location,"
// ranked by how many scans agree on it (supportCount), with its area-weighted centroid
// as the representative point — tighter, higher-support regions sort first.
export function clusterTriangulatedLocations(scans: Scan[]): LocationCluster[] {
  if (scans.length < 2) return [];

  const radius = Math.max(500, 5 * boundingBoxDiagonal(scans));
  const wedges = scans.map((s) => ensureCCW(buildWedgePolygon(s, radius)));

  const candidates: Array<{ support: Set<number>; region: Polygon }> = [];
  for (let seedIndex = 0; seedIndex < scans.length; seedIndex++) {
    let region = wedges[seedIndex];
    const support = new Set([seedIndex]);
    for (let j = 0; j < scans.length; j++) {
      if (j === seedIndex) continue;
      const candidateRegion = intersectConvexPolygons(region, wedges[j]);
      if (candidateRegion.length >= 3 && polygonCentroidAndArea(candidateRegion).area > 1e-6) {
        region = candidateRegion;
        support.add(j);
      }
    }
    candidates.push({ support, region });
  }

  const seenSupportSets = new Set<string>();
  const deduped = candidates.filter((c) => {
    const key = [...c.support].sort((a, b) => a - b).join(",");
    if (seenSupportSets.has(key)) return false;
    seenSupportSets.add(key);
    return true;
  });

  return deduped
    .map((c) => {
      const { centroid, area } = polygonCentroidAndArea(c.region);
      return {
        galx: Math.round(centroid.x),
        galy: Math.round(centroid.y),
        supportCount: c.support.size,
        polygon: c.region.map((p) => ({ galx: p.x, galy: p.y })),
        area,
      };
    })
    .sort((a, b) => b.supportCount - a.supportCount || a.area - b.area)
    .map(({ galx, galy, supportCount, polygon }) => ({ galx, galy, supportCount, polygon }));
}

// Thin wrapper over clusterTriangulatedLocations for callers that just want a single
// best-estimate point (e.g. the persisted estimated_galx/galy on a contract).
export function triangulateFromScans(scans: Scan[]): GalaxyPoint | null {
  const clusters = clusterTriangulatedLocations(scans);
  return clusters.length > 0 ? { galx: clusters[0].galx, galy: clusters[0].galy } : null;
}

function quantizeBearing(bearingDegrees: number): number {
  return (Math.round(bearingDegrees / 45) * 45) % 360;
}

function trueBearingBetween(from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
}

// Probes the worst-case outcome of a candidate next scan using points spread across
// the current region rather than every interior point — vertices and edge midpoints
// are where "how much does a new reading actually narrow this down" tends to be most
// sensitive, since a region's worst case is driven by its extremes, not its middle.
function samplePolygonPoints(polygon: Polygon): Point[] {
  const { centroid } = polygonCentroidAndArea(polygon);
  const points: Point[] = [centroid];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    points.push(a, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  }
  return points;
}

// Candidate next-scan distances from the current region's centroid, and how many
// angles to test at each distance — closer scans generally resolve better (the same
// ±22.5° angular uncertainty covers less ground), but a few longer distances are
// included in case the region is large enough that a tight read needs more separation.
const CANDIDATE_RADII = [30, 60, 100, 150, 220];
const CANDIDATE_ANGLE_STEPS = 16;

// Ranks candidate next-scan positions around the current best region (the top
// cluster's overlap polygon once there are 2+ scans, or the lone scan's own wedge with
// just one) by how well each narrows things down, instead of guessing blindly — by
// directly reusing the same wedge/intersection math that powers the triangulation
// itself. For each candidate, every plausible true-target sample point implies a
// (quantized) bearing reading from there, and intersecting the resulting wedge back
// against the region shows how much would survive. The candidates that minimize the
// worst case across all those samples — i.e. narrow things down no matter where the
// target turns out to be — rank first.
//
// When the region already resolves to specific named candidate worlds (`knownPoints`)
// rather than just generic geometry, those exact points are probed too, and become the
// center of the search ring — generic polygon-shape sampling alone can miss them
// entirely if they sit off to one side of an otherwise large region, recommending a
// scan that shrinks the overall area without ever actually separating the candidates
// (e.g. two candidates 33 units apart inside a region whose centroid is 150 units
// away). Probing the real candidates directly also captures the single best
// disambiguator for free: standing roughly between two nearby candidates puts them at
// close to opposite bearings, and opposite bearings always round to different compass
// points, so whichever one is real, that single reading clears the other out.
//
// Returns the top `count` candidates, best (smallest worst-case area) first — callers
// that also care about travel time/practicality (e.g. via the Hyper Planner) can check
// a few of the best geometric candidates against real travel cost and pick whichever
// of those is actually reachable, rather than blindly committing to the single
// geometric optimum which might be impractically far away.
//
// `nearbySystems`, when given, are evaluated as candidates too, competing on equal
// footing with the generic search ring — a real system that happens to be just as
// informative as a ring point is far more useful to suggest, since travel to it can
// ride the actual hyperlane network most of the way rather than ending in a slow
// direct jump through empty space to an arbitrary point nothing connects to.
export function suggestNextScanPositions(
  scans: Scan[],
  knownPoints: GalaxyPoint[] = [],
  count = 8,
  nearbySystems: Array<GalaxyPoint & { name?: string | null }> = []
): Array<GalaxyPoint & { systemName?: string | null }> {
  if (scans.length === 0) return [];

  const radius = Math.max(500, 5 * boundingBoxDiagonal(scans));
  let region: Polygon;
  if (scans.length === 1) {
    region = ensureCCW(buildWedgePolygon(scans[0], radius));
  } else {
    const clusters = clusterTriangulatedLocations(scans);
    if (clusters.length === 0) return [];
    region = ensureCCW(clusters[0].polygon.map((p) => ({ x: p.galx, y: p.galy })));
  }
  if (region.length < 3) return [];

  const { centroid: polygonCentroid, area: regionArea } = polygonCentroidAndArea(region);
  if (regionArea <= 0) return [];

  const knownSamples = knownPoints.map((p) => ({ x: p.galx, y: p.galy }));
  // With 2+ named candidates, the actual goal is telling THEM apart — blending in the
  // generic region-shape samples too let the broader region's geometry dilute and
  // outrank the disambiguation goal (e.g. recommending a scan that shrinks the overall
  // area without ever separating two candidates sitting close together off to one
  // side). Below 2 known points there's nothing specific to disambiguate, so fall back
  // to the generic samples.
  const samplePoints = knownSamples.length >= 2 ? knownSamples : [...samplePolygonPoints(region), ...knownSamples];
  const centroid = knownSamples.length > 0
    ? { x: knownSamples.reduce((sum, p) => sum + p.x, 0) / knownSamples.length, y: knownSamples.reduce((sum, p) => sum + p.y, 0) / knownSamples.length }
    : polygonCentroid;

  function worstCaseAreaAt(candidate: Point): number {
    let worstArea = 0;
    for (const sample of samplePoints) {
      if (sample.x === candidate.x && sample.y === candidate.y) continue;
      const bearing = quantizeBearing(trueBearingBetween(candidate, sample));
      const wedge = ensureCCW(buildWedgePolygon({ scanGalx: candidate.x, scanGaly: candidate.y, bearingDegrees: bearing }, radius));
      const clipped = intersectConvexPolygons(region, wedge);
      const resultArea = clipped.length >= 3 ? polygonCentroidAndArea(clipped).area : 0;
      if (resultArea > worstArea) worstArea = resultArea;
    }
    return worstArea;
  }

  const candidates: { point: Point; worstArea: number; systemName?: string | null }[] = [];

  // The ring below starts at a nonzero radius, so without this the centroid itself —
  // the literal midpoint when there are exactly two known candidates, which is also
  // the single best disambiguator between two close candidates (their bearings from
  // there are closest to opposite, and opposite bearings always round to different
  // compass points) — would never actually be tested as an option.
  if (Math.abs(centroid.x) <= GALAXY_BOUND && Math.abs(centroid.y) <= GALAXY_BOUND) {
    candidates.push({ point: centroid, worstArea: worstCaseAreaAt(centroid) });
  }

  for (const candidateRadius of CANDIDATE_RADII) {
    for (let i = 0; i < CANDIDATE_ANGLE_STEPS; i++) {
      const dir = bearingToUnitVector((i / CANDIDATE_ANGLE_STEPS) * 360);
      const candidate = { x: centroid.x + dir.dx * candidateRadius, y: centroid.y + dir.dy * candidateRadius };
      if (Math.abs(candidate.x) > GALAXY_BOUND || Math.abs(candidate.y) > GALAXY_BOUND) continue;
      candidates.push({ point: candidate, worstArea: worstCaseAreaAt(candidate) });
    }
  }

  for (const system of nearbySystems) {
    const point = { x: system.galx, y: system.galy };
    candidates.push({ point, worstArea: worstCaseAreaAt(point), systemName: system.name });
  }

  return candidates
    .sort((a, b) => a.worstArea - b.worstArea)
    .slice(0, count)
    .map((c) => ({ galx: Math.round(c.point.x), galy: Math.round(c.point.y), systemName: c.systemName }));
}

// Thin wrapper over suggestNextScanPositions for callers that just want the single
// best geometric candidate, with no regard for travel time/practicality.
export function suggestNextScanPosition(scans: Scan[], knownPoints: GalaxyPoint[] = []): GalaxyPoint | null {
  return suggestNextScanPositions(scans, knownPoints, 1)[0] ?? null;
}
