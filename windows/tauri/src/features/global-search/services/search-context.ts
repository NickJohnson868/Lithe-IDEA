import { readFileContent } from "@/features/file-system/controllers/file-operations";
import type { SearchFilesResponse } from "@/features/file-search/lib/file-search-api";
import type { ContentSearchOptions } from "../types/global-search.types";
import { loadSearchExcerptTokens } from "./search-excerpt-syntax";

/** Syntax categories belong to the existing language tokenizer, not search heuristics. */
export async function filterSearchContext(
  response: SearchFilesResponse,
  context: ContentSearchOptions["context"],
  isCancelled: () => boolean,
): Promise<SearchFilesResponse> {
  if (!context || context === "anywhere") return response;
  const results: SearchFilesResponse["results"] = [];
  for (const file of response.results) {
    if (isCancelled()) return { ...response, results: [] };
    const source = (await readFileContent(file.file_path)).replace(/\r\n/g, "\n");
    const tokens = await loadSearchExcerptTokens(file.file_path, source);
    const lines = source.split("\n");
    const offsets = [0];
    for (const line of lines) offsets.push(offsets[offsets.length - 1]! + line.length + 1);
    const matches = file.matches.flatMap((match) => {
      const line = lines[match.line_number - 1] ?? "";
      const indentation = line.indexOf(match.line_content.split("\n")[0] ?? "");
      const base = (offsets[match.line_number - 1] ?? 0) + Math.max(0, indentation);
      const ranges = (
        match.match_ranges ?? [{ start: match.column_start, end: match.column_end }]
      ).filter((range) => {
        const token = tokens.find(
          (token) => token.start <= base + range.start && token.end >= base + range.end,
        );
        const comment = token?.class_name.includes("comment") ?? false;
        const string = token?.class_name.includes("string") ?? false;
        return context === "comments"
          ? comment
          : context === "strings"
            ? string
            : context === "except-comments"
              ? !comment
              : context === "except-strings"
                ? !string
                : !comment && !string;
      });
      return ranges.length
        ? [
            {
              ...match,
              match_ranges: ranges,
              column_start: ranges[0]!.start,
              column_end: ranges[0]!.end,
            },
          ]
        : [];
    });
    if (matches.length) results.push({ ...file, matches, total_matches: matches.length });
  }
  return { ...response, results, files_with_matches: results.length };
}
