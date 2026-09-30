import { expect, test } from "bun:test";
import type { GitFile } from "@/features/git/types/git.types";
import { createFileTreeGitStatusLookup, getFileTreeEntryGitStatusDecoration } from "./file-tree-git-status";

const root = "C:/example";
function lookup(files: GitFile[]) {
  return createFileTreeGitStatusLookup({ branch: "main", ahead: 0, behind: 0, files });
}

test("an untracked backup does not mark versioned ancestors red", () => {
  const status = lookup([{ path: "module/src/Example.java~", status: "untracked", staged: false }]);
  expect(status.files.get("module/src/Example.java~")?.colorClassName).toBe("text-git-untracked");
  expect(status.directories.size).toBe(0);
  expect(getFileTreeEntryGitStatusDecoration(
    { name: "module", path: `${root}/module`, isDir: true }, root, status,
  )).toBeNull();
});

test("tracked changes make ancestors blue independently of file status and staging", () => {
  for (const state of ["modified", "added", "deleted", "renamed"] as const) {
    for (const staged of [false, true]) {
      const status = lookup([{ path: "module/src/Example.java", status: state, staged }]);
      expect(status.directories.get("module")?.colorClassName).toBe("text-git-modified");
      expect(status.directories.get("module/src")?.colorClassName).toBe("text-git-modified");
      expect(status.files.get("module/src/Example.java")?.label).not.toBe("Contains changes");
    }
  }
});

test("untracked siblings cannot override tracked directory changes", () => {
  const files: GitFile[] = [
    { path: "module/src/New.java", status: "untracked", staged: false },
    { path: "module/src/Existing.java", status: "modified", staged: false },
  ];
  for (const ordered of [files, [...files].reverse()]) {
    const status = lookup(ordered);
    expect(status.directories.get("module")?.colorClassName).toBe("text-git-modified");
    expect(status.files.get("module/src/New.java")?.colorClassName).toBe("text-git-untracked");
  }
  expect(lookup([]).directories.size).toBe(0);
});
