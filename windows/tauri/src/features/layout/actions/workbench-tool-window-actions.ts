import { useGlobalSearchStore } from "@/features/global-search/stores/global-search.store";
import { useUIState } from "@/features/window/stores/ui-state.store";

interface DiagnosticsPaneState {
  bottomPaneActiveTab: string;
  isBottomPaneVisible: boolean;
}

interface DiagnosticsPaneUpdate {
  bottomPaneActiveTab: "diagnostics";
  isBottomPaneVisible: boolean;
}

export function resolveDiagnosticsPaneUpdate(state: DiagnosticsPaneState): DiagnosticsPaneUpdate {
  return {
    bottomPaneActiveTab: "diagnostics",
    isBottomPaneVisible: !(
      state.isBottomPaneVisible && state.bottomPaneActiveTab === "diagnostics"
    ),
  };
}

export function toggleDiagnosticsPane(): void {
  const state = useUIState.getState();
  const update = resolveDiagnosticsPaneUpdate(state);

  if (update.bottomPaneActiveTab !== state.bottomPaneActiveTab) {
    state.setBottomPaneActiveTab(update.bottomPaneActiveTab);
  }
  state.setIsBottomPaneVisible(update.isBottomPaneVisible);
}

export function openGlobalSearch(): void {
  const ui = useUIState.getState();
  if (!ui.isGlobalSearchVisible) {
    useGlobalSearchStore.getState().actions.prepareTextSearch();
  }
  ui.setIsGlobalSearchVisible(true);
}
