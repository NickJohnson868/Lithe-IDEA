import { useMemo } from "react";
import { buildSearchRegex, findAllMatches } from "@/features/editor/utils/search";
import type { SearchMatchRange } from "@/features/file-search/lib/file-search-api";
import { cn } from "@/utils/cn";
import { useSearchExcerptTokens } from "../hooks/use-search-excerpt-tokens";
import type { ContentSearchOptions } from "../types/global-search.types";
import { buildSearchExcerptRenderLines } from "../utils/search-excerpt-lines";

export function TextSearchCode({
  path,
  content,
  query,
  options,
  ranges,
  preview = false,
  startLine = 1,
  selectedLine,
}: {
  path: string;
  content: string;
  query: string;
  options: ContentSearchOptions;
  ranges?: SearchMatchRange[];
  preview?: boolean;
  startLine?: number;
  selectedLine?: number;
}) {
  const tokens = useSearchExcerptTokens({ filePath: path, content, enabled: true });
  const lines = useMemo(() => {
    const regex = buildSearchRegex(query, options);
    const highlights = (ranges ?? (regex ? findAllMatches(content, regex, 10_000) : [])).map(
      (range, index) => ({ ...range, itemKey: String(index) }),
    );
    return buildSearchExcerptRenderLines(content, tokens, highlights);
  }, [content, options, query, ranges, tokens]);
  return (
    <>
      {lines.map((line, index) => (
        <span
          key={index}
          data-preview-line={preview ? startLine + index : undefined}
          className={cn(
            preview ? "flex min-w-max leading-6" : "inline",
            preview && startLine + index === selectedLine && "bg-selected/50",
          )}
        >
          {preview && (
            <span className="w-12 shrink-0 select-none border-r border-border pr-3 text-right text-subtle-foreground">
              {startLine + index}
            </span>
          )}
          <span className={preview ? "whitespace-pre px-4" : "whitespace-pre"}>
            {line.segments.map((segment) => (
              <span
                key={segment.startColumn}
                className={segment.tokenClassName}
                style={
                  segment.highlightIndexes.length
                    ? {
                        backgroundColor: preview ? "#365d48" : "#ba9849",
                        color: preview ? undefined : "#101010",
                        borderRadius: preview ? 0 : 3,
                      }
                    : undefined
                }
              >
                {segment.text}
              </span>
            ))}
            {!line.text && "\u00a0"}
          </span>
          {!preview && index < lines.length - 1 && " ↵ "}
        </span>
      ))}
    </>
  );
}
