import { useEffect, useMemo, useRef, useState } from "react";
import { useBufferStore } from "@/features/editor/stores/buffer.store";
import { readFileContent } from "@/features/file-system/controllers/file-operations";
import { useFileSystemStore } from "@/features/file-system/stores/file-system.store";
import { useUIState } from "@/features/window/stores/ui-state.store";
import { useTranslation } from "@/i18n/locale-provider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/dialog";
import { DialogResizeHandles } from "@/ui/dialog-resize";
import { useContentSearch } from "../hooks/use-content-search";
import { useGlobalSearchStore } from "../stores/global-search.store";
import { textSearchMatchColumn, type TextSearchRow } from "../utils/text-search-results";
import { TextSearchPanel } from "./text-search-panel";
import { useTextSearchPreferences } from "../stores/text-search-preferences.store";

function SearchSession({ request }: { request: number }) {
  const { t } = useTranslation();
  const search = useContentSearch();
  const pinned = useTextSearchPreferences((state) => state.pinned);
  const setPinned = useTextSearchPreferences((state) => state.setPinned);
  const initialSize = useRef(useTextSearchPreferences.getState().dialogSize).current;
  const dialogRef = useRef<HTMLDivElement>(null);
  const history = useGlobalSearchStore((state) => state.history);
  useEffect(() => {
    if (search.query.trim() && !search.isSearchPending && !search.isSearching && !search.error)
      useGlobalSearchStore.getState().actions.rememberQuery(search.query);
  }, [search.query, search.isSearchPending, search.isSearching, search.error]);
  const [openError, setOpenError] = useState<string | null>(null);
  const navigationStarted = useRef(false);
  // Preview and navigation share only the most recently read file, not an
  // unbounded cache of every result visited during the search session.
  const readSource = useMemo(() => {
    let cachedPath: string | null = null;
    let cachedRead: Promise<string> | null = null;
    return (path: string) => {
      if (path !== cachedPath || !cachedRead) {
        cachedPath = path;
        cachedRead = readFileContent(path);
      }
      return cachedRead;
    };
  }, []);
  const close = () => useUIState.getState().setIsGlobalSearchVisible(false);
  const open = async (row: TextSearchRow) => {
    const query = search.query;
    const isCurrent = () =>
      useUIState.getState().isGlobalSearchVisible &&
      useUIState.getState().globalSearchRequest === request &&
      useGlobalSearchStore.getState().query === query &&
      useFileSystemStore.getState().rootFolderPath === search.rootFolderPath;
    try {
      const source = await readSource(row.path);
      if (!isCurrent()) return;
      const line = source.split(/\r?\n/)[row.match.line_number - 1] ?? "";
      navigationStarted.current = true;
      await useFileSystemStore
        .getState()
        .handleFileSelect(
          row.path,
          false,
          row.match.line_number,
          textSearchMatchColumn(line, row.match),
        );
      if (isCurrent()) close();
    } catch {
      navigationStarted.current = false;
      if (isCurrent()) setOpenError(t("textSearch.previewFailed"));
    }
  };
  return (
    <Dialog
      open
      disablePointerDismissal={pinned}
      onOpenChange={(visible) => {
        if (!visible) close();
      }}
    >
      <DialogContent
        ref={dialogRef}
        className="h-[min(42rem,85vh)] w-[min(62rem,calc(100vw-3rem))] max-h-none max-w-none gap-0 p-0"
        finalFocus={() => (navigationStarted.current ? false : true)}
        aria-describedby={undefined}
      >
        <DialogResizeHandles
          target={dialogRef}
          label={t("textSearch.resizeDialog")}
          initialSize={initialSize}
          onInteractionEnd={useTextSearchPreferences.getState().setDialogSize}
        >
          <DialogHeader className="shrink-0 pb-2 pr-12">
            <DialogTitle>{t("textSearch.title")}</DialogTitle>
          </DialogHeader>
        </DialogResizeHandles>
        <TextSearchPanel
          options={search.searchOptions}
          onOptionChange={search.setSearchOption}
          history={history}
          pinned={pinned}
          onPinnedChange={setPinned}
          onRetry={() => void search.refreshSearch()}
          onFind={(newTab) => {
            navigationStarted.current = true;
            useBufferStore.getState().actions.openContent({
              type: "globalSearch",
              newTab,
              searchSnapshot: {
                query: search.query,
                root: search.rootFolderPath ?? null,
                options: { ...search.searchOptions },
                results: structuredClone(search.results),
                hasMore: search.hasMoreResults,
                nextOffset: search.nextFileOffset,
              },
            });
            close();
          }}
          query={search.query}
          results={search.results}
          root={search.rootFolderPath ?? null}
          pending={search.isSearchPending || search.isSearching || search.isIndexing}
          error={search.error || openError}
          availability={search.availability}
          focusRequest={request}
          hasMore={search.hasMoreResults}
          loadingMore={search.isLoadingMore}
          onQueryChange={(query) => {
            setOpenError(null);
            search.setQuery(query);
          }}
          onOpen={(row) => void open(row)}
          onLoadMore={() => void search.loadMoreResults()}
          readSource={readSource}
        />
      </DialogContent>
    </Dialog>
  );
}

export default function GlobalSearchDialog() {
  const visible = useUIState((state) => state.isGlobalSearchVisible);
  const request = useUIState((state) => state.globalSearchRequest);
  return visible ? <SearchSession request={request} /> : null;
}
