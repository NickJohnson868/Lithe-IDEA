import type { FileSearchResult, SearchMatch } from "@/features/file-search/lib/file-search-api";
import { getRelativePath } from "@/utils/path-helpers";
import { buildSearchRegex } from "@/features/editor/utils/search";
import type { ContentSearchOptions } from "../types/global-search.types";

export interface TextSearchRow {
  id: string;
  path: string;
  displayPath: string;
  match: SearchMatch;
}

export function textSearchMatchColumn(sourceLine: string, match: SearchMatch): number {
  const previewLine = match.line_content.split("\n")[0] ?? "";
  const indentation = Math.max(0, sourceLine.indexOf(previewLine));
  return indentation + match.column_start + 1;
}

export function textSearchRows(results: FileSearchResult[], root: string | null): TextSearchRow[] {
  return results.flatMap((file) =>
    file.matches.map((match, index) => ({
      id: `${file.file_path}:${match.line_number}:${index}`,
      path: file.file_path,
      displayPath: getRelativePath(file.file_path, root).replace(/\\/g, "/"),
      match,
    })),
  );
}

export function textSearchColumn(
  sourceLine: string,
  query: string,
  options: ContentSearchOptions = { caseSensitive: false, wholeWord: false, useRegex: false },
): number {
  // Core's search preview trims indentation. Resolve the editor column from
  // the actual source rather than treating the preview offset as a file offset.
  const index =
    buildSearchRegex(query.split("\n")[0] ?? query, options)?.exec(sourceLine)?.index ?? -1;
  return index < 0 ? 1 : index + 1;
}
