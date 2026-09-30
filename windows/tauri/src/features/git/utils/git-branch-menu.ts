import type { GitReference, GitReferenceSnapshot } from "../types/git.types";
import { matchesSearchQuery } from "@/utils/search-match";

export interface BranchMenuGroup {
  id: "recent" | "local" | "remote";
  references: GitReference[];
}

/** Keeps rendered groups and keyboard selection in the same stable order. */
export function buildBranchMenuGroups(
  snapshot: GitReferenceSnapshot,
  query: string,
): BranchMenuGroup[] {
  const includes = (reference: GitReference) =>
    reference.kind !== "tag" &&
    (!query.trim() ||
      matchesSearchQuery(query.trim().toLowerCase(), [
        reference.shortName,
        reference.upstreamShortName ?? "",
      ]));
  const sort = (references: GitReference[]) =>
    [...references].sort(
      (left, right) =>
        Number(right.isCurrent) - Number(left.isCurrent) ||
        left.shortName.localeCompare(right.shortName),
    );
  const groups: BranchMenuGroup[] = [
    { id: "recent", references: snapshot.recentReferences.filter(includes) },
    {
      id: "local",
      references: sort(
        snapshot.references.filter(
          (reference) => reference.kind === "local" && includes(reference),
        ),
      ),
    },
    {
      id: "remote",
      references: sort(
        snapshot.references.filter(
          (reference) => reference.kind === "remote" && includes(reference),
        ),
      ),
    },
  ];
  return groups.filter((group) => group.references.length > 0);
}
