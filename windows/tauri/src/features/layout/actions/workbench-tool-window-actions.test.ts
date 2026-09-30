import { expect, test } from "bun:test";
import { useUIState } from "@/features/window/stores/ui-state.store";
import { useGlobalSearchStore } from "@/features/global-search/stores/global-search.store";
import { resolveDiagnosticsPaneUpdate, openGlobalSearch } from "./workbench-tool-window-actions";

test("global text search opens a modal and refocuses repeated requests", () => {
  const before = useUIState.getState();
  const searchBefore = useGlobalSearchStore.getState();
  try {
    openGlobalSearch();
    expect(useUIState.getState().isGlobalSearchVisible).toBe(true);
    expect(useUIState.getState().globalSearchRequest).toBe(before.globalSearchRequest + 1);
    expect(useUIState.getState().activeSidebarView).toBe(before.activeSidebarView);
    const pendingGeneration = useGlobalSearchStore.getState().actions.beginSearch();
    openGlobalSearch();
    expect(useUIState.getState().globalSearchRequest).toBe(before.globalSearchRequest + 2);
    expect(useGlobalSearchStore.getState().actions.isCurrentRequest(pendingGeneration)).toBe(true);
  } finally {
    useUIState.setState(before);
    useGlobalSearchStore.setState(searchBefore);
  }
});

test("diagnostics opens and toggles the bottom pane", () => {
  expect(
    resolveDiagnosticsPaneUpdate({
      bottomPaneActiveTab: "terminal",
      isBottomPaneVisible: false,
    }),
  ).toEqual({
    bottomPaneActiveTab: "diagnostics",
    isBottomPaneVisible: true,
  });

  expect(
    resolveDiagnosticsPaneUpdate({
      bottomPaneActiveTab: "diagnostics",
      isBottomPaneVisible: true,
    }),
  ).toEqual({
    bottomPaneActiveTab: "diagnostics",
    isBottomPaneVisible: false,
  });
});
