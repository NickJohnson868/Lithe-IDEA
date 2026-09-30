import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useBufferStore } from "@/features/editor/stores/buffer.store";
import { getBufferById } from "@/features/editor/utils/buffer-index";
import { useFileSystemStore } from "@/features/file-system/stores/file-system.store";
import { workspaceRuntimeRegistry } from "@/features/workspace/runtime/workspace-runtime-registry";
import {
  useActiveWorkspaceId,
  useWorkspaceStoreScopeId,
} from "@/features/workspace/stores/create-workspace-scoped-store";
import { useTranslation } from "@/i18n/locale-provider";
import { getFileDiff } from "../api/git-diff-api";
import { isGitChangeRelevant, subscribeToGitChanges } from "../events/git-events";
import type { MultiFileDiff } from "../types/git-diff.types";
import type { GitDiff } from "../types/git.types";
import { getDiffBufferFilePath } from "../utils/diff-buffer-path";
import { createDiffLoadController, type DiffRefreshScheduler } from "./git-diff-load-controller";

interface UseDiffDataReturn {
  diff: GitDiff | null;
  rawDiffData: GitDiff | MultiFileDiff | null;
  filePath: string | null;
  isStaged: boolean;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  switchToView: (viewType: "staged" | "unstaged") => void;
}

export const useDiffData = (scheduler?: DiffRefreshScheduler): UseDiffDataReturn => {
  const { t } = useTranslation();
  const scopedWorkspaceId = useWorkspaceStoreScopeId();
  const activeWorkspaceId = useActiveWorkspaceId();
  const workspaceId = scopedWorkspaceId ?? activeWorkspaceId;
  const bufferStore = useBufferStore.getStore(workspaceId);
  const activeBuffer = useBufferStore((state) => {
    if (!state.activeBufferId) return null;
    return getBufferById(state.buffers, state.activeBufferId);
  });
  const rootFolderPath = useFileSystemStore.use.rootFolderPath?.();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopeKey = `${workspaceId}\0${rootFolderPath ?? ""}\0${activeBuffer?.id ?? ""}`;
  const currentScopeRef = useRef(scopeKey);
  currentScopeRef.current = scopeKey;
  useEffect(() => {
    setIsLoading(false);
    setError(null);
  }, [scopeKey]);

  const rawDiffData: GitDiff | MultiFileDiff | null =
    (activeBuffer?.type === "diff" && activeBuffer.diffData) ||
    (activeBuffer?.type === "diff" && activeBuffer.content
      ? (() => {
          try {
            return JSON.parse(activeBuffer.content) as GitDiff | MultiFileDiff;
          } catch {
            return null;
          }
        })()
      : null);

  const diff = rawDiffData && "file_path" in rawDiffData ? rawDiffData : null;

  const stagedMatch = activeBuffer?.path.match(/^diff:\/\/(staged|unstaged)\/(.+)$/);
  const isStaged = stagedMatch?.[1] === "staged";
  const isWorkingTreeFileDiff = Boolean(stagedMatch);
  const filePath = getDiffBufferFilePath(activeBuffer?.path);

  const openView = useCallback(
    (viewType: "staged" | "unstaged", newDiff: GitDiff) => {
      if (!filePath) return;
      bufferStore
        .getState()
        .actions.openBuffer(
          `diff://${viewType}/${encodeURIComponent(filePath)}`,
          `${filePath.split("/").pop()} (${viewType})`,
          "",
          false,
          undefined,
          true,
          true,
          newDiff,
        );
    },
    [bufferStore, filePath],
  );

  const bufferId = activeBuffer?.id;
  const controller = useMemo(
    () =>
      createDiffLoadController(
        {
          isCurrent: () =>
            currentScopeRef.current === scopeKey &&
            bufferStore.getState().activeBufferId === bufferId &&
            useFileSystemStore.getStore(workspaceId).getState().rootFolderPath === rootFolderPath &&
            (scopedWorkspaceId !== null ||
              workspaceRuntimeRegistry.getActiveWorkspaceId() === workspaceId) &&
            Boolean(isWorkingTreeFileDiff && rootFolderPath && filePath && bufferId),
          isStaged,
          read: (staged) => getFileDiff(rootFolderPath!, filePath!, staged),
          update: (nextDiff) =>
            bufferStore.getState().actions.updateBufferContent(bufferId!, "", false, nextDiff),
          open: (staged, nextDiff) => openView(staged ? "staged" : "unstaged", nextDiff),
          close: () => bufferStore.getState().actions.closeBuffer(bufferId!),
          loading: setIsLoading,
          error: (failure) =>
            setError(
              failure === null
                ? null
                : failure instanceof Error
                  ? failure.message
                  : t("git.diff.refreshFailed"),
            ),
        },
        scheduler,
      ),
    [
      scopeKey,
      workspaceId,
      scopedWorkspaceId,
      isWorkingTreeFileDiff,
      rootFolderPath,
      filePath,
      bufferId,
      isStaged,
      bufferStore,
      openView,
      scheduler,
      t,
    ],
  );
  useEffect(() => {
    controller.activate();
    setIsLoading(false);
    setError(null);
    return () => controller.dispose();
  }, [controller]);
  const refresh = useCallback(() => controller.refresh(), [controller]);
  const switchToView = useCallback(
    (viewType: "staged" | "unstaged") => {
      void controller.switchView(viewType === "staged");
    },
    [controller],
  );

  useEffect(
    () =>
      subscribeToGitChanges((change) => {
        if (!isWorkingTreeFileDiff || !rootFolderPath || !filePath) return;
        if (isGitChangeRelevant(change, rootFolderPath, filePath)) controller.scheduleRefresh();
      }),
    [controller, rootFolderPath, filePath, isWorkingTreeFileDiff],
  );

  return {
    diff,
    rawDiffData,
    filePath,
    isStaged,
    isLoading,
    error,
    refresh,
    switchToView,
  };
};
