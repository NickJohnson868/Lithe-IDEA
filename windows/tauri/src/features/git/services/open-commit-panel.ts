import { useUIState } from "@/features/window/stores/ui-state.store";

/** Durable focus state also works when the Git view has not mounted yet. */
export function openGitCommitPanel(): void {
  const ui = useUIState.getState();
  ui.setIsSidebarVisible(true);
  ui.requestGitCommitPanel();
}
