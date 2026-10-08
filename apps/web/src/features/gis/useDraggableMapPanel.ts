import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

type Position = { left: number; top: number };
type DragState = Position & { pointerId: number; startX: number; startY: number; parent: HTMLElement };

const MAP_OBSTACLES = '.map-canvas-controls, .map-scale-stack, .map-attribution, .map-canvas-hint, .map-measure-history, .webgis-identify-card';

function clampPosition(panel: HTMLElement, parent: HTMLElement, left: number, top: number): Position {
  return {
    left: Math.max(8, Math.min(parent.clientWidth - panel.offsetWidth - 8, left)),
    top: Math.max(8, Math.min(parent.clientHeight - panel.offsetHeight - 8, top)),
  };
}

function collides(panel: HTMLElement, parent: HTMLElement, position: Position) {
  const obstacleRoot = parent.closest<HTMLElement>('.webgis-map-area') ?? parent;
  const panelBox = {
    left: parent.getBoundingClientRect().left + position.left,
    top: parent.getBoundingClientRect().top + position.top,
    right: parent.getBoundingClientRect().left + position.left + panel.offsetWidth,
    bottom: parent.getBoundingClientRect().top + position.top + panel.offsetHeight,
  };
  return [...obstacleRoot.querySelectorAll<HTMLElement>(MAP_OBSTACLES)]
    .filter((obstacle) => obstacle !== panel && !panel.contains(obstacle))
    .some((obstacle) => {
      const box = obstacle.getBoundingClientRect();
      return box.width > 0 && box.height > 0 && panelBox.left < box.right + 8 && panelBox.right + 8 > box.left && panelBox.top < box.bottom + 8 && panelBox.bottom + 8 > box.top;
    });
}

function nearestFreePosition(panel: HTMLElement, parent: HTMLElement, desired: Position): Position {
  const width = panel.offsetWidth;
  const height = panel.offsetHeight;
  const right = parent.clientWidth - width - 12;
  const bottom = parent.clientHeight - height - 12;
  const candidates = [
    desired,
    { left: 12, top: 58 },
    { left: right, top: 58 },
    { left: 12, top: bottom },
    { left: right, top: bottom },
    { left: Math.max(12, (parent.clientWidth - width) / 2), top: 58 },
    { left: Math.max(12, (parent.clientWidth - width) / 2), top: bottom },
  ].map((candidate) => clampPosition(panel, parent, candidate.left, candidate.top));
  const free = candidates.find((candidate) => !collides(panel, parent, candidate));
  return free ?? clampPosition(panel, parent, desired.left, desired.top);
}

export function useDraggableMapPanel<T extends HTMLElement>() {
  const panelRef = useRef<T>(null);
  const dragRef = useRef<DragState | null>(null);
  const [position, setPosition] = useState<Position | null>(null);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const panel = panelRef.current;
    const parent = panel?.parentElement;
    if (!panel || !parent || event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    const panelRect = panel.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      left: position?.left ?? panelRect.left - parentRect.left,
      top: position?.top ?? panelRect.top - parentRect.top,
      parent,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, [position]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !panel) return;
    setPosition(clampPosition(panel, drag.parent, drag.left + event.clientX - drag.startX, drag.top + event.clientY - drag.startY));
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || drag.pointerId !== event.pointerId || !panel) return;
    dragRef.current = null;
    setPosition((current) => current ? nearestFreePosition(panel, drag.parent, current) : null);
  }, []);

  const onPointerCancel = useCallback(() => { dragRef.current = null; }, []);
  const style = position ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto' as const } : undefined;
  const dragHandleProps = { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture: onPointerCancel };
  return { panelRef, style, dragHandleProps };
}
