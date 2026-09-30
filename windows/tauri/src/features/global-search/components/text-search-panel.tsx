import { lazy, Suspense, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { FileSearchResult } from "@/features/file-search/lib/file-search-api";
import { TextSearchCode } from "./text-search-code";
import { TextSearchControls } from "./text-search-controls";
import type { ContentSearchOptions } from "../types/global-search.types";
import { useTranslation } from "@/i18n/locale-provider";
import { Button } from "@/ui/button";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/ui/resizable";
import { cn } from "@/utils/cn";
import { textSearchRows, type TextSearchRow } from "../utils/text-search-results";
import { useTextSearchPreferences } from "../stores/text-search-preferences.store";

const TextSearchPreview = lazy(() => import("./text-search-preview"));

interface TextSearchPanelProps {
  showControls?: boolean;
  options?: ContentSearchOptions;
  onOptionChange?: <Key extends keyof ContentSearchOptions>(
    key: Key,
    value: ContentSearchOptions[Key],
  ) => void;
  history?: string[];
  pinned?: boolean;
  onPinnedChange?: (value: boolean) => void;
  onFind?: (newTab: boolean) => void;
  onRetry?: () => void;
  query: string;
  results: FileSearchResult[];
  root: string | null;
  pending: boolean;
  error: string | null;
  availability: "ready" | "no-workspace" | "unsupported";
  focusRequest: number;
  hasMore: boolean;
  loadingMore: boolean;
  onQueryChange: (query: string) => void;
  onOpen: (row: TextSearchRow) => void;
  onLoadMore: () => void;
  readSource: (path: string) => Promise<string>;
}

export function TextSearchPanel({
  showControls = true,
  options = { caseSensitive: false, wholeWord: false, useRegex: false },
  onOptionChange = () => {},
  history = [],
  pinned = false,
  onPinnedChange = () => {},
  onFind,
  onRetry,
  query,
  results,
  root,
  pending,
  error,
  availability,
  focusRequest,
  hasMore,
  loadingMore,
  onQueryChange,
  onOpen,
  onLoadMore,
  readSource,
}: TextSearchPanelProps) {
  const { t } = useTranslation();
  const initialLayout = useRef(useTextSearchPreferences.getState().panelLayout).current;
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [multiline, setMultiline] = useState(query.includes("\n"));
  const [newTab, setNewTab] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [preview, setPreview] = useState<{ path: string; lines: string[]; failed: boolean } | null>(
    null,
  );
  const rows = useMemo(
    () => (pending || error ? [] : textSearchRows(results, root)),
    [pending, error, results, root],
  );
  const selected = rows[Math.min(selectedIndex, rows.length - 1)];
  const selectedPath = selected?.path;
  const selectedLine = selected?.match.line_number ?? 1;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [focusRequest]);

  useEffect(() => setSelectedIndex(0), [query, results]);

  useEffect(() => {
    listRef.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView?.({ block: "nearest" });
  }, [selected?.id]);

  useEffect(() => {
    if (!selectedPath) return;
    let disposed = false;
    void readSource(selectedPath).then(
      (source) => {
        if (!disposed)
          setPreview({ path: selectedPath, lines: source.split(/\r?\n/), failed: false });
      },
      () => {
        if (!disposed) setPreview({ path: selectedPath, lines: [], failed: true });
      },
    );
    return () => {
      disposed = true;
    };
  }, [readSource, selectedPath]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.nativeEvent.isComposing) return;
    if (event.ctrlKey && event.key === "Enter" && onFind && rows.length) {
      event.preventDefault();
      event.stopPropagation();
      onFind(newTab);
      return;
    }
    const multilineNavigation =
      event.ctrlKey && event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp");
    if (!multilineNavigation && (event.ctrlKey || event.metaKey || event.altKey)) return;
    if (event.target === inputRef.current && multiline && !multilineNavigation) return;
    if ((event.target as HTMLElement).closest("button")) return;
    if (!rows.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      setSelectedIndex(
        (index) => (index + (event.key === "ArrowDown" ? 1 : -1) + rows.length) % rows.length,
      );
    } else if (event.key === "Enter" && selected) {
      event.preventDefault();
      event.stopPropagation();
      onOpen(selected);
    }
  };
  const currentPreview = preview?.path === selectedPath ? preview : null;
  const status =
    availability !== "ready"
      ? t(availability === "no-workspace" ? "textSearch.noWorkspace" : "textSearch.unsupported")
      : !query.trim()
        ? t("textSearch.start")
        : pending
          ? t("textSearch.searching")
          : error
            ? t("textSearch.failed")
            : t("textSearch.count", {
                matches: `${rows.reduce((count, row) => count + Math.max(1, row.match.match_ranges?.length ?? 1), 0)}${hasMore ? "+" : ""}`,
                files: results.length,
              });

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={handleKeyDown}>
      <div className="shrink-0 space-y-2 px-4 pb-3 pt-2">
        {showControls && (
          <TextSearchControls
            query={query}
            onQueryChange={onQueryChange}
            options={options}
            onOptionChange={onOptionChange}
            inputRef={inputRef}
            multiline={multiline}
            onMultilineChange={setMultiline}
            history={history}
            pinned={pinned}
            onPinnedChange={onPinnedChange}
            activeDescendant={
              selected
                ? `text-search-result-${Math.min(selectedIndex, rows.length - 1)}`
                : undefined
            }
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 ui-text-sm text-subtle-foreground">
          <span className="rounded bg-selected px-2 py-1">In Project</span>
          <span role="status" aria-live="polite">
            {status}
          </span>
        </div>
      </div>
      <ResizablePanelGroup
        orientation="vertical"
        className="min-h-0 flex-1"
        defaultLayout={initialLayout}
        onLayoutChanged={(layout, meta) => {
          if (meta.isUserInteraction) useTextSearchPreferences.getState().setPanelLayout(layout);
        }}
      >
        <ResizablePanel id="results" defaultSize="55%" minSize="20%">
          <div
            ref={listRef}
            id="text-search-results"
            role="listbox"
            aria-label={t("textSearch.title")}
            aria-busy={pending}
            className="h-full min-h-0 overflow-auto border-y border-border py-1"
          >
            {rows.map((row, index) => (
              <div
                key={row.id}
                id={`text-search-result-${index}`}
                role="option"
                aria-selected={selected?.id === row.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setSelectedIndex(index)}
                onDoubleClick={() => onOpen(row)}
                className={cn(
                  "flex h-8 cursor-pointer items-center gap-4 px-4 ui-text-sm",
                  selected?.id === row.id ? "bg-selected" : "hover:bg-accent/50",
                )}
              >
                <span className="min-w-0 flex-1 truncate font-mono" title={row.match.line_content}>
                  <TextSearchCode
                    path={row.path}
                    content={row.match.line_content}
                    query={query}
                    options={options}
                    ranges={row.match.match_ranges}
                  />
                </span>
                <span
                  className="flex max-w-[48%] min-w-0 items-center gap-2 text-subtle-foreground"
                  title={`${row.displayPath}:${row.match.line_number}`}
                >
                  <span className="shrink-0">
                    {row.displayPath.split("/").pop()}:{row.match.line_number}
                  </span>
                  <span className="truncate">
                    {row.displayPath.slice(0, row.displayPath.lastIndexOf("/"))}
                  </span>
                </span>
              </div>
            ))}
            {!rows.length && (
              <div
                className="flex h-full min-h-24 items-center justify-center p-6 text-center ui-text-sm text-subtle-foreground"
                role={error ? "alert" : undefined}
              >
                {error ? (
                  <div>
                    <p>{t("textSearch.failed")}</p>
                    <p className="mt-2 break-all">{error}</p>
                    {onRetry && (
                      <Button size="sm" onClick={onRetry}>
                        {t("textSearch.retry")}
                      </Button>
                    )}
                  </div>
                ) : query.trim() && !pending && availability === "ready" ? (
                  t("search.noResultsFor", { query })
                ) : (
                  status
                )}
              </div>
            )}
            {hasMore && !pending && (
              <div className="p-2 text-center">
                <Button size="xs" variant="ghost" disabled={loadingMore} onClick={onLoadMore}>
                  {t(loadingMore ? "textSearch.searching" : "textSearch.more")}
                </Button>
              </div>
            )}
          </div>
        </ResizablePanel>
        <ResizableHandle
          className="cursor-ns-resize hover:bg-accent after:h-2"
          aria-label={t("textSearch.resizePreview")}
        />
        <ResizablePanel id="preview" defaultSize="45%" minSize="20%">
          <section
            aria-label={t("textSearch.preview")}
            className="flex h-full min-h-0 flex-col bg-surface/30"
          >
            <div
              className="shrink-0 truncate border-b border-border/60 px-4 py-2 ui-text-sm text-subtle-foreground"
              title={selected?.displayPath}
            >
              {selected ? `${selected.displayPath}:${selectedLine}` : t("textSearch.preview")}
            </div>
            <div className="min-h-0 flex-1 overflow-auto py-2 font-mono ui-text-sm">
              {selected && !currentPreview && (
                <p className="px-4 text-subtle-foreground">{t("textSearch.previewLoading")}</p>
              )}
              {currentPreview?.failed && (
                <p className="px-4 text-destructive" role="alert">
                  {t("textSearch.previewFailed")}
                </p>
              )}
              {selected && currentPreview && !currentPreview.failed && (
                <Suspense fallback={<p className="px-4">{t("textSearch.previewLoading")}</p>}>
                  <TextSearchPreview
                    path={selected.path}
                    content={currentPreview.lines.join("\n")}
                    query={query}
                    options={options}
                    line={selectedLine}
                    acceptedMatches={
                      results.find((file) => file.file_path === selected.path)?.matches
                    }
                  />
                </Suspense>
              )}
            </div>
          </section>
        </ResizablePanel>
      </ResizablePanelGroup>
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-2">
        {onFind && (
          <label className="flex items-center gap-2 ui-text-sm">
            <input
              type="checkbox"
              checked={newTab}
              onChange={(event) => setNewTab(event.target.checked)}
            />
            {t("textSearch.newTab")}
          </label>
        )}
        <span className="ui-text-xs text-subtle-foreground">
          {multiline ? "Ctrl+Alt+↑↓" : t("textSearch.hint")}
        </span>
        <Button size="sm" disabled={!selected} onClick={() => selected && onOpen(selected)}>
          {t("textSearch.open")}
        </Button>
        {onFind && (
          <Button
            size="sm"
            disabled={!rows.length || pending}
            onClick={() => onFind(newTab)}
            title="Ctrl+Enter"
          >
            {t("textSearch.findWindow")}
          </Button>
        )}
      </div>
    </div>
  );
}
