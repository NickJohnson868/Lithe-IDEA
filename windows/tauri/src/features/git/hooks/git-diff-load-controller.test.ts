import { expect, mock, test } from "bun:test";
import { createDiffLoadController, type DiffRefreshScheduler } from "./git-diff-load-controller";
import type { GitDiff } from "../types/git.types";

const diff: GitDiff = {
  file_path: "File.java",
  is_new: false,
  is_deleted: false,
  is_renamed: false,
  lines: [],
};
function fixture() {
  let current = true;
  let nextTimer = 0;
  const callbacks = new Map<number, () => void>();
  const scheduler: DiffRefreshScheduler = {
    schedule: (callback) => {
      const id = ++nextTimer;
      callbacks.set(id, callback);
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clear: (id) => {
      callbacks.delete(id as unknown as number);
    },
  };
  const host = {
    isCurrent: () => current,
    isStaged: false,
    read: mock(async (): Promise<GitDiff | null> => null),
    update: mock(() => {}),
    open: mock(() => {}),
    close: mock(() => {}),
    loading: mock(() => {}),
    error: mock(() => {}),
  };
  const controller = createDiffLoadController(host, scheduler);
  return {
    host,
    controller,
    callbacks,
    changeScope: () => {
      current = false;
    },
  };
}

test("a late diff refresh cannot close or update a newly selected buffer", async () => {
  const f = fixture();
  let release!: (diff: GitDiff | null) => void;
  const reply = new Promise<GitDiff | null>((resolve) => {
    release = resolve;
  });
  f.host.read.mockImplementationOnce(() => reply);
  const refresh = f.controller.refresh();
  try {
    f.changeScope();
    release(diff);
    await refresh;
    expect(f.host.close).not.toHaveBeenCalled();
    expect(f.host.update).not.toHaveBeenCalled();
    expect(f.host.read).toHaveBeenCalledTimes(1);
  } finally {
    release(null);
    await refresh;
    f.controller.dispose();
  }
});

test("Git change bursts coalesce into one timer and disposal clears it", () => {
  const f = fixture();
  try {
    f.controller.scheduleRefresh();
    f.controller.scheduleRefresh();
    expect(f.callbacks.size).toBe(1);
  } finally {
    f.controller.dispose();
  }
  expect(f.callbacks.size).toBe(0);
  f.controller.scheduleRefresh();
  expect(f.callbacks.size).toBe(0);
});

test("reconnecting effects invalidates old reads and accepts new refreshes", async () => {
  const f = fixture();
  let release!: (diff: GitDiff | null) => void;
  const reply = new Promise<GitDiff | null>((resolve) => {
    release = resolve;
  });
  f.host.read.mockImplementationOnce(() => reply);
  const oldRefresh = f.controller.refresh();
  try {
    f.controller.dispose();
    f.controller.activate();
    release(diff);
    await oldRefresh;
    expect(f.host.close).not.toHaveBeenCalled();
    await f.controller.refresh();
    expect(f.host.read).toHaveBeenCalledTimes(3);
    expect(f.host.close).toHaveBeenCalledTimes(1);
  } finally {
    release(null);
    await oldRefresh;
    f.controller.dispose();
  }
});

test("moving a diff between index and working tree opens the loaded view without a third read", async () => {
  const f = fixture();
  const changed: GitDiff = {
    ...diff,
    lines: [{ content: "changed", line_type: "added", new_line_number: 1 }],
  };
  f.host.read.mockResolvedValueOnce(null).mockResolvedValueOnce(changed);
  try {
    await f.controller.refresh();
    expect(f.host.read).toHaveBeenCalledTimes(2);
    expect(f.host.open).toHaveBeenCalledWith(true, changed);
    expect(f.host.close).toHaveBeenCalledTimes(1);
    expect(f.callbacks.size).toBe(0);
  } finally {
    f.controller.dispose();
  }
});
