import { describe, expect, test } from "bun:test";
import type { FileEntry } from "../types/app.types";
import { findFileInTree, loadFolderExpansion, updateFileInTree } from "./file-tree-utils";

const directory = (name: string, path: string, children?: FileEntry[]): FileEntry => ({
  name,
  path,
  isDir: true,
  children,
});

describe("compact folder expansion", () => {
  test("keeps an empty loaded directory without reading it again", async () => {
    let reads = 0;
    await loadFolderExpansion([directory("a", "/a", [])], "/a", true, async () => {
      reads++;
      return [];
    });
    expect(reads).toBe(0);
  });

  test("updates only the ancestor chain and preserves similarly named siblings", () => {
    const sibling = directory("ab", "/ab", [directory("x", "/ab/x")]);
    const tree = [directory("a", "/a", [directory("b", "/a/b")]), sibling];
    const updated = updateFileInTree(tree, "/a/b", (node) => ({ ...node, children: [] }));
    expect(updated[1]).toBe(sibling);
    expect(findFileInTree(tree, "/a/b")?.children).toBeUndefined();
    expect(findFileInTree(updated, "/a/b")?.children).toEqual([]);
    expect(findFileInTree(updated, "/a/missing")).toBeNull();
    expect(updateFileInTree(updated, "/absent", (node) => node)).toBe(updated);
  });

  test("indexes Windows drive roots and remote ancestors", () => {
    for (const root of ["C:\\", "remote://connection/home", "wsl://Ubuntu/home"]) {
      const separator = root.endsWith("\\") ? "" : "/";
      const path = `${root}${separator}child`;
      const child = directory("child", path);
      expect(findFileInTree([directory("root", root, [child])], path)).toBe(child);
    }
  });
  test("loads and expands a single-child directory chain in one action", async () => {
    const entries = new Map<string, FileEntry[]>([
      ["/a", [directory("b", "/a/b")]],
      ["/a/b", [directory("c", "/a/b/c")]],
      ["/a/b/c", [{ name: "file.ts", path: "/a/b/c/file.ts", isDir: false }]],
    ]);

    const result = await loadFolderExpansion(
      [directory("a", "/a")],
      "/a",
      true,
      async (path) => entries.get(path) ?? [],
    );

    expect(result.expandedPaths).toEqual(["/a", "/a/b", "/a/b/c"]);
    expect(result.finalPath).toBe("/a/b/c");
  });

  test("stops at a branch and keeps non-compact expansion to one level", async () => {
    const entries = new Map<string, FileEntry[]>([
      ["/a", [directory("b", "/a/b")]],
      ["/a/b", [directory("c", "/a/b/c"), directory("d", "/a/b/d")]],
    ]);
    const readChildren = async (path: string) => entries.get(path) ?? [];

    const compact = await loadFolderExpansion([directory("a", "/a")], "/a", true, readChildren);
    const regular = await loadFolderExpansion([directory("a", "/a")], "/a", false, readChildren);

    expect(compact.expandedPaths).toEqual(["/a", "/a/b"]);
    expect(regular.expandedPaths).toEqual(["/a"]);
  });
});
