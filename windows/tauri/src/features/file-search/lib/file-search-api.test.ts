import { expect, spyOn, test } from "bun:test";
import * as coreClient from "@/core/lithe-core-client";
import { DEFAULT_HIDDEN_DIRECTORY_PATTERNS } from "@/features/settings/config/default-settings";
import { searchFilesContent } from "./file-search-api";

test("content search reserves the Core result budget for text and excludes IDE metadata", async () => {
  const execute = spyOn(coreClient, "executeCore").mockResolvedValue({
    id: null,
    ok: true,
    data: { matches: [{ kind: "content", path: "src/app.ts", line: 8, preview: "needle" }] },
  });
  // Bun can reuse a spy installed by an earlier LSP suite; this request owns
  // its call history as well as its mock implementation.
  execute.mockClear();
  try {
    const response = await searchFilesContent({
      root_paths: ["C:/workspace"],
      query: "needle",
      max_results: 140,
    });
    expect(execute.mock.calls[0][0]).toMatchObject({
      command: "workspace.search",
      payload: {
        root: "C:/workspace",
        query: "needle",
        maxFileResults: 0,
        maxResults: 141,
        hiddenDirectoryNames: [...DEFAULT_HIDDEN_DIRECTORY_PATTERNS, ".lithe"],
        regularExpression: false,
      },
    });
    expect(response.results[0].file_path.replace(/\\/g, "/")).toBe("C:/workspace/src/app.ts");
    expect(response.results[0]).toMatchObject({
      matches: [{ line_number: 8, line_content: "needle", column_start: 0, column_end: 6 }],
    });
  } finally {
    execute.mockRestore();
  }
});

test("content pagination neither skips same-file rows nor duplicates its sentinel", async () => {
  const matches = Array.from({ length: 5 }, (_, index) => ({
    kind: "content", path: "src/app.ts", line: index + 1, preview: "needle NEEDLE",
  }));
  const execute = spyOn(coreClient, "executeCore").mockImplementation(async (request) => ({
    id: null, ok: true,
    data: { matches: matches.slice(0, (request.payload as { maxResults: number }).maxResults) },
  }) as never);
  try {
    const first = await searchFilesContent({ root_paths: ["C:/workspace"], query: "needle", max_results: 2 });
    expect(first.results[0].matches.map((match) => match.line_number)).toEqual([1, 2]);
    expect(first.results[0].matches[0].match_ranges).toEqual([{ start: 0, end: 6 }, { start: 7, end: 13 }]);
    expect(first.has_more).toBe(true);
    const second = await searchFilesContent({ root_paths: ["C:/workspace"], query: "needle", max_results: 2, file_offset: first.next_file_offset });
    expect(second.results[0].matches.map((match) => match.line_number)).toEqual([3, 4]);
    const last = await searchFilesContent({ root_paths: ["C:/workspace"], query: "needle", max_results: 2, file_offset: second.next_file_offset });
    expect(last.results[0].matches.map((match) => match.line_number)).toEqual([5]);
    expect(last.has_more).toBe(false);
  } finally { execute.mockRestore(); }
});
