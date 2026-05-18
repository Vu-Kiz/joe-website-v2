import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { OrthographicView } from "@deck.gl/core";
import { SolidPolygonLayer, TextLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { PickingInfo } from "@deck.gl/core";
import { clamp01, formatNumber, bearingFromPoint } from "./weaponHeatmapMath";
import type { HeatCell, GridPoint } from "./weaponHeatmapMath";

type HeatmapSelectionMode = "none" | "origin" | "target";

type Props = {
  cells: HeatCell[];
  gridColumns: number;
  gridRows: number;
  activeOrigin: GridPoint;
  activeTarget: GridPoint;
  selectionMode: HeatmapSelectionMode;
  usesDirectionalArcs: boolean;
  onCellClick: (cell: HeatCell) => void;
};

type ViewState = {
  target: [number, number, number];
  zoom: number;
  minZoom: number;
  maxZoom: number;
};

const isTouchDevice = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
const CELL_PAD = 0.04;

function heatColorRGBA(hitChance: number): [number, number, number, number] {
  const n = clamp01(hitChance);
  return [
    Math.round(110 + n * 145),
    Math.round(50 + n * 120),
    Math.round(24 + n * 40),
    Math.round((0.14 + n * 0.78) * 255),
  ];
}

const WeaponHeatmapDeckGrid: React.FC<Props> = ({
  cells,
  gridColumns,
  gridRows,
  activeOrigin,
  activeTarget,
  selectionMode,
  usesDirectionalArcs,
  onCellClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState<ViewState>(() => ({
    target: [gridColumns / 2, gridRows / 2, 0],
    zoom: 4,
    minZoom: 1,
    maxZoom: 8,
  }));
  const [tappedCell, setTappedCell] = useState<{ cell: HeatCell; x: number; y: number } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ cell: HeatCell; x: number; y: number } | null>(null);

  // Fit grid into container on mount and when grid size changes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    if (!width || !height) return;
    const zoomX = Math.log2(width / gridColumns);
    const zoomY = Math.log2(height / gridRows);
    const zoom = Math.min(zoomX, zoomY) - 0.3;
    setViewState({
      target: [gridColumns / 2, gridRows / 2, 0],
      zoom,
      minZoom: zoom - 2,
      maxZoom: 8,
    });
    setTappedCell(null);
    setHoveredCell(null);
  }, [gridColumns, gridRows]);

  const cellPolygons = useMemo(() =>
    cells.map((cell) => ({
      cell,
      polygon: [
        [cell.x + CELL_PAD, cell.y + CELL_PAD],
        [cell.x + 1 - CELL_PAD, cell.y + CELL_PAD],
        [cell.x + 1 - CELL_PAD, cell.y + 1 - CELL_PAD],
        [cell.x + CELL_PAD, cell.y + 1 - CELL_PAD],
      ] as [number, number][],
      color: heatColorRGBA(cell.hitChance),
    })),
    [cells]
  );

  const markerDots = useMemo(() => [
    { position: [activeOrigin.x + 0.22, activeOrigin.y + 0.22, 0] as [number, number, number], color: [246, 163, 0, 230] as [number, number, number, number] },
    { position: [activeTarget.x + 0.78, activeTarget.y + 0.22, 0] as [number, number, number], color: [220, 50, 50, 210] as [number, number, number, number] },
  ], [activeOrigin, activeTarget]);

  const handleClick = useCallback((info: PickingInfo) => {
    if (!info.object?.cell) return;
    const cell = info.object.cell as HeatCell;
    if (selectionMode !== "none") {
      onCellClick(cell);
      return;
    }
    if (isTouchDevice) {
      const x = info.x ?? 0;
      const y = info.y ?? 0;
      setTappedCell((current) =>
        current?.cell.x === cell.x && current?.cell.y === cell.y ? null : { cell, x, y }
      );
    }
  }, [selectionMode, onCellClick]);

  const handleHover = useCallback((info: PickingInfo) => {
    if (isTouchDevice) return;
    if (!info.object?.cell) {
      setHoveredCell(null);
      return;
    }
    setHoveredCell({ cell: info.object.cell as HeatCell, x: info.x ?? 0, y: info.y ?? 0 });
  }, []);

  const popup = isTouchDevice ? tappedCell : hoveredCell;

  const layers = [
    new SolidPolygonLayer({
      id: "heat-cells",
      data: cellPolygons,
      getPolygon: (d) => d.polygon,
      getFillColor: (d) => d.color,
      pickable: true,
      filled: true,
    }),
    new TextLayer({
      id: "heat-labels",
      data: cells,
      getPosition: (d) => [d.x + 0.5, d.y + 0.5, 0],
      getText: (d) => formatNumber(d.hitChance * 100, 0),
      getSize: 11,
      getColor: [255, 255, 255, 180],
      getTextAnchor: "middle",
      getAlignmentBaseline: "center",
      fontFamily: "monospace",
      pickable: false,
    }),
    new ScatterplotLayer({
      id: "markers",
      data: markerDots,
      getPosition: (d) => d.position,
      getFillColor: (d) => d.color,
      getRadius: 0.18,
      filled: true,
      stroked: true,
      getLineColor: [0, 0, 0, 120],
      lineWidthUnits: "common",
      getLineWidth: 0.02,
      pickable: false,
    }),
  ];

  const cursorStyle = selectionMode !== "none" ? "crosshair" : "pointer";

  return (
    <div
      ref={containerRef}
      className="weapon-heatmap-deck"
      style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", maxHeight: "70vh" }}
    >
      <DeckGL
        views={new OrthographicView({ id: "ortho", controller: { dragPan: true, scrollZoom: true, touchZoom: true, doubleClickZoom: false } })}
        viewState={viewState}
        onViewStateChange={({ viewState: next }) => setViewState(next as ViewState)}
        layers={layers}
        onClick={handleClick}
        onHover={handleHover}
        style={{ cursor: cursorStyle }}
      />

      {popup && (
        <div
          className="weapon-heatmap-page__hover"
          style={{
            left: Math.min(popup.x + 8, (containerRef.current?.clientWidth ?? 300) - 190),
            top: popup.y > 140 ? popup.y - 140 : popup.y + 16,
            transform: "none",
          }}
        >
          <strong>{popup.cell.x}, {popup.cell.y}</strong>
          <div className="weapon-heatmap-page__hover-group">
            <span className="small weapon-heatmap-page__hover-label">Distance</span>
            <span className="small">{formatNumber(popup.cell.distance, 2)}</span>
          </div>
          {usesDirectionalArcs && (
            <div className="weapon-heatmap-page__hover-group">
              <span className="small weapon-heatmap-page__hover-label">Bearing</span>
              <span className="small">{formatNumber(bearingFromPoint(activeOrigin.x, activeOrigin.y, popup.cell.x, popup.cell.y), 0)}°</span>
            </div>
          )}
          <div className="weapon-heatmap-page__hover-group">
            <span className="small weapon-heatmap-page__hover-label">Hit Chance</span>
            <span className="small">{formatNumber(popup.cell.hitChance * 100, 0)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeaponHeatmapDeckGrid;
