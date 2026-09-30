export interface FileItem {
  name: string;
  path: string;
  isDir: boolean;
}

export interface CategorizedFiles {
  openBufferFiles: FileItem[];
  recentFilesInResults: FileItem[];
  otherFiles: FileItem[];
}

export type FileCategory = "open" | "recent" | "other";

export interface TextSearchSnapshot {
  query: string;
  root: string | null;
  options: ContentSearchOptions;
  results: import("@/features/file-search/lib/file-search-api").FileSearchResult[];
  hasMore?: boolean;
  nextOffset?: number;
}

export interface SearchResult {
  file: FileItem;
  score: number;
}

export interface ContentSearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  useRegex: boolean;
  fileMask?: string;
  context?: "anywhere" | "comments" | "strings" | "except-comments" | "except-strings" | "code";
}
