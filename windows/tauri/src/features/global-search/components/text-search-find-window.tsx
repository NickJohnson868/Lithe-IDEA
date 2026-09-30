import { readFileContent } from "@/features/file-system/controllers/file-operations";
import { useEffect, useRef, useState } from "react";
import { searchFilesContent } from "@/features/file-search/lib/file-search-api";
import { filterSearchContext } from "../services/search-context";
import { mergeSearchResults } from "../utils/content-search-results";
import { CONTENT_SEARCH_PAGE_SIZE } from "../constants/limits";
import { useFileSystemStore } from "@/features/file-system/stores/file-system.store";
import type { TextSearchSnapshot } from "../types/global-search.types";
import { TextSearchPanel } from "./text-search-panel";
import { textSearchMatchColumn } from "../utils/text-search-results";

export default function TextSearchFindWindow({ snapshot }: { snapshot: TextSearchSnapshot }) {
  const [page, setPage] = useState(snapshot);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => {
    setPage(snapshot);
    setError(null);
    setLoading(false);
    return () => active.current?.abort();
  }, [snapshot]);
  const loadMore = async () => {
    if (!page.root || loading || !page.hasMore) return;
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await searchFilesContent({
        root_paths: [page.root],
        query: page.query,
        case_sensitive: page.options.caseSensitive,
        whole_word: page.options.wholeWord,
        use_regex: page.options.useRegex,
        file_mask: page.options.fileMask,
        include_ignored: page.options.includeIgnored ?? false,
        max_results: CONTENT_SEARCH_PAGE_SIZE,
        file_offset: page.nextOffset,
        signal: controller.signal,
      });
      const filtered = await filterSearchContext(
        response,
        page.options.context,
        () => controller.signal.aborted,
      );
      if (!controller.signal.aborted)
        setPage((current) => ({
          ...current,
          results: mergeSearchResults(current.results, filtered.results),
          hasMore: response.has_more,
          nextOffset: response.next_file_offset,
        }));
    } catch (reason) {
      if (!controller.signal.aborted) setError(String(reason));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="truncate border-b border-border px-4 py-2 font-medium">
        Find: {snapshot.query}
      </div>
      <TextSearchPanel
        query={snapshot.query}
        options={snapshot.options}
        results={page.results}
        root={snapshot.root}
        showControls={false}
        pending={false}
        error={error}
        availability="ready"
        focusRequest={0}
        hasMore={page.hasMore ?? false}
        loadingMore={loading}
        onQueryChange={() => {}}
        onLoadMore={() => void loadMore()}
        onRetry={() => void loadMore()}
        readSource={readFileContent}
        onOpen={(row) => {
          void readFileContent(row.path)
            .then((source) =>
              useFileSystemStore
                .getState()
                .handleFileSelect(
                  row.path,
                  false,
                  row.match.line_number,
                  textSearchMatchColumn(
                    source.split(/\r?\n/)[row.match.line_number - 1] ?? "",
                    row.match,
                  ),
                ),
            )
            .catch((reason) => setError(String(reason)));
        }}
      />
    </div>
  );
}
