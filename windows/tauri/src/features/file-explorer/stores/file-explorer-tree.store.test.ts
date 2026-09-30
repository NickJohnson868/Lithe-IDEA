import { expect, test } from "bun:test";
import { enableMapSet } from "immer";
import { useFileTreeStore } from "./file-explorer-tree.store";

enableMapSet();

test("a root can collapse after initialization and expand again without mutating old state", () => {
  const store = useFileTreeStore.getStore("tree-toggle-regression");
  const root = "C:/fixture/project";
  const actions = store.getState().actions;
  actions.expandRootOnce(root);
  const expanded = store.getState();
  actions.toggleFolder(root);
  actions.expandRootOnce(root);
  expect(store.getState().expandedFolders.has(root)).toBe(false);
  expect(store.getState().expandedPaths.has(root)).toBe(false);
  expect(expanded.expandedFolders.has(root)).toBe(true);
  actions.toggleFolder(root);
  expect(store.getState().expandedFolders.has(root)).toBe(true);
  expect(store.getState().expandedPaths.has(root)).toBe(true);
});

test("collapse path clears descendants while preserving similarly named siblings", () => {
  const store = useFileTreeStore.getStore("tree-collapse-regression");
  const actions = store.getState().actions;
  actions.setExpandedPaths(new Set(["C:/fixture/src", "C:/fixture/src/java", "C:/fixture/src-other"]));
  actions.collapsePath("C:\\fixture\\src");
  expect([...store.getState().expandedFolders]).toEqual(["C:/fixture/src-other"]);
  expect([...store.getState().expandedPaths]).toEqual(["C:/fixture/src-other"]);
  actions.collapseAll();
  expect(store.getState().expandedFolders.size).toBe(0);
  expect(store.getState().expandedPaths.size).toBe(0);
});
