import { expect, mock, test } from "bun:test";
import type * as Monaco from "monaco-editor";
// Monaco's browser-free URI module ships without a TypeScript declaration.
// @ts-expect-error upstream internal module has no declaration
import { URI } from "monaco-editor/esm/vs/base/common/uri.js";

let provider!: Monaco.languages.DefinitionProvider;
const locations = [
  {
    uri: "file:///C:/project/Target.java",
    range: { start: { line: 7, character: 2 }, end: { line: 7, character: 9 } },
  },
  {
    uri: "jdt://contents/library.jar/Type.class?entry=Type",
    range: { start: { line: 12, character: 4 }, end: { line: 12, character: 8 } },
  },
];
const synchronizeDocument = mock(async () => undefined);
const getDefinition = mock(async () => locations);
mock.module("monaco-editor", () => ({
  Uri: URI,
  Range: class {
    constructor(
      public startLineNumber: number,
      public startColumn: number,
      public endLineNumber: number,
      public endColumn: number,
    ) {}
  },
  Emitter: class {
    event = () => ({ dispose() {} });
    fire() {}
  },
  editor: { registerEditorOpener: () => ({ dispose() {} }) },
  languages: new Proxy(
    {},
    {
      get: (_target, name) =>
        name === "registerDefinitionProvider"
          ? (_selector: unknown, value: Monaco.languages.DefinitionProvider) => {
              provider = value;
            }
          : () => ({ dispose() {} }),
    },
  ),
}));
mock.module(
  "monaco-editor/esm/vs/editor/contrib/gotoSymbol/browser/link/goToDefinitionAtPosition.js",
  () => ({}),
);
const tauriEvents = await import("@tauri-apps/api/event");
mock.module("@tauri-apps/api/event", () => ({ ...tauriEvents, listen: async () => () => {} }));
mock.module("@/features/editor/lsp/lsp-client", () => ({
  isDocumentFeatureAvailable: () => true,
  LspClient: {
    getInstance: () => ({
      getDocumentAvailability: () => ({ phase: "ready" }),
      synchronizeDocument,
      getDefinition,
    }),
  },
}));
mock.module("@/features/editor/stores/buffer.store", () => ({
  useBufferStore: {
    getState: () => ({
      buffers: [{ id: "source", type: "editor", path: "C:/project/Source.java", language: "java" }],
    }),
  },
}));
mock.module("@/features/editor/lsp/stores/lsp.store", () => ({
  useLspStore: { subscribe: () => () => {} },
}));
mock.module("@/features/editor/lsp/built-in-language-support", () => ({
  isEditorLspSupported: () => true,
  languageIdForEditorFile: () => "java",
}));
mock.module("./semantic-token-provider", () => ({ createMonacoSemanticTokenProvider: () => ({}) }));
mock.module("./language", () => ({ MONACO_HIGHLIGHT_LANGUAGE_IDS: new Set(["java"]) }));
mock.module("@lithe/editor/completion-kind", () => ({ mapCompletionKind: () => 0 }));
const { registerMonacoLspProviders } = await import("./lsp-providers");
registerMonacoLspProviders();

test("Monaco definition navigation preserves physical and decompiled targets instead of pointing to the source", async () => {
  const model = {
    uri: URI.file("C:/project/Source.java"),
    getValue: () => " target()",
    getWordAtPosition: () => ({ startColumn: 2, endColumn: 8 }),
  } as unknown as Monaco.editor.ITextModel;
  const result = await provider.provideDefinition(
    model,
    { lineNumber: 1, column: 8 } as Monaco.Position,
    { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() {} }) },
  );
  expect(getDefinition).toHaveBeenCalledWith(
    expect.objectContaining({ filePath: "C:/project/Source.java" }),
    0,
    6,
  );
  expect(synchronizeDocument).toHaveBeenCalledWith("C:/project/Source.java", " target()");
  const targets = result as Monaco.languages.Location[];
  expect(targets.map((location) => location.uri.toString())).toEqual(
    locations.map((location) => URI.parse(location.uri).toString()),
  );
  expect(targets[0]!.range).toMatchObject({
    startLineNumber: 8,
    startColumn: 3,
    endLineNumber: 8,
    endColumn: 10,
  });
  expect(targets[1]!.range).toMatchObject({ startLineNumber: 13, startColumn: 5 });
});
