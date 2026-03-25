import React, { useRef, useState } from "react";

type SectorBounds = {
  min_galx: number;
  max_galx: number;
  min_galy: number;
  max_galy: number;
  width: number;
  height: number;
};

type SectorPoint = {
  galx: number;
  galy: number;
};

type SectorSystem = {
  uid?: string | null;
  name?: string | null;
  identifier?: string | null;
  galx?: number | null;
  galy?: number | null;
};

type SectorGridMapProps = {
  bounds: SectorBounds | null | undefined;
  outlineCoordinates: SectorPoint[];
  systems: SectorSystem[];
  annotations?: Array<{
    sector_uid: string;
    galx: number;
    galy: number;
    marker_type: string | null;
    label: string | null;
    notes: string | null;
  }>;
  color?: {
    r?: number | null;
    g?: number | null;
    b?: number | null;
  } | null;
  onSystemSelect: (identifier: string) => void;
  onSaveAnnotation?: (payload: {
    galx: number;
    galy: number;
    marker_type?: string | null;
    label?: string | null;
    notes?: string | null;
  }) => Promise<void> | void;
  readOnly?: boolean;
  showDebugByDefault?: boolean;
};

function pointInPolygon(x: number, y: number, polygon: SectorPoint[]): boolean {
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

function bresenham(x0: number, y0: number, x1: number, y1: number): SectorPoint[] {
  const points: SectorPoint[] = [];
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

function cellOverlapsPolygon(galx: number, galy: number, polygon: SectorPoint[]): boolean {
  const samplePoints = [
    [galx + 0.5, galy + 0.5],
    [galx + 0.15, galy + 0.15],
    [galx + 0.85, galy + 0.15],
    [galx + 0.15, galy + 0.85],
    [galx + 0.85, galy + 0.85],
    [galx + 0.5, galy + 0.15],
    [galx + 0.5, galy + 0.85],
    [galx + 0.15, galy + 0.5],
    [galx + 0.85, galy + 0.5],
  ];

  const hits = samplePoints.filter(([x, y]) => pointInPolygon(x, y, polygon)).length;

  return hits >= 3;
}

function expandOutlinePoints(points: SectorPoint[]): SectorPoint[] {
  if (points.length === 0) return [];

  const expanded: SectorPoint[] = [];

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const linePoints = bresenham(current.galx, current.galy, next.galx, next.galy);

    for (const point of linePoints) {
      expanded.push(point);
    }
  }

  return expanded;
}

function pastelizeColor(
  r: number,
  g: number,
  b: number,
  alpha = 0.25
): string {
  const soften = (value: number) => Math.round(value * 0.82 + 255 * 0.18);
  const red = soften(r);
  const green = soften(g);
  const blue = soften(b);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const SectorGridMap: React.FC<SectorGridMapProps> = ({
  bounds,
  outlineCoordinates,
  systems,
  annotations = [],
  color,
  onSystemSelect,
  onSaveAnnotation,
  readOnly = false,
  showDebugByDefault = true,
}) => {
  const [showDebug, setShowDebug] = useState(showDebugByDefault);
  const [editMode, setEditMode] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ galx: number; galy: number } | null>(null);
  const [markerType, setMarkerType] = useState("");
  const [label, setLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [savingAnnotation, setSavingAnnotation] = useState(false);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const polygon = outlineCoordinates
    .filter((point) => point?.galx != null && point?.galy != null)
    .map((point) => ({ galx: Number(point.galx), galy: Number(point.galy) }));
  const expandedOutline = expandOutlinePoints(polygon);
  const areaSet = new Set<string>();
  const sectorGridZoomThreshold = 0.24;
  const sectorGridVisible = zoom > sectorGridZoomThreshold;
  const sectorGridLineWidth = sectorGridVisible
    ? Math.max(1, 1 / Math.max(zoom, 0.12))
    : 0;
  const sectorFillColor = pastelizeColor(
    Number(color?.r ?? 120),
    Number(color?.g ?? 215),
    Number(color?.b ?? 255),
    0.25
  );
  const sectorCellWidth = 78;
  const annotationMap = new Map(
    annotations.map((entry) => [`${entry.galx}:${entry.galy}`, entry])
  );
  const canEdit = !readOnly && !!onSaveAnnotation;
  const hasGrid =
    !!bounds &&
    Number.isFinite(bounds.width) &&
    Number.isFinite(bounds.height) &&
    bounds.width > 0 &&
    bounds.height > 0;

  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !hasGrid) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const delta = event.deltaY < 0 ? 0.12 : -0.12;
      const nextZoom = Math.min(3.5, Math.max(0.12, Number((zoom + delta).toFixed(2))));

      if (nextZoom === zoom) return;

      const worldX = (mouseX - offset.x) / zoom;
      const worldY = (mouseY - offset.y) / zoom;

      setZoom(nextZoom);
      setOffset({
        x: mouseX - worldX * nextZoom,
        y: mouseY - worldY * nextZoom,
      });
    };

    viewport.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      viewport.removeEventListener("wheel", handleWheel);
    };
  }, [hasGrid, offset, zoom]);

  if (bounds && polygon.length >= 3) {
    for (let galx = bounds.min_galx; galx <= bounds.max_galx; galx += 1) {
      for (let galy = bounds.min_galy; galy <= bounds.max_galy; galy += 1) {
        if (cellOverlapsPolygon(galx, galy, polygon)) {
          areaSet.add(`${galx}:${galy}`);
        }
      }
    }

    for (const point of expandedOutline) {
      areaSet.add(`${point.galx}:${point.galy}`);
    }
  }

  const edgeStyleForCell = (galx: number, galy: number): React.CSSProperties => {
    const key = `${galx}:${galy}`;
    if (!areaSet.has(key)) {
      return {
        border: sectorGridVisible
          ? `${sectorGridLineWidth}px solid rgba(255,255,255,0.1)`
          : "1px solid transparent",
        background: "transparent",
      };
    }

    const top = !areaSet.has(`${galx}:${galy + 1}`);
    const right = !areaSet.has(`${galx + 1}:${galy}`);
    const bottom = !areaSet.has(`${galx}:${galy - 1}`);
    const left = !areaSet.has(`${galx - 1}:${galy}`);
    const borderStyle = sectorGridVisible
      ? `${sectorGridLineWidth}px solid rgba(255,255,255,0.1)`
      : "1px solid transparent";

    return {
      background: sectorFillColor,
      borderTop: top ? borderStyle : borderStyle,
      borderRight: right ? borderStyle : borderStyle,
      borderBottom: bottom ? borderStyle : borderStyle,
      borderLeft: left ? borderStyle : borderStyle,
    };
  };

  const cells =
    hasGrid && bounds
      ? Array.from({ length: bounds.height }, (_, rowIndex) =>
          Array.from({ length: bounds.width }, (_, colIndex) => {
            const galx = bounds.min_galx + colIndex;
            const galy = bounds.max_galy - rowIndex;
            const system = systems.find((entry) => entry.galx === galx && entry.galy === galy);
            const annotation = annotationMap.get(`${galx}:${galy}`) ?? null;

            return { galx, galy, system, annotation };
          })
        )
      : [];

  const selectedAnnotation = selectedCell
    ? annotationMap.get(`${selectedCell.galx}:${selectedCell.galy}`) ?? null
    : null;

  React.useEffect(() => {
    if (!selectedCell) return;

    setMarkerType(selectedAnnotation?.marker_type ?? "");
    setLabel(selectedAnnotation?.label ?? "");
    setNotes(selectedAnnotation?.notes ?? "");
  }, [selectedAnnotation, selectedCell]);

  return (
    <>
      {hasGrid && bounds ? (
        <div className="sysuniverse-card">
          <div className="sysuniverse-toolbar">
            <strong>Coordinate Grid</strong>
            <div className="sysuniverse-toolbar__actions">
              <span className="small">Zoom: {zoom.toFixed(2)}x</span>
              {canEdit ? (
                <button className="btn" type="button" onClick={() => setEditMode((prev) => !prev)}>
                  {editMode ? "Done Editing" : "Edit Cells"}
                </button>
              ) : null}
              {!readOnly ? (
                <button className="btn" type="button" onClick={() => setShowDebug((prev) => !prev)}>
                  {showDebug ? "Hide Debug" : "Show Debug"}
                </button>
              ) : null}
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setZoom(0.45);
                  setOffset({ x: 0, y: 0 });
                }}
              >
                Reset View
              </button>
            </div>
          </div>
          <p className="small sysuniverse-copy-reset">
            Scroll to zoom, drag to move, and click an occupied coordinate to open that system.
          </p>
          <div
            ref={viewportRef}
            className={`sysuniverse-map-viewport sysuniverse-map-viewport--sector ${isDragging ? "is-dragging" : ""}`}
            style={{ overscrollBehavior: "contain", touchAction: "none" }}
            onMouseDown={(event) => {
              if (event.button !== 0) return;
              setIsDragging(true);
              dragRef.current = { x: event.clientX, y: event.clientY };
            }}
            onMouseMove={(event) => {
              if (!isDragging || !dragRef.current) return;
              const dx = event.clientX - dragRef.current.x;
              const dy = event.clientY - dragRef.current.y;
              dragRef.current = { x: event.clientX, y: event.clientY };
              setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
            }}
            onMouseUp={() => {
              setIsDragging(false);
              dragRef.current = null;
            }}
            onMouseLeave={() => {
              setIsDragging(false);
              dragRef.current = null;
            }}
          >
            <div className="sysuniverse-map-viewport__stars" />
            <div
              className="sysuniverse-map-canvas"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
            >
              {cells.map((row, rowIndex) => (
                <div
                  key={`row-${rowIndex}`}
                  className="sysuniverse-grid-row"
                  style={{ gridTemplateColumns: `repeat(${bounds.width}, ${sectorCellWidth}px)` }}
                >
                  {row.map((cell) =>
                    cell.system ? (
                      <button
                        key={`${cell.galx}-${cell.galy}`}
                        className="btn"
                        type="button"
                        onClick={() => {
                          if (editMode) {
                            setSelectedCell({ galx: cell.galx, galy: cell.galy });
                            return;
                          }

                          onSystemSelect(
                            cell.system?.identifier ?? cell.system?.uid ?? cell.system?.name ?? ""
                          );
                        }}
                        style={{
                          minHeight: 72,
                          display: "grid",
                          gap: 4,
                          alignContent: "center",
                          textAlign: "left",
                          pointerEvents: "auto",
                          borderRadius: 0,
                          ...edgeStyleForCell(cell.galx, cell.galy),
                        }}
                        title={`${cell.system.name ?? cell.system.uid ?? "Unknown"} (${cell.galx}, ${cell.galy})`}
                        >
                        {cell.annotation ? (
                          <span className="sysuniverse-sector-annotation-badge">
                            {cell.annotation.marker_type ?? "note"}
                          </span>
                        ) : null}
                        <strong className="sysuniverse-sector-system-name">
                          {cell.system.name ?? cell.system.uid ?? "Unknown"}
                        </strong>
                        <span className="small">
                          {cell.galx}, {cell.galy}
                        </span>
                      </button>
                    ) : (
                      <div
                        key={`${cell.galx}-${cell.galy}`}
                        className="sysuniverse-sector-cell"
                        onClick={() => {
                          if (!editMode) return;
                          setSelectedCell({ galx: cell.galx, galy: cell.galy });
                        }}
                        style={{
                          minHeight: 72,
                          borderRadius: 0,
                          cursor: editMode ? "pointer" : "default",
                          ...edgeStyleForCell(cell.galx, cell.galy),
                        }}
                        title={`${cell.galx}, ${cell.galy}`}
                      >
                        {cell.annotation ? (
                          <span className="sysuniverse-sector-annotation-badge sysuniverse-sector-annotation-badge--empty">
                            {cell.annotation.marker_type ?? "note"}
                          </span>
                        ) : null}
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {canEdit && editMode && selectedCell ? (
        <div className="sysuniverse-card">
          <div className="sysuniverse-toolbar">
            <strong>
              Cell {selectedCell.galx}, {selectedCell.galy}
            </strong>
            {selectedAnnotation ? (
              <span className="small sysuniverse-muted">Existing annotation loaded</span>
            ) : (
              <span className="small sysuniverse-muted">No annotation yet</span>
            )}
          </div>
          <div className="sysuniverse-stack">
            <select
              className="input"
              value={markerType}
              onChange={(event) => setMarkerType(event.target.value)}
            >
              <option value="">No marker</option>
              <option value="system">System</option>
              <option value="asteroid">Asteroid</option>
              <option value="hazard">Hazard</option>
              <option value="poi">Point of Interest</option>
              <option value="route">Route</option>
              <option value="note">Note</option>
            </select>
            <input
              className="input"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Short label"
            />
            <textarea
              className="input"
              rows={5}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes for this sector grid cell"
            />
            <div className="sysuniverse-chip-row">
              <button
                className="btn"
                type="button"
                disabled={!onSaveAnnotation || savingAnnotation}
                onClick={async () => {
                  if (!onSaveAnnotation) return;
                  setSavingAnnotation(true);
                  try {
                    await onSaveAnnotation({
                      galx: selectedCell.galx,
                      galy: selectedCell.galy,
                      marker_type: markerType || null,
                      label: label || null,
                      notes: notes || null,
                    });
                  } finally {
                    setSavingAnnotation(false);
                  }
                }}
              >
                {savingAnnotation ? "Saving..." : "Save Cell"}
              </button>
              <button
                className="btn"
                type="button"
                disabled={!onSaveAnnotation || savingAnnotation}
                onClick={async () => {
                  if (!onSaveAnnotation) return;
                  setSavingAnnotation(true);
                  try {
                    await onSaveAnnotation({
                      galx: selectedCell.galx,
                      galy: selectedCell.galy,
                      marker_type: null,
                      label: null,
                      notes: null,
                    });
                    setMarkerType("");
                    setLabel("");
                    setNotes("");
                  } finally {
                    setSavingAnnotation(false);
                  }
                }}
              >
                Clear Cell
              </button>
              {cells
                .flat()
                .find((cell) => cell.galx === selectedCell.galx && cell.galy === selectedCell.galy)
                ?.system ? (
                  <button
                    className="btn"
                    type="button"
                    onClick={() =>
                      onSystemSelect(
                        cells
                          .flat()
                          .find(
                            (cell) =>
                              cell.galx === selectedCell.galx &&
                              cell.galy === selectedCell.galy
                          )
                          ?.system?.identifier ??
                          cells
                            .flat()
                            .find(
                              (cell) =>
                                cell.galx === selectedCell.galx &&
                                cell.galy === selectedCell.galy
                            )
                            ?.system?.uid ??
                          ""
                      )
                    }
                  >
                    Open System
                  </button>
                ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!readOnly && showDebug ? (
        <div className="sysuniverse-card sysuniverse-card--debug">
          <strong>Sector Debug</strong>
          <p className="small sysuniverse-copy-reset">
            Highlighted cells are the filled sector footprint from the SWC outline.
          </p>
          <div className="sysuniverse-stat-grid">
            <div className="sysuniverse-card">
              <span className="small sysuniverse-muted">Outline Points</span>
              <strong>{polygon.length}</strong>
            </div>
            <div className="sysuniverse-card">
              <span className="small sysuniverse-muted">Expanded Outline Cells</span>
              <strong>{expandedOutline.length}</strong>
            </div>
            <div className="sysuniverse-card">
              <span className="small sysuniverse-muted">Highlighted Sector Cells</span>
              <strong>{areaSet.size}</strong>
            </div>
            <div className="sysuniverse-card">
              <span className="small sysuniverse-muted">Bounds</span>
              <strong>{bounds ? `${bounds.width} x ${bounds.height}` : "Unknown"}</strong>
            </div>
            <div className="sysuniverse-card">
              <span className="small sysuniverse-muted">First Point</span>
              <strong>{polygon[0] ? `${polygon[0].galx}, ${polygon[0].galy}` : "None"}</strong>
            </div>
            <div className="sysuniverse-card">
              <span className="small sysuniverse-muted">Last Point</span>
              <strong>
                {polygon[polygon.length - 1]
                  ? `${polygon[polygon.length - 1].galx}, ${polygon[polygon.length - 1].galy}`
                  : "None"}
              </strong>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default SectorGridMap;
