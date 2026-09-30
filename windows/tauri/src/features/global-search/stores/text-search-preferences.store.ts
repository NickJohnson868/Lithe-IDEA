import { create } from "zustand";
import { persist } from "zustand/middleware";
import { createSafeJSONStorage } from "@/utils/zustand-storage";

interface SearchLayoutPreferences {
  dialogSize: { width: number; height: number; left?: number; top?: number } | null;
  panelLayout: Record<string, number>;
  pinned: boolean;
}
interface SearchLayoutStore extends SearchLayoutPreferences {
  setDialogSize: (size: NonNullable<SearchLayoutPreferences["dialogSize"]>) => void;
  setPanelLayout: (layout: Record<string, number>) => void;
  setPinned: (pinned: boolean) => void;
}

export const useTextSearchPreferences = create<SearchLayoutStore>()(
  persist(
    (set) => ({
      dialogSize: null,
      panelLayout: { results: 55, preview: 45 },
      pinned: true,
      setDialogSize: (dialogSize) => set({ dialogSize }),
      setPanelLayout: (panelLayout) => set({ panelLayout }),
      setPinned: (pinned) => set({ pinned }),
    }),
    {
      name: "text-search-layout",
      storage: createSafeJSONStorage<SearchLayoutPreferences>(),
      partialize: ({ dialogSize, panelLayout, pinned }) => ({ dialogSize, panelLayout, pinned }),
      merge: (saved, current) => {
        const value = (saved ?? {}) as Partial<SearchLayoutPreferences>;
        const validSize =
          value.dialogSize &&
          [value.dialogSize.width, value.dialogSize.height].every(
            (number) => Number.isFinite(number) && number > 0,
          );
        const results = value.panelLayout?.results;
        return {
          ...current,
          dialogSize: validSize
            ? {
                width: value.dialogSize!.width,
                height: value.dialogSize!.height,
                ...(Number.isFinite(value.dialogSize!.left)
                  ? { left: value.dialogSize!.left }
                  : {}),
                ...(Number.isFinite(value.dialogSize!.top) ? { top: value.dialogSize!.top } : {}),
              }
            : current.dialogSize,
          panelLayout:
            typeof results === "number" && Number.isFinite(results)
              ? {
                  results: Math.max(20, Math.min(80, results)),
                  preview: 100 - Math.max(20, Math.min(80, results)),
                }
              : current.panelLayout,
          pinned: typeof value.pinned === "boolean" ? value.pinned : current.pinned,
        };
      },
    },
  ),
);
