import { expect, test } from "bun:test";
import { act, createRef } from "react";
import { createRoot } from "react-dom/client";
import { installHappyDom } from "@/test-utils/happy-dom";
import { DialogResizeHandles, resizeDialogBounds, moveDialogBounds } from "./dialog-resize";

test("dialog resize anchors opposite edges and stays inside the viewport", () => {
  const start = { left: 100, top: 100, width: 800, height: 500 };
  const viewport = { width: 1200, height: 900 };
  expect(resizeDialogBounds(start, "nw", 500, 500, viewport)).toEqual({
    left: 300,
    top: 200,
    width: 600,
    height: 400,
  });
  expect(resizeDialogBounds(start, "se", 1000, 1000, viewport)).toEqual({
    left: 100,
    top: 100,
    width: 1092,
    height: 792,
  });
  expect(resizeDialogBounds(start, "nw", -1000, -1000, viewport)).toEqual({
    left: 8,
    top: 8,
    width: 892,
    height: 592,
  });
});

test("dialog drag batches movement and restores cursor on cancellation and unmount", async () => {
  const restore = installHappyDom();
  const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previousAct = globals.IS_REACT_ACT_ENVIRONMENT;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  const requestFrame = globalThis.requestAnimationFrame;
  const cancelFrame = globalThis.cancelAnimationFrame;
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  globalThis.requestAnimationFrame = (callback) => {
    frames.set(++nextFrame, callback);
    return nextFrame;
  };
  globalThis.cancelAnimationFrame = (id) => {
    frames.delete(id);
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const target = createRef<HTMLDivElement>();
  const pointer = (type: string, x: number, y: number) => {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: y });
    return event;
  };
  let mounted = true;
  const savedSizes: Array<{ width: number; height: number; left: number; top: number }> = [];
  try {
    await act(async () =>
      root.render(
        <div ref={target}>
          <DialogResizeHandles
            target={target}
            label="Resize"
            initialSize={{ width: 700, height: 500, left: 20, top: 30 }}
            onInteractionEnd={(size) => savedSizes.push(size)}
          >
            <header>Move search window</header>
          </DialogResizeHandles>
        </div>,
      ),
    );
    expect(target.current!.style.width).toBe("700px");
    expect(target.current!.style.left).toBe("20px");
    expect(target.current!.style.top).toBe("30px");
    target.current!.getBoundingClientRect = () => ({
      left: 50,
      top: 50,
      width: 650,
      height: 450,
      right: 700,
      bottom: 500,
      x: 50,
      y: 50,
      toJSON: () => ({}),
    });
    document.body.style.cursor = "crosshair";
    const handle = container.querySelector<HTMLElement>('[data-dialog-resize="se"]')!;
    expect(handle.style.cursor).toBe("nwse-resize");
    handle.dispatchEvent(pointer("pointerdown", 700, 500));
    document.dispatchEvent(pointer("pointermove", 710, 510));
    document.dispatchEvent(pointer("pointermove", 730, 530));
    expect(frames.size).toBe(1);
    expect(savedSizes).toHaveLength(0);
    document.dispatchEvent(pointer("pointercancel", 730, 530));
    expect(target.current!.style.width).toBe("680px");
    expect(document.body.style.cursor).toBe("crosshair");
    expect(frames.size).toBe(0);
    expect(savedSizes).toEqual([{ left: 50, top: 50, width: 680, height: 480 }]);
    const title = container.querySelector<HTMLElement>("[data-dialog-move]")!;
    title.dispatchEvent(pointer("pointerdown", 100, 100));
    document.dispatchEvent(pointer("pointermove", 140, 140));
    document.dispatchEvent(pointer("pointerup", 140, 140));
    expect(target.current!.style.left).toBe("90px");
    expect(target.current!.style.top).toBe("90px");
    expect(target.current!.style.width).toBe("650px");
    title.dispatchEvent(pointer("pointerdown", 100, 100));
    document.dispatchEvent(pointer("pointermove", 140, 140));
    await act(async () => root.unmount());
    mounted = false;
    expect(frames.size).toBe(0);
    expect(document.body.style.cursor).toBe("crosshair");
    expect(document.body.children.length).toBe(1);
  } finally {
    if (mounted) await act(async () => root.unmount());
    container.remove();
    globalThis.requestAnimationFrame = requestFrame;
    globalThis.cancelAnimationFrame = cancelFrame;
    globals.IS_REACT_ACT_ENVIRONMENT = previousAct;
    restore();
  }
});

test("moving a dialog clamps every boundary while preserving its dimensions", () => {
  // Native DOMRect exposes geometry through prototype accessors, not enumerable fields.
  const start = Object.create({ left: 100, top: 100, width: 600, height: 400 });
  expect(moveDialogBounds(start, -1000, -1000, { width: 1000, height: 800 })).toEqual({
    width: 600, height: 400,
    left: 8,
    top: 8,
  });
  expect(moveDialogBounds(start, 1000, 1000, { width: 1000, height: 800 })).toEqual({
    width: 600, height: 400,
    left: 392,
    top: 392,
  });
});
