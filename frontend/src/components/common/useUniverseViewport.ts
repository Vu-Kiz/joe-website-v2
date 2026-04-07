import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from "react";

type UseUniverseViewportOptions = {
  fitKey: string | null;
  worldWidth: number;
  worldHeight: number;
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  viewPadding: number;
  onViewportReset?: () => void;
};

type MouseLikeEvent = Pick<MouseEvent<HTMLDivElement>, "button" | "clientX" | "clientY">;

export default function useUniverseViewport({
  fitKey,
  worldWidth,
  worldHeight,
  minZoom,
  maxZoom,
  zoomStep,
  viewPadding,
  onViewportReset,
}: UseUniverseViewportOptions) {
  const [zoom, setZoom] = useState(minZoom);
  const [zoomFloor, setZoomFloor] = useState(minZoom);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [viewportNode, setViewportNode] = useState<HTMLDivElement | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const autoFitKeyRef = useRef<string | null>(null);
  const resetCallbackRef = useRef<UseUniverseViewportOptions["onViewportReset"]>(onViewportReset);

  useEffect(() => {
    resetCallbackRef.current = onViewportReset;
  }, [onViewportReset]);

  function fitViewport() {
    const viewport = viewportNode;
    if (!viewport) {
      return;
    }

    const viewportWidth = Math.max(1, viewport.clientWidth);
    const viewportHeight = Math.max(1, viewport.clientHeight);
    const scaleX = (viewportWidth - viewPadding * 2) / worldWidth;
    const scaleY = (viewportHeight - viewPadding * 2) / worldHeight;
    const nextZoom = Math.min(
      maxZoom,
      Math.max(minZoom, Number(Math.min(scaleX, scaleY).toFixed(2)))
    );

    setZoomFloor(nextZoom);
    setZoom(nextZoom);
    setOffset({
      x: (viewportWidth - worldWidth * nextZoom) / 2,
      y: (viewportHeight - worldHeight * nextZoom) / 2,
    });
    setIsReady(true);
  }

  function resetViewport() {
    fitViewport();
  }

  useEffect(() => {
    const viewport = viewportNode;
    if (!viewport || !fitKey) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const delta = event.deltaY < 0 ? zoomStep : -zoomStep;
      const nextZoom = Math.min(
        maxZoom,
        Math.max(zoomFloor, Number((zoom + delta).toFixed(2)))
      );

      if (nextZoom === zoom) {
        return;
      }

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
  }, [fitKey, maxZoom, offset.x, offset.y, viewportNode, zoom, zoomFloor, zoomStep]);

  useLayoutEffect(() => {
    if (resetCallbackRef.current) {
      resetCallbackRef.current();
    }
    setZoom(minZoom);
    setZoomFloor(minZoom);
    setOffset({ x: 0, y: 0 });
    setIsReady(false);
    autoFitKeyRef.current = null;
  }, [fitKey, minZoom]);

  useLayoutEffect(() => {
    const viewport = viewportNode;
    if (!viewport || !fitKey) {
      return;
    }

    const fitIfNeeded = () => {
      const viewportWidth = viewport.clientWidth;
      const viewportHeight = viewport.clientHeight;

      if (viewportWidth <= 0 || viewportHeight <= 0) {
        return;
      }

      if (autoFitKeyRef.current === fitKey) {
        return;
      }

      fitViewport();
      autoFitKeyRef.current = fitKey;
    };

    fitIfNeeded();
    const frameId = window.requestAnimationFrame(() => {
      fitIfNeeded();
    });

    const observer = new ResizeObserver(() => {
      fitIfNeeded();
    });
    observer.observe(viewport);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [fitKey, viewportNode, worldHeight, worldWidth]);

  function handleMouseDown(event: MouseLikeEvent) {
    if (event.button !== 0) {
      return;
    }

    setIsDragging(true);
    dragRef.current = { x: event.clientX, y: event.clientY };
  }

  function handleMouseMove(event: MouseLikeEvent) {
    if (!isDragging || !dragRef.current) {
      return;
    }

    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    dragRef.current = { x: event.clientX, y: event.clientY };
    setOffset((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
  }

  function stopDragging() {
    setIsDragging(false);
    dragRef.current = null;
  }

  return {
    viewportRef: setViewportNode,
    viewportEl: viewportNode,
    zoom,
    zoomFloor,
    offset,
    isDragging,
    isReady,
    fitViewport,
    resetViewport,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp: stopDragging,
    handleMouseLeave: stopDragging,
  };
}
