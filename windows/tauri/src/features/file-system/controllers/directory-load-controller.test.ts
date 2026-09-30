import { describe, expect, test } from "bun:test";
import type { FileEntry } from "../types/app.types";
import { createDirectoryLoadController } from "./directory-load-controller";
import { findFileInTree, updateFileInTree } from "./file-tree-utils";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const directory = (path: string, children?: FileEntry[]): FileEntry => ({
  name: path.split("/").pop()!, path, isDir: true, children,
});

function fixture(read: (path: string) => Promise<FileEntry[]>, idle = async () => {}) {
  let files = [directory("/root")];
  let active = true;
  const expanded = new Set<string>();
  const errors: unknown[] = [];
  const controller = createDirectoryLoadController({
    find: (path) => findFileInTree(files, path), read,
    apply: (path, children) => { files = updateFileInTree(files, path, (node) => ({ ...node, children })); },
    isExpanded: (path) => expanded.has(path),
    expand: (path) => { expanded.add(path); },
    isActive: () => active, idle,
    reportError: (_, error) => { errors.push(error); },
  });
  return { controller, expanded, errors, files: () => files, deactivate: () => { active = false; } };
}

describe("directory request lifecycle", () => {
  test("expands immediately and does not reopen after collapse during a read", async () => {
    const gate = deferred<FileEntry[]>();
    const f = fixture(() => gate.promise);
    const task = f.controller.expand("/root", false);
    try {
      expect(f.expanded.has("/root")).toBe(true);
      f.expanded.clear();
      f.controller.collapse("/root");
    } finally { gate.resolve([directory("/root/child")]); await task; }
    expect(f.files()[0].children).toBeUndefined();
    expect(f.expanded.size).toBe(0);
  });

  test("collapse then reopen shares the read but only the new expansion applies", async () => {
    const gate = deferred<FileEntry[]>();
    let reads = 0;
    const f = fixture(() => { reads++; return gate.promise; });
    const first = f.controller.expand("/root", false);
    f.expanded.clear();
    f.controller.collapse("/root");
    const second = f.controller.expand("/root", false);
    try { expect(reads).toBe(1); }
    finally { gate.resolve([]); await Promise.all([first, second]); }
    expect(f.files()[0].children).toEqual([]);
    await f.controller.expand("/root", false);
    expect(reads).toBe(1);
  });

  test("workspace invalidation drops old children even after the same path reopens", async () => {
    const gate = deferred<FileEntry[]>();
    const f = fixture(() => gate.promise);
    const task = f.controller.expand("/root", false);
    f.controller.invalidate();
    try { f.expanded.add("/root"); }
    finally { gate.resolve([directory("/root/stale")]); await task; }
    expect(f.files()[0].children).toBeUndefined();
  });

  test("a stale read failure cannot fail a newer workspace operation", async () => {
    const gate = deferred<FileEntry[]>();
    const f = fixture(() => gate.promise);
    const task = f.controller.expand("/root", false);
    f.deactivate();
    gate.reject(new Error("old read failed"));
    expect(await task).toBe("/root");
  });

  test("compact chains expand progressively and stop at an empty loaded leaf", async () => {
    const reads: string[] = [];
    const f = fixture(async (path) => {
      reads.push(path);
      return path === "/root" ? [directory("/root/child", [])] : [];
    });
    expect(await f.controller.expand("/root", true)).toBe("/root/child");
    expect([...f.expanded]).toEqual(["/root", "/root/child"]);
    expect(reads).toEqual(["/root"]);
  });

  test("prefetch reads at most two directories and stops after cancellation", async () => {
    const gates = [deferred<FileEntry[]>(), deferred<FileEntry[]>()];
    const started = deferred<void>();
    let reads = 0;
    const f = fixture((path) => {
      if (path === "/root") return Promise.resolve([0, 1, 2, 3].map((i) => directory(`/root/${i}`)));
      const gate = gates[reads++];
      if (reads === 2) started.resolve();
      return gate.promise;
    });
    await f.controller.expand("/root", false);
    const task = f.controller.preload("/root", 2, 80);
    try {
      await started.promise;
      expect(reads).toBe(2);
      f.controller.cancelPrefetch();
    } finally {
      for (const gate of gates) gate.resolve([]);
      await task;
    }
    expect(reads).toBe(2);
    expect(f.files()[0].children?.every((node) => node.children === undefined)).toBe(true);
  });
});
