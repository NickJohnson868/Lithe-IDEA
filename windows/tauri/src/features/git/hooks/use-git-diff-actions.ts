import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { activateMainEditorPane } from "@/features/editor/stores/buffer-pane-sync";
import { useBufferStore } from "@/features/editor/stores/buffer.store";
import {
  useActiveWorkspaceId,
  useWorkspaceStoreScopeId,
} from "@/features/workspace/stores/create-workspace-scoped-store";
import { workspaceRuntimeRegistry } from "@/features/workspace/runtime/workspace-runtime-registry";
import { useTranslation } from "@/i18n/locale-provider";
import { showAlertDialog } from "@/ui/dialog";
import {
  getCommitDiff,
  getFileDiff,
  getRefDiff,
  getStashDiff,
  getTypedReferenceDiff,
  getWorkingTreePathDiff,
  getWorkingTreeRefDiff,
} from "../api/git-diff-api";
import {
  loadWorkingTreeDiffsProgressively,
  type WorkingTreeDiffEntry,
  type WorkingTreeDiffScope,
} from "../services/working-tree-diff-loader";
import type { MultiFileDiff } from "../types/git-diff.types";
import type { GitCommit, GitDiff, GitFile, GitReference } from "../types/git.types";
import { mapGitReadsInBatches } from "../utils/git-async-batch";
import { aggregateSelectedCommitDiffs } from "../utils/git-commit-selection-diff";
import {
  getGitFileOriginalRepositoryRelativePath,
  getGitFileRepositoryPath,
  getGitFileRepositoryRelativePath,
} from "../utils/git-status-selection";
import { createRequestGeneration, type RequestGeneration } from "../utils/request-generation";
import { createCommitDiffBuffer, createMultiFileDiff } from "../utils/multi-file-diff";
import { createSingleFileWorkingTreeDiff } from "../utils/working-tree-multi-diff";

const WORKING_TREE_TITLES: Record<WorkingTreeDiffScope, string> = {
  all: "git.diff.uncommitted",
  unstaged: "git.diff.unstagedChanges",
  staged: "git.diff.stagedChanges",
};

const WORKING_TREE_EMPTY_LABELS: Record<WorkingTreeDiffScope, string> = {
  all: "git.diff.emptyChanges",
  unstaged: "git.diff.emptyUnstagedChanges",
  staged: "git.diff.emptyStagedChanges",
};

function normalizeDisplayedFilePath(filePath: string, side: "old" | "new"): string {
  let actualFilePath = filePath;
  if (filePath.includes(" -> ")) {
    const [oldPath, newPath] = filePath.split(" -> ");
    actualFilePath = side === "new" ? newPath : oldPath;
  }

  const trimmed = actualFilePath.trim();
  return trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1) : trimmed;
}

export function useGitDiffActions({
  activeRepoPath,
  onFileSelect,
  gitFileByPath,
  workingTreeDiffEntriesByScope,
  commitByHash,
  currentBranch,
  currentReference,
  onBranchDiffOpened,
}: {
  activeRepoPath: string | null;
  onFileSelect?: (path: string, isDir: boolean) => void;
  gitFileByPath: Map<string, GitFile>;
  workingTreeDiffEntriesByScope: Record<WorkingTreeDiffScope, WorkingTreeDiffEntry[]>;
  commitByHash: Map<string, GitCommit>;
  currentBranch?: string;
  currentReference?: GitReference;
  onBranchDiffOpened?: () => void;
}) {
  const { t } = useTranslation();
  const scopedWorkspaceId = useWorkspaceStoreScopeId();
  const activeWorkspaceId = useActiveWorkspaceId();
  const workspaceId = scopedWorkspaceId ?? activeWorkspaceId;
  const bufferStore = useBufferStore.getStore(workspaceId);
  const openDiffBuffer = useCallback(
    (virtualPath: string, displayName: string, diffData: GitDiff | MultiFileDiff) => {
      activateMainEditorPane(workspaceId);
      return bufferStore
        .getState()
        .actions.openBuffer(virtualPath, displayName, "", false, undefined, true, true, diffData);
    },
    [bufferStore, workspaceId],
  );
  const [isLoadingCommitDiff, setIsLoadingCommitDiff] = useState(false);
  const [isLoadingBranchDiff, setIsLoadingBranchDiff] = useState(false);
  const activeRepoPathRef = useRef(activeRepoPath);
  activeRepoPathRef.current = activeRepoPath;
  const latestFileDiffRequest = useMemo(
    () =>
      createRequestGeneration(
        () =>
          activeRepoPathRef.current === activeRepoPath &&
          workspaceRuntimeRegistry.getActiveWorkspaceId() === workspaceId,
      ),
    [activeRepoPath, workspaceId],
  );
  const isDiffRequestCurrent = useCallback(
    (requestId: number) => latestFileDiffRequest.isCurrent(requestId),
    [latestFileDiffRequest],
  );
  const beginDiffRequest = useCallback(() => {
    setIsLoadingCommitDiff(false);
    setIsLoadingBranchDiff(false);
    return latestFileDiffRequest.begin();
  }, [latestFileDiffRequest]);
  useEffect(() => {
    setIsLoadingCommitDiff(false);
    setIsLoadingBranchDiff(false);
    return () => {
      latestFileDiffRequest.begin();
    };
  }, [latestFileDiffRequest, activeRepoPath, workspaceId]);

  const openOriginalFile = useCallback(
    async (filePath: string) => {
      if (!activeRepoPath || !onFileSelect) return;

      try {
        const actualFilePath = normalizeDisplayedFilePath(filePath, "new");
        const file = gitFileByPath.get(actualFilePath);
        const fileRepoPath = file ? getGitFileRepositoryPath(file, activeRepoPath) : activeRepoPath;
        const relativePath = file ? getGitFileRepositoryRelativePath(file) : actualFilePath;
        activateMainEditorPane(workspaceId);
        onFileSelect(`${fileRepoPath}/${relativePath}`, false);
      } catch (error) {
        console.error("Error opening file:", error);
        await showAlertDialog(
          t("git.diff.openFileFailed", {
            file: filePath,
            error: String(error),
          }),
          t("files.open"),
        );
      }
    },
    [activeRepoPath, gitFileByPath, onFileSelect, t, workspaceId],
  );

  const viewFileDiff = useCallback(
    async (filePath: string, staged = false) => {
      if (!activeRepoPath) return;
      const requestId = beginDiffRequest();

      try {
        const actualFilePath = normalizeDisplayedFilePath(filePath, staged ? "new" : "old");
        const file = gitFileByPath.get(actualFilePath);
        if (file) {
          const fileKey = `${staged ? "staged" : "unstaged"}:${actualFilePath}`;
          const fileRepoPath = getGitFileRepositoryPath(file, activeRepoPath) ?? activeRepoPath;
          const relativePath = getGitFileRepositoryRelativePath(file);
          const originalRelativePath = getGitFileOriginalRepositoryRelativePath(file);
          const title = t(WORKING_TREE_TITLES.all);
          const loadingDiff: MultiFileDiff = {
            title,
            repoPath: fileRepoPath,
            commitHash: "working-tree",
            files: [],
            totalFiles: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            fileKeys: [],
            initiallyExpandedFileKey: fileKey,
            isLoading: true,
            indexingProgress: {
              processed: 0,
              total: 1,
              label: t("git.indexing"),
            },
          };
          const bufferId = openDiffBuffer("diff://working-tree/all-files", title, loadingDiff);
          void (async () => {
            const diff = await getWorkingTreePathDiff(
              fileRepoPath,
              relativePath,
              file.status === "untracked",
              originalRelativePath,
            );
            if (!isDiffRequestCurrent(requestId)) {
              return;
            }
            await loadWorkingTreeDiffsProgressively({
              repoPath: fileRepoPath,
              bufferId,
              title,
              indexingLabel: t("git.indexing"),
              diffEntries: [],
              initialDiffs:
                diff && (diff.lines.length > 0 || diff.is_image || diff.is_binary)
                  ? [{ fileKey, diff }]
                  : [],
              initialProcessed: 1,
              initiallyExpandedFileKey: fileKey,
            });
          })();
          return;
        }

        const diff = await getFileDiff(activeRepoPath, actualFilePath, staged);
        if (!isDiffRequestCurrent(requestId)) {
          return;
        }
        if (!diff || (diff.lines.length === 0 && !diff.is_image && !diff.is_binary)) {
          await openOriginalFile(actualFilePath);
          return;
        }

        const fileKey = `${staged ? "staged" : "unstaged"}:${actualFilePath}`;
        const selectedDiff = createSingleFileWorkingTreeDiff({
          repoPath: activeRepoPath,
          fileKey,
          diff,
          title: t(WORKING_TREE_TITLES.all),
        });

        openDiffBuffer("diff://working-tree/all-files", t(WORKING_TREE_TITLES.all), selectedDiff);
      } catch (error) {
        if (!isDiffRequestCurrent(requestId)) {
          return;
        }
        console.error("Error getting file diff:", error);
        await showAlertDialog(
          t("git.diff.getFileDiffFailed", {
            file: filePath,
            error: String(error),
          }),
          t("git.diff.title"),
        );
      }
    },
    [activeRepoPath, gitFileByPath, latestFileDiffRequest, isDiffRequestCurrent, openOriginalFile, openDiffBuffer, t, beginDiffRequest],
  );

  const viewWorkingTreeDiff = useCallback(
    async (scope: WorkingTreeDiffScope = "all", filePaths?: string[]) => {
      if (!activeRepoPath) return;
      beginDiffRequest();

      try {
        const selectedFilePaths = filePaths ? new Set(filePaths) : null;
        const diffEntries = selectedFilePaths
          ? workingTreeDiffEntriesByScope[scope].filter(([, file]) =>
              selectedFilePaths.has(file.path),
            )
          : workingTreeDiffEntriesByScope[scope];
        if (diffEntries.length === 0) {
          await showAlertDialog(t(WORKING_TREE_EMPTY_LABELS[scope]), t("git.diff.title"));
          return;
        }

        const title = t(WORKING_TREE_TITLES[scope]);
        const multiDiff: MultiFileDiff = {
          title,
          repoPath: activeRepoPath,
          commitHash: "working-tree",
          files: [],
          totalFiles: 0,
          totalAdditions: 0,
          totalDeletions: 0,
          fileKeys: [],
          isLoading: true,
          indexingProgress: {
            processed: 0,
            total: diffEntries.length,
            label: t("git.indexing"),
          },
        };
        const bufferId = openDiffBuffer(`diff://working-tree/${scope}`, title, multiDiff);

        void loadWorkingTreeDiffsProgressively({
          repoPath: activeRepoPath,
          bufferId,
          title,
          indexingLabel: t("git.indexing"),
          diffEntries,
          wholePathSnapshot: scope === "all",
        });
      } catch (error) {
        console.error("Error getting working tree diff:", error);
        await showAlertDialog(
          t("git.diff.getWorkingTreeDiffFailed", { error: String(error) }),
          t("git.diff.title"),
        );
      }
    },
    [activeRepoPath, t, workingTreeDiffEntriesByScope, openDiffBuffer, beginDiffRequest],
  );

  const viewCommitDiff = useCallback(
    async (commitHash: string, filePath?: string) => {
      if (!activeRepoPath) return;

      const requestId = beginDiffRequest();
      setIsLoadingCommitDiff(true);
      try {
        const diffs = await getCommitDiff(activeRepoPath, commitHash);
        if (!isDiffRequestCurrent(requestId)) return;
        if (!diffs?.length) {
          await showAlertDialog(
            filePath
              ? t("git.diff.noChangesInCommitForFile", { file: filePath })
              : t("git.diff.noChangesInCommit"),
            t("git.diff.title"),
          );
          return;
        }

        const commit = commitByHash.get(commitHash);
        const buffer = createCommitDiffBuffer({
          repoPath: activeRepoPath,
          commitHash,
          diffs,
          commit,
          initialFilePath: filePath,
        });
        openDiffBuffer(buffer.virtualPath, buffer.displayName, buffer.diffData);
      } catch (error) {
        if (!isDiffRequestCurrent(requestId)) return;
        console.error("Error getting commit diff:", error);
        await showAlertDialog(
          t("git.diff.getCommitDiffFailed", {
            commit: commitHash,
            error: String(error),
          }),
          t("git.diff.title"),
        );
      } finally {
        if (isDiffRequestCurrent(requestId)) setIsLoadingCommitDiff(false);
      }
    },
    [activeRepoPath, commitByHash, t, latestFileDiffRequest, isDiffRequestCurrent, openDiffBuffer, beginDiffRequest],
  );

  const viewCommitRangeDiff = useCallback(
    async (
      baseRef: string | null,
      targetRef: string,
      oldestLabel: string,
      newestLabel: string,
      filePath?: string,
    ) => {
      if (!activeRepoPath) return;

      const requestId = beginDiffRequest();
      setIsLoadingCommitDiff(true);
      try {
        const diffs = await getRefDiff(activeRepoPath, baseRef, targetRef);
        if (!isDiffRequestCurrent(requestId)) return;
        if (!diffs?.length) {
          await showAlertDialog(
            t("git.diff.noChangesBetween", {
              base: oldestLabel,
              target: newestLabel,
            }),
            t("git.diff.title"),
          );
          return;
        }

        const title = t("git.diff.commitRangeTitle", {
          base: oldestLabel,
          target: newestLabel,
        });
        const diffData = createMultiFileDiff({
          title,
          repoPath: activeRepoPath,
          commitHash: `${baseRef ?? "root"}..${targetRef}`,
          diffs,
          initialFilePath: filePath,
        });
        openDiffBuffer(
          `diff://commit-range/${encodeURIComponent(baseRef ?? "root")}..${encodeURIComponent(targetRef)}`,
          `${title} (${diffs.length} files)`,
          diffData,
        );
      } catch (error) {
        if (!isDiffRequestCurrent(requestId)) return;
        console.error("Error getting commit range diff:", error);
        await showAlertDialog(
          t("git.diff.compareRefsFailed", {
            base: oldestLabel,
            target: newestLabel,
            error: String(error),
          }),
          t("git.diff.title"),
        );
      } finally {
        if (isDiffRequestCurrent(requestId)) setIsLoadingCommitDiff(false);
      }
    },
    [activeRepoPath, t, latestFileDiffRequest, isDiffRequestCurrent, openDiffBuffer, beginDiffRequest],
  );

  const viewCommitSelectionDiff = useCallback(
    async (commits: readonly GitCommit[], filePath?: string) => {
      if (!activeRepoPath || commits.length === 0) return;
      const requestId = beginDiffRequest();
      setIsLoadingCommitDiff(true);
      try {
        const results = await mapGitReadsInBatches(commits, async (commit) => ({
          commit,
          diffs: await getCommitDiff(activeRepoPath, commit.hash),
        }));
        if (!isDiffRequestCurrent(requestId)) return;
        if (results.some((result) => result.diffs === null)) {
          throw new Error(t("git.log.unableToLoadFiles"));
        }
        const aggregate = aggregateSelectedCommitDiffs(
          results.map((result) => ({
            commit: result.commit,
            diffs: result.diffs ?? [],
          })),
        );
        if (aggregate.diffs.length === 0) {
          await showAlertDialog(t("git.diff.noChangesInSelectedCommits"), t("git.diff.title"));
          return;
        }

        const title = t("git.diff.selectedCommitsTitle", {
          count: commits.length,
        });
        const selectionKey = commits.map((commit) => commit.hash).join(",");
        const diffData = createMultiFileDiff({
          title,
          repoPath: activeRepoPath,
          commitHash: commits[0]?.hash ?? "selection",
          diffs: aggregate.diffs,
          initialFilePath: filePath,
          fileKeys: aggregate.fileKeys,
          fileLabels: aggregate.fileLabels,
        });
        diffData.totalFiles = aggregate.files.length;
        openDiffBuffer(
          `diff://commit-selection/${encodeURIComponent(selectionKey)}/all-files`,
          `${title} (${aggregate.files.length} files)`,
          diffData,
        );
      } catch (error) {
        if (!isDiffRequestCurrent(requestId)) return;
        console.error("Error getting selected commit diffs:", error);
        await showAlertDialog(
          t("git.diff.getSelectedCommitDiffFailed", { error: String(error) }),
          t("git.diff.title"),
        );
      } finally {
        if (isDiffRequestCurrent(requestId)) setIsLoadingCommitDiff(false);
      }
    },
    [activeRepoPath, t, latestFileDiffRequest, isDiffRequestCurrent, openDiffBuffer, beginDiffRequest],
  );

  const viewStashDiff = useCallback(
    async (stashIndex: number) => {
      if (!activeRepoPath) return;

      const requestId = beginDiffRequest();
      try {
        const diffs = await getStashDiff(activeRepoPath, stashIndex);
        if (!isDiffRequestCurrent(requestId)) return;
        if (!diffs?.length) {
          await showAlertDialog(t("git.diff.noChangesInStash"), t("git.diff.title"));
          return;
        }

        const commitHash = `stash@{${stashIndex}}`;
        const multiDiff = createMultiFileDiff({
          repoPath: activeRepoPath,
          commitHash,
          diffs,
        });
        openDiffBuffer(
          `diff://stash/${stashIndex}/all-files`,
          `Stash @{${stashIndex}} (${diffs.length} files)`,
          multiDiff,
        );
      } catch (error) {
        if (!isDiffRequestCurrent(requestId)) return;
        console.error("Error getting stash diff:", error);
        await showAlertDialog(
          t("git.diff.getStashDiffFailed", {
            stash: `stash@{${stashIndex}}`,
            error: String(error),
          }),
          t("git.diff.title"),
        );
      }
    },
    [activeRepoPath, t, latestFileDiffRequest, isDiffRequestCurrent, openDiffBuffer, beginDiffRequest],
  );

  const viewTagComparison = useCallback(
    async (baseRef: string, targetRef: string, title: string) => {
      if (!activeRepoPath) return;

      const requestId = beginDiffRequest();
      try {
        const diffs = await getRefDiff(activeRepoPath, baseRef, targetRef);
        if (!isDiffRequestCurrent(requestId)) return;
        if (!diffs?.length) {
          await showAlertDialog(
            t("git.diff.noChangesBetween", {
              base: baseRef,
              target: targetRef,
            }),
            t("git.diff.title"),
          );
          return;
        }

        const multiDiff = createMultiFileDiff({
          title,
          repoPath: activeRepoPath,
          commitHash: `${baseRef}..${targetRef}`,
          diffs,
        });
        openDiffBuffer(
          `diff://tag/${encodeURIComponent(title)}/all-files`,
          `${title} (${diffs.length} files)`,
          multiDiff,
        );
      } catch (error) {
        if (!isDiffRequestCurrent(requestId)) return;
        console.error("Error getting tag comparison:", error);
        await showAlertDialog(
          t("git.diff.compareRefsFailed", {
            base: baseRef,
            target: targetRef,
            error: String(error),
          }),
          t("git.diff.title"),
        );
      }
    },
    [activeRepoPath, t, latestFileDiffRequest, isDiffRequestCurrent, openDiffBuffer, beginDiffRequest],
  );

  const viewBranchDiff = useCallback(
    async (baseBranch: GitReference | string) => {
      const targetBranch = currentBranch ?? "HEAD";
      const baseName = typeof baseBranch === "string" ? baseBranch : baseBranch.fullName;
      if (!activeRepoPath || !baseName || baseName === targetBranch) return;

      const title = `${baseName}..${targetBranch}`;
      const requestId = beginDiffRequest();
      setIsLoadingBranchDiff(true);
      try {
        const diffs =
          typeof baseBranch !== "string" && currentReference
            ? await getTypedReferenceDiff(activeRepoPath, baseBranch, currentReference)
            : await getRefDiff(activeRepoPath, baseName, targetBranch);
        if (!isDiffRequestCurrent(requestId)) return;
        if (!diffs?.length) {
          await showAlertDialog(
            t("git.diff.noChangesBetween", { base: baseName, target: targetBranch }),
            t("git.diff.title"),
          );
          return;
        }

        const multiDiff = createMultiFileDiff({
          title,
          repoPath: activeRepoPath,
          commitHash: title,
          diffs,
        });
        openDiffBuffer(
          `diff://branch/${encodeURIComponent(title)}/all-files`,
          `${title} (${diffs.length} files)`,
          multiDiff,
        );
        onBranchDiffOpened?.();
      } catch (error) {
        if (!isDiffRequestCurrent(requestId)) return;
        console.error("Error getting branch comparison:", error);
        await showAlertDialog(
          t("git.diff.compareRefsFailed", {
            base: baseName,
            target: targetBranch,
            error: String(error),
          }),
          t("git.diff.title"),
        );
      } finally {
        if (isDiffRequestCurrent(requestId)) setIsLoadingBranchDiff(false);
      }
    },
    [activeRepoPath, currentBranch, currentReference, onBranchDiffOpened, t, latestFileDiffRequest, isDiffRequestCurrent, openDiffBuffer, beginDiffRequest],
  );

  const viewReferenceWorkingTreeDiff = useCallback(
    async (reference: GitReference | string, displayName: string) => {
      if (!activeRepoPath) return;
      const requestId = beginDiffRequest();
      setIsLoadingBranchDiff(true);
      try {
        const diffs = await getWorkingTreeRefDiff(activeRepoPath, reference);
        if (!isDiffRequestCurrent(requestId)) return;
        if (!diffs?.length) {
          await showAlertDialog(
            t("git.log.noWorkingTreeDifferences", { branch: displayName }),
            t("git.diff.title"),
          );
          return;
        }
        const fullName = typeof reference === "string" ? reference : reference.fullName;
        const title = t("git.log.workingTreeComparisonTitle", {
          branch: displayName,
        });
        openDiffBuffer(
          `diff://working-tree-ref/${encodeURIComponent(fullName)}/all-files`,
          `${title} (${diffs.length} files)`,
          createMultiFileDiff({
            title,
            repoPath: activeRepoPath,
            commitHash: `${fullName}..working-tree`,
            diffs,
          }),
        );
      } catch (error) {
        if (!isDiffRequestCurrent(requestId)) return;
        console.error("Error comparing reference with the working tree:", error);
        await showAlertDialog(
          t("git.log.workingTreeComparisonFailed", {
            branch: displayName,
            error: String(error),
          }),
          t("git.diff.title"),
        );
      } finally {
        if (isDiffRequestCurrent(requestId)) setIsLoadingBranchDiff(false);
      }
    },
    [activeRepoPath, t, latestFileDiffRequest, isDiffRequestCurrent, openDiffBuffer, beginDiffRequest],
  );

  return {
    isLoadingCommitDiff,
    isLoadingBranchDiff,
    openOriginalFile,
    viewFileDiff,
    viewWorkingTreeDiff,
    viewCommitDiff,
    viewCommitRangeDiff,
    viewCommitSelectionDiff,
    viewStashDiff,
    viewTagComparison,
    viewBranchDiff,
    viewReferenceWorkingTreeDiff,
  };
}
