import { useEffect, useRef } from "react";
import { editor, Uri, Range } from "monaco-editor";
import { ensureMonacoLanguageTokenizer } from "@/features/editor/engines/monaco/language-contributions";
import { toMonacoLanguageId } from "@/features/editor/engines/monaco/language";
import { defineMonacoTheme } from "@/features/editor/engines/monaco/theme";
import { getLanguageIdFromPath } from "@/features/editor/utils/language-id";
import { useSettingsStore } from "@/features/settings/stores/settings.store";
import type { SearchMatch } from "@/features/file-search/lib/file-search-api";
import { textSearchMatchColumn } from "../utils/text-search-results";
import type { ContentSearchOptions } from "../types/global-search.types";

/** A private, virtualized read-only model; it never acquires an LSP document. */
export default function TextSearchPreview({
  path,
  content,
  query,
  options,
  line,
  acceptedMatches,
}: {
  path: string;
  content: string;
  query: string;
  options: ContentSearchOptions;
  line: number;
  acceptedMatches?: SearchMatch[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<editor.IStandaloneCodeEditor | null>(null);
  const theme = useSettingsStore((state) => state.settings.theme);
  useEffect(() => {
    if (!container.current) return;
    const language = toMonacoLanguageId(getLanguageIdFromPath(path));
    const model = editor.createModel(
      content,
      language,
      Uri.parse(`lithe-search-preview:///${crypto.randomUUID()}`),
    );
    const surface = editor.create(container.current, {
      model,
      readOnly: true,
      domReadOnly: true,
      automaticLayout: true,
      minimap: { enabled: false },
      lineNumbers: "on",
      scrollBeyondLastLine: false,
      fontSize: 13,
      lineHeight: 22,
      renderLineHighlight: "all",
      folding: false,
      glyphMargin: false,
      overviewRulerLanes: 0,
      occurrencesHighlight: "off",
      selectionHighlight: false,
      contextmenu: false,
      hover: { enabled: false },
      links: false,
      codeLens: false,
      stickyScroll: { enabled: false },
      theme: defineMonacoTheme(theme, true),
      ariaLabel: "Search source preview",
    });
    instance.current = surface;
    let disposed = false;
    void ensureMonacoLanguageTokenizer(language)
      .then(() => {
        if (!disposed) editor.setModelLanguage(model, language);
      })
      .catch((error) => console.warn("Search preview tokenizer failed", error));
    return () => {
      disposed = true;
      instance.current = null;
      surface.dispose();
      model.dispose();
    };
  }, [path, content, theme]);
  useEffect(() => {
    const surface = instance.current;
    const model = surface?.getModel();
    if (!surface || !model) return;
    let matches: Array<{ range: Range }> = query
      ? model.findMatches(
          query,
          false,
          options.useRegex,
          options.caseSensitive,
          options.wholeWord ? "`~!@#$%^&*()-=+[{]}\\|;:'\",.<>/? " : null,
          false,
          10_000,
        )
      : [];
    if (options.context && options.context !== "anywhere" && acceptedMatches) {
      matches = acceptedMatches.flatMap((match) => {
        const indentation =
          textSearchMatchColumn(model.getLineContent(match.line_number), {
            ...match,
            column_start: 0,
          }) - 1;
        const base = model.getOffsetAt({ lineNumber: match.line_number, column: indentation + 1 });
        return (match.match_ranges ?? []).map((range) => {
          const start = model.getPositionAt(base + range.start);
          const end = model.getPositionAt(base + range.end);
          return {
            range: new Range(start.lineNumber, start.column, end.lineNumber, end.column),
            matches: null,
          };
        });
      });
    }
    const decorations = surface.createDecorationsCollection(
      matches.map((match) => ({
        range: match.range,
        options: { inlineClassName: "lithe-search-preview-match" },
      })),
    );
    surface.setPosition({ lineNumber: line, column: 1 });
    surface.revealLineInCenter(line);
    return () => decorations.clear();
  }, [path, content, theme, query, options, line, acceptedMatches]);
  return (
    <div className="h-full min-h-0" ref={container}>
      <style>{`.lithe-search-preview-match { background: #365d48; }`}</style>
    </div>
  );
}
