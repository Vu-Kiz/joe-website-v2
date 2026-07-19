import React, { useId } from "react";
import { WEDGE_HALF_ANGLE_DEGREES, bearingToUnitVector, type LocationCluster } from "../../utils/triangulation";
// galaxyMap.png is actually a palette/dithered GIF saved with a .png extension — its
// dithering pattern aliases into a moiré under any downscaling, no matter how it's
// rendered. galaxyMapSmooth.png is a pre-filtered, resized (600x600), true-color
// rendition that removes the dithering noise before it ever reaches the browser's
// own scaling.
import galaxyMapImage from "../../assets/swc/galaxyMapSmooth.png";

type ScanPoint = {
  id: number;
  scan_galx: number;
  scan_galy: number;
  bearing_degrees: number;
};

type ResolvedCluster = LocationCluster & { worldName?: string | null; hasResolvedWorlds?: boolean };

type CandidateWorldPoint = {
  id: number;
  name: string;
  galx: number;
  galy: number;
  isConfirmed?: boolean;
};

type Props = {
  scans: ScanPoint[];
  clusters: ResolvedCluster[];
  candidateWorlds?: CandidateWorldPoint[];
  suggestedScan?: { galx: number; galy: number } | null;
};

// galaxyMap.png is a fixed 1000x1000 render of the whole galaxy, spanning exactly
// galx/galy -500..500. North is the top of the image, east is the right.
const GALAXY_IMAGE_MIN = -500;
const GALAXY_IMAGE_SIZE = 1000;
const GALAXY_IMAGE_MAX = GALAXY_IMAGE_MIN + GALAXY_IMAGE_SIZE;

// A scan's bearing wedge is only meaningful out to the edge of the galaxy — nothing
// can be tracked past the map boundary, so the cone shouldn't visually suggest
// otherwise. Returns the distance from (ox, oy) to where the ray first exits the
// [GALAXY_IMAGE_MIN, GALAXY_IMAGE_MAX] square, assuming the origin is inside it.
function rayMapExitDistance(ox: number, oy: number, dx: number, dy: number): number {
  let t = Infinity;
  if (dx !== 0) t = Math.min(t, ((dx > 0 ? GALAXY_IMAGE_MAX : GALAXY_IMAGE_MIN) - ox) / dx);
  if (dy !== 0) t = Math.min(t, ((dy > 0 ? GALAXY_IMAGE_MAX : GALAXY_IMAGE_MIN) - oy) / dy);
  return t;
}

// Picks a "nice" grid spacing (1/2/5 * 10^n) closest to ~1/8th of the given span.
function niceGridStep(span: number): number {
  const raw = span / 8;
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  const step = normalized < 1.5 ? 1 : normalized < 3.5 ? 2 : normalized < 7.5 ? 5 : 10;
  return step * magnitude;
}

// SVG y increases downward, but galy increases northward (toward the top of
// galaxyMap.png) — render space flips the sign once here so every coordinate used
// below (including the fixed image placement) lines up consistently, regardless of
// how zoomed-in the current view is. Unlike a viewBox-relative flip transform, this
// fixed mapping keeps the background image's north edge anchored at the same render
// position no matter what area the scans/clusters happen to span.
function toRenderY(galy: number): number {
  return -galy;
}

const ARC_STEPS = 16;

const BountyTriangulationMap: React.FC<Props> = ({ scans, clusters, candidateWorlds = [], suggestedScan = null }) => {
  // Unique per-instance id — multiple contracts' maps can be expanded at once, and a
  // duplicated <mask> id would make every instance reference whichever one happens to
  // be first in the DOM. Must run before the early return below (rules of hooks).
  const maskId = `cone-mask-${useId()}`;

  if (scans.length === 0) return null;

  // Full galaxy diagonal — used only as the upper bound on how far a wedge ray can
  // reach (rayMapExitDistance already caps it further, to the map edge).
  const galaxyDiagonal = Math.hypot(GALAXY_IMAGE_SIZE, GALAXY_IMAGE_SIZE);

  // Each scan's wedge fan, computed once and reused both for the viewBox bounds and
  // for rendering — a straight chord between the two boundary rays would cut off a
  // real bulge of area near the far edge that's still within the angle and the map,
  // so the full ±22.5° arc is swept in fine steps instead, each ray capped at its own
  // map-exit distance.
  const scanWedges = scans.map((scan) => {
    const scanY = toRenderY(scan.scan_galy);
    const fanPoints: { x: number; y: number }[] = [];
    for (let i = 0; i <= ARC_STEPS; i++) {
      const bearing = scan.bearing_degrees - WEDGE_HALF_ANGLE_DEGREES + (i / ARC_STEPS) * (2 * WEDGE_HALF_ANGLE_DEGREES);
      const dir = bearingToUnitVector(bearing);
      const len = Math.min(galaxyDiagonal, rayMapExitDistance(scan.scan_galx, scan.scan_galy, dir.dx, dir.dy));
      // dy is in galy-space (north = +dy); negate it for render-space same as toRenderY.
      fanPoints.push({ x: scan.scan_galx + dir.dx * len, y: scanY - dir.dy * len });
    }
    return { scan, scanY, fanPoints };
  });

  // Always show the entire galaxy, full stop — zooming to fit the cone kept running
  // into edge cases (the cone reaching the map boundary, asymmetric margins, etc).
  // The cone itself is highlighted instead by dimming everything outside it (below),
  // so it still stands out clearly without needing to crop or zoom the map itself.
  const viewMinX = GALAXY_IMAGE_MIN;
  const viewMinY = GALAXY_IMAGE_MIN;
  const viewWidth = GALAXY_IMAGE_SIZE;
  const viewHeight = GALAXY_IMAGE_SIZE;
  const diagonal = Math.hypot(viewWidth, viewHeight);

  const strokeWidth = diagonal * 0.0015;
  const markerRadius = diagonal * 0.007;

  const gridStep = niceGridStep(Math.max(viewWidth, viewHeight));
  const gridLinesX: number[] = [];
  for (let x = Math.ceil(viewMinX / gridStep) * gridStep; x <= viewMinX + viewWidth; x += gridStep) {
    gridLinesX.push(x);
  }
  const gridLinesY: number[] = [];
  for (let y = Math.ceil(viewMinY / gridStep) * gridStep; y <= viewMinY + viewHeight; y += gridStep) {
    gridLinesY.push(y);
  }

  return (
    <div className="flex flex-col gap-2">
      <svg
        viewBox={`${viewMinX} ${viewMinY} ${viewWidth} ${viewHeight}`}
        className="w-full max-w-[500px] mx-auto rounded-lg border border-white/10 bg-[#0a0c10]"
        style={{ aspectRatio: `${viewWidth} / ${viewHeight}` }}
      >
        <image
          href={galaxyMapImage}
          x={GALAXY_IMAGE_MIN}
          y={toRenderY(-GALAXY_IMAGE_MIN)}
          width={GALAXY_IMAGE_SIZE}
          height={GALAXY_IMAGE_SIZE}
          preserveAspectRatio="none"
        />

        {/* Dims everything outside the wedge cone(s) so the relevant ray section
            stands out against the full, un-zoomed galaxy map — the mask is white
            (dark overlay visible) everywhere by default, with each cone's fan shape
            painted black (overlay hidden) to cut a "window" back to full brightness. */}
        <defs>
          <mask id={maskId}>
            <rect x={viewMinX} y={viewMinY} width={viewWidth} height={viewHeight} fill="white" />
            {scanWedges.map(({ scan, scanY, fanPoints }) => (
              <polygon
                key={`mask-wedge-${scan.id}`}
                points={`${scan.scan_galx},${scanY} ${fanPoints.map((p) => `${p.x},${p.y}`).join(" ")}`}
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect
          x={viewMinX}
          y={viewMinY}
          width={viewWidth}
          height={viewHeight}
          fill="rgba(5,6,8,0.75)"
          mask={`url(#${maskId})`}
        />

        <g stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth}>
          {gridLinesX.map((x) => (
            <line key={`gx-${x}`} x1={x} y1={viewMinY} x2={x} y2={viewMinY + viewHeight} />
          ))}
          {gridLinesY.map((y) => (
            <line key={`gy-${y}`} x1={viewMinX} y1={y} x2={viewMinX + viewWidth} y2={y} />
          ))}
        </g>

        {/* Each scan is only an 8-point compass bearing — really a ±22.5° uncertainty
            cone, not a precise line. Drawing every cone semi-transparent means areas
            where several scans' cones overlap darken naturally via alpha compositing,
            visually highlighting the convergence area with no extra rendering logic. */}
        {scanWedges.map(({ scan, scanY, fanPoints }) => (
          <polygon
            key={`wedge-${scan.id}`}
            points={`${scan.scan_galx},${scanY} ${fanPoints.map((p) => `${p.x},${p.y}`).join(" ")}`}
            fill="rgba(246,163,0,0.14)"
            stroke="rgba(246,163,0,0.4)"
            strokeWidth={strokeWidth * 0.5}
          />
        ))}

        {/* The "possible area" overlay — the actual wedge-overlap region, not just its
            centroid. A supportCount of 1 means the polygon is just that scan's full
            untruncated wedge (it never got narrowed by another scan), which would draw
            as a huge triangle covering most of the map, so only multi-scan agreement
            regions are shaded here. */}
        {clusters
          .filter((cluster) => cluster.supportCount >= 2 && cluster.polygon.length >= 3)
          .map((cluster, i) => (
            <polygon
              key={`area-${i}`}
              points={cluster.polygon.map((p) => `${p.galx},${toRenderY(p.galy)}`).join(" ")}
              fill="rgba(185,28,28,0.25)"
              stroke="#b91c1c"
              strokeWidth={strokeWidth}
              opacity={i === 0 ? 1 : 0.55}
            />
          ))}

        {candidateWorlds.map((world) => (
          <circle
            key={`world-${world.id}`}
            cx={world.galx}
            cy={toRenderY(world.galy)}
            r={world.isConfirmed ? markerRadius * 0.9 : markerRadius * 0.6}
            fill={world.isConfirmed ? "#b91c1c" : "rgba(255,255,255,0.65)"}
            stroke="#0a0c10"
            strokeWidth={world.isConfirmed ? strokeWidth : strokeWidth * 0.5}
          />
        ))}

        {/* The centroid marker only makes sense as its own "possible location" when
            there's no specific candidate world already pinpointing that region — once
            a region resolves to one or more named worlds (shown as white dots above),
            a separate red dot at the same spot is a redundant, competing marker. */}
        {clusters
          .filter((cluster) => !cluster.hasResolvedWorlds)
          .map((cluster, i) => (
            <circle
              key={`cluster-${i}`}
              cx={cluster.galx}
              cy={toRenderY(cluster.galy)}
              r={markerRadius * (1 + Math.min(cluster.supportCount, 5) * 0.1)}
              fill="#b91c1c"
              stroke="#0a0c10"
              strokeWidth={strokeWidth}
              opacity={i === 0 ? 1 : 0.6}
            />
          ))}

        {scans.map((scan) => (
          <circle
            key={`scan-${scan.id}`}
            cx={scan.scan_galx}
            cy={toRenderY(scan.scan_galy)}
            r={markerRadius}
            fill="#F6A300"
            stroke="#0a0c10"
            strokeWidth={strokeWidth}
          />
        ))}

        {/* The recommended next scan position — a reticle (ring + crosshair, no
            solid fill) rather than a solid dot, to read as "go here next" instead of
            "data already recorded here". */}
        {suggestedScan && (
          <g stroke="#4ade80" strokeWidth={strokeWidth}>
            <circle cx={suggestedScan.galx} cy={toRenderY(suggestedScan.galy)} r={markerRadius * 1.6} fill="none" />
            <line
              x1={suggestedScan.galx - markerRadius * 0.9}
              y1={toRenderY(suggestedScan.galy)}
              x2={suggestedScan.galx + markerRadius * 0.9}
              y2={toRenderY(suggestedScan.galy)}
            />
            <line
              x1={suggestedScan.galx}
              y1={toRenderY(suggestedScan.galy) - markerRadius * 0.9}
              x2={suggestedScan.galx}
              y2={toRenderY(suggestedScan.galy) + markerRadius * 0.9}
            />
          </g>
        )}
      </svg>

      <div className="flex items-center gap-4 text-[0.72rem] text-white/55">
        <span className="flex items-center gap-[0.3rem]"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#F6A300]" />Scan Location</span>
        {clusters.some((cluster) => !cluster.hasResolvedWorlds) && (
          <span className="flex items-center gap-[0.3rem]"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#b91c1c]" />Possible Location</span>
        )}
        {candidateWorlds.some((w) => w.isConfirmed) && (
          <span className="flex items-center gap-[0.3rem]"><span className="inline-block w-2.5 h-2.5 rounded-full bg-[#b91c1c]" />Confirmed Location</span>
        )}
        {candidateWorlds.some((w) => !w.isConfirmed) && (
          <span className="flex items-center gap-[0.3rem]"><span className="inline-block w-2.5 h-2.5 rounded-full bg-white/65" />Candidate World</span>
        )}
        {suggestedScan && (
          <span className="flex items-center gap-[0.3rem]"><span className="inline-block w-2.5 h-2.5 rounded-full border-2 border-[#4ade80]" />Suggested Next Scan</span>
        )}
      </div>
    </div>
  );
};

export default BountyTriangulationMap;
