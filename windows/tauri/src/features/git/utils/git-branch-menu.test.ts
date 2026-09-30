import { expect, test } from "bun:test";
import type { GitReference } from "../types/git.types";
import { buildBranchMenuGroups } from "./git-branch-menu";

test("branch popup groups preserve recency, current branch and tracking search", () => {
  const main: GitReference = {
    fullName: "refs/heads/main",
    shortName: "main",
    kind: "local",
    isCurrent: true,
    peelsToCommit: true,
    upstreamShortName: "origin/main",
    ahead: 3,
    behind: 2,
  };
  const feature = {
    ...main,
    fullName: "refs/heads/feature",
    shortName: "feature",
    isCurrent: false,
    upstreamShortName: "origin/feature",
  };
  const remote = {
    ...main,
    fullName: "refs/remotes/origin/main",
    shortName: "origin/main",
    kind: "remote" as const,
    isCurrent: false,
  };
  const snapshot = { references: [feature, remote, main], recentReferences: [feature, main] };
  const groups = buildBranchMenuGroups(snapshot, "");
  expect(groups.map((group) => group.id)).toEqual(["recent", "local", "remote"]);
  expect(groups[0].references).toEqual([feature, main]);
  expect(groups[1].references).toEqual([main, feature]);
  expect(
    buildBranchMenuGroups(snapshot, "origin/feature").map((group) => group.references),
  ).toEqual([[feature], [feature]]);
  expect(buildBranchMenuGroups(snapshot, "unknown")).toEqual([]);
});
