import {
  useEffect,
  useRef,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";

type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export interface DialogBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}
const MARGIN = 8;
const MIN_WIDTH = 600;
const MIN_HEIGHT = 400;

/** Keep the opposite edge stationary, including when a minimum size is reached. */
export function resizeDialogBounds(
  start: DialogBounds,
  edge: Edge,
  dx: number,
  dy: number,
  viewport: { width: number; height: number },
): DialogBounds {
  let { left, top } = start;
  let right = left + start.width;
  let bottom = top + start.height;
  const minWidth = Math.min(MIN_WIDTH, viewport.width - MARGIN * 2);
  const minHeight = Math.min(MIN_HEIGHT, viewport.height - MARGIN * 2);
  if (edge.includes("w")) left = Math.max(MARGIN, Math.min(right - minWidth, left + dx));
  if (edge.includes("e"))
    right = Math.min(viewport.width - MARGIN, Math.max(left + minWidth, right + dx));
  if (edge.includes("n")) top = Math.max(MARGIN, Math.min(bottom - minHeight, top + dy));
  if (edge.includes("s"))
    bottom = Math.min(viewport.height - MARGIN, Math.max(top + minHeight, bottom + dy));
  return { left, top, width: right - left, height: bottom - top };
}

/** Translate without changing size and keep the entire dialog visible. */
export function moveDialogBounds(
  start: DialogBounds,
  dx: number,
  dy: number,
  viewport: { width: number; height: number },
): DialogBounds {
  return {
    width: start.width,
    height: start.height,
    left: Math.max(MARGIN, Math.min(start.left + dx, viewport.width - start.width - MARGIN)),
    top: Math.max(MARGIN, Math.min(start.top + dy, viewport.height - start.height - MARGIN)),
  };
}

const handles: Array<{ edge: Edge; className: string; cursor: string }> = [
  { edge: "n", className: "top-0 inset-x-3 h-1.5", cursor: "ns-resize" },
  { edge: "s", className: "bottom-0 inset-x-3 h-1.5", cursor: "ns-resize" },
  { edge: "e", className: "right-0 inset-y-3 w-1.5", cursor: "ew-resize" },
  { edge: "w", className: "left-0 inset-y-3 w-1.5", cursor: "ew-resize" },
  { edge: "ne", className: "top-0 right-0 size-3", cursor: "nesw-resize" },
  { edge: "nw", className: "top-0 left-0 size-3", cursor: "nwse-resize" },
  { edge: "se", className: "bottom-0 right-0 size-3", cursor: "nwse-resize" },
  { edge: "sw", className: "bottom-0 left-0 size-3", cursor: "nesw-resize" },
];

/** DOM-local geometry keeps pointer movement out of the search/editor render tree. */
export function DialogResizeHandles({
  target,
  label,
  initialSize,
  onInteractionEnd,
  children,
}: {
  target: RefObject<HTMLDivElement | null>;
  label: string;
  initialSize?: { width: number; height: number; left?: number; top?: number } | null;
  onInteractionEnd?: (bounds: DialogBounds) => void;
  children?: ReactNode;
}) {
  const cleanup = useRef<(() => void) | null>(null);
  const initial = useRef(initialSize);
  const commit = useRef(onInteractionEnd);
  commit.current = onInteractionEnd;
  useEffect(() => {
    if (target.current && initial.current) {
      const width = Math.min(
        Math.max(MIN_WIDTH, initial.current.width),
        window.innerWidth - MARGIN * 2,
      );
      const height = Math.min(
        Math.max(MIN_HEIGHT, initial.current.height),
        window.innerHeight - MARGIN * 2,
      );
      apply(target.current, {
        width,
        height,
        left: Math.max(
          MARGIN,
          Math.min(
            initial.current.left ?? (window.innerWidth - width) / 2,
            window.innerWidth - width - MARGIN,
          ),
        ),
        top: Math.max(
          MARGIN,
          Math.min(
            initial.current.top ?? (window.innerHeight - height) / 2,
            window.innerHeight - height - MARGIN,
          ),
        ),
      });
    }
    const fit = () => {
      cleanup.current?.();
      const element = target.current;
      if (!element || !element.style.width) return;
      const rect = element.getBoundingClientRect();
      const width = Math.min(rect.width, window.innerWidth - MARGIN * 2);
      const height = Math.min(rect.height, window.innerHeight - MARGIN * 2);
      apply(element, {
        width,
        height,
        left: Math.max(MARGIN, Math.min(rect.left, window.innerWidth - width - MARGIN)),
        top: Math.max(MARGIN, Math.min(rect.top, window.innerHeight - height - MARGIN)),
      });
    };
    window.addEventListener("resize", fit);
    return () => {
      cleanup.current?.();
      window.removeEventListener("resize", fit);
    };
  }, [target]);
  const startInteraction = (event: ReactPointerEvent<HTMLDivElement>, edge: Edge | "move") => {
    if (event.button !== 0 || !event.isPrimary) return;
    if ((event.target as HTMLElement).closest("button, input, textarea, select, a, [role=button]"))
      return;
    const cursor =
      edge === "move" ? "move" : handles.find((handle) => handle.edge === edge)!.cursor;
    const element = target.current;
    if (!element) return;
    event.preventDefault();
    event.stopPropagation();
    cleanup.current?.();
    const start = element.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const pointerId = event.pointerId;
    const handle = event.currentTarget;
    handle.setPointerCapture?.(pointerId);
    let bounds: DialogBounds = start;
    let frame: number | null = null;
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    // An overlay preserves the resize cursor even over Monaco and other cursor-owning controls.
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      cursor,
    });
    element.appendChild(overlay);
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";
    const move = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      bounds =
        edge === "move"
          ? moveDialogBounds(start, next.clientX - startX, next.clientY - startY, viewport)
          : resizeDialogBounds(start, edge, next.clientX - startX, next.clientY - startY, viewport);
      if (frame === null)
        frame = requestAnimationFrame(() => {
          frame = null;
          apply(element, bounds);
        });
    };
    const finish = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      apply(element, bounds);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
      document.removeEventListener("pointercancel", end);
      window.removeEventListener("blur", finish);
      overlay.remove();
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
      if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
      cleanup.current = null;
      commit.current?.({
        left: bounds.left,
        top: bounds.top,
        width: bounds.width,
        height: bounds.height,
      });
    };
    const end = (next: PointerEvent) => {
      if (next.pointerId === pointerId) finish();
    };
    cleanup.current = finish;
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
    document.addEventListener("pointercancel", end);
    window.addEventListener("blur", finish);
  };
  return (
    <>
      {children && (
        <div
          data-dialog-move
          className="shrink-0 cursor-move touch-none select-none"
          onPointerDown={(event) => startInteraction(event, "move")}
        >
          {children}
        </div>
      )}
      {handles.map(({ edge, className, cursor }) => (
        <div
          key={edge}
          title={label}
          aria-hidden="true"
          data-dialog-resize={edge}
          className={`absolute z-30 touch-none ${className}`}
          style={{ cursor }}
          onPointerDown={(event) => startInteraction(event, edge)}
        />
      ))}
    </>
  );
}

function apply(element: HTMLElement, bounds: DialogBounds) {
  Object.assign(element.style, {
    left: `${bounds.left}px`,
    top: `${bounds.top}px`,
    width: `${bounds.width}px`,
    height: `${bounds.height}px`,
    translate: "none",
  });
}
