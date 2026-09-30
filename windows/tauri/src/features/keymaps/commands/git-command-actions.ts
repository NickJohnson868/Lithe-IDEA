import { toast } from "sonner";
import { createAndCheckoutBranch } from "@/features/git/api/git-branches-api";
import { getGitPullWorkflow } from "@/features/git/api/git-remotes-api";
import { emitGitChanged } from "@/features/git/events/git-events";
import { showGitPushDialog } from "@/features/git/services/git-push-dialog-service";
import { useRepositoryStore } from "@/features/git/stores/git-repository.store";
import { getGitPullResultPresentation } from "@/features/git/utils/git-pull-result-presentation";
import { useSettingsStore } from "@/features/settings/stores/settings.store";
import { createTranslator } from "@/i18n/locale";
import { showPromptDialog } from "@/ui/dialog";
export { openGitCommitPanel } from "@/features/git/services/open-commit-panel";

function activeRepository(): string {
  const repoPath = useRepositoryStore.getState().activeRepoPath;
  if (!repoPath)
    throw new Error(
      createTranslator(useSettingsStore.getState().settings.displayLanguage)(
        "git.noRepositoryOpen",
      ),
    );
  return repoPath;
}

async function withGitFailureFeedback(operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (failure) {
    toast.error(failure instanceof Error ? failure.message : String(failure));
    throw failure;
  }
}

export async function pushGitChanges(): Promise<void> {
  await withGitFailureFeedback(async () => {
    await showGitPushDialog(activeRepository());
  });
}

export async function updateGitProject(): Promise<void> {
  await withGitFailureFeedback(async () => {
    const repoPath = activeRepository();
    const result = await getGitPullWorkflow(repoPath).run(repoPath, {
      refresh: async () => {
        emitGitChanged({
          repoPath,
          scopes: ["working-tree", "history", "refs", "remotes"],
          source: "update-shortcut",
        });
      },
    });
    const t = createTranslator(useSettingsStore.getState().settings.displayLanguage);
    const presentation = getGitPullResultPresentation(result, t);
    if (presentation) toast[presentation.tone](presentation.message);
  });
}

export async function newGitBranch(): Promise<void> {
  await withGitFailureFeedback(async () => {
    const repoPath = activeRepository();
    const t = createTranslator(useSettingsStore.getState().settings.displayLanguage);
    const name = await showPromptDialog(t("git.newBranch"));
    if (name?.trim()) await createAndCheckoutBranch(repoPath, name.trim(), "HEAD");
  });
}
