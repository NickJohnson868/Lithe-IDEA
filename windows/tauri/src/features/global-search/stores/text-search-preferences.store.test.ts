import { expect, test } from "bun:test";
import { useTextSearchPreferences } from "./text-search-preferences.store";

test("search geometry and pin survive storage hydration without replacing actions", async () => {
  const previous = useTextSearchPreferences.getState();
  const storage = useTextSearchPreferences.persist.getOptions().storage!;
  const saved = await storage.getItem("text-search-layout");
  try {
    previous.setDialogSize({ width: 1100, height: 720, left: 30, top: 40 });
    previous.setPanelLayout({ results: 35, preview: 65 });
    previous.setPinned(false);
    const persisted = await storage.getItem("text-search-layout");
    expect(persisted?.state).toEqual({
      dialogSize: { width: 1100, height: 720, left: 30, top: 40 },
      panelLayout: { results: 35, preview: 65 },
      pinned: false,
    });
    useTextSearchPreferences.setState({
      dialogSize: null,
      panelLayout: { results: 55, preview: 45 },
      pinned: true,
    });
    await storage.setItem("text-search-layout", persisted!);
    await useTextSearchPreferences.persist.rehydrate();
    expect(useTextSearchPreferences.getState().dialogSize).toEqual({
      width: 1100,
      height: 720,
      left: 30,
      top: 40,
    });
    expect(useTextSearchPreferences.getState().panelLayout).toEqual({ results: 35, preview: 65 });
    expect(useTextSearchPreferences.getState().pinned).toBe(false);
    expect(useTextSearchPreferences.getState().setPinned).toBe(previous.setPinned);
  } finally {
    useTextSearchPreferences.setState(previous);
    if (saved) await storage.setItem("text-search-layout", saved);
    else await storage.removeItem("text-search-layout");
  }
});
