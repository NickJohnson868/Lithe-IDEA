import { expect, test, mock } from "bun:test";
import { act, type ComponentProps, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { LocaleProvider } from "@/i18n/locale-provider";
import { installHappyDom } from "@/test-utils/happy-dom";
import { textSearchColumn } from "../utils/text-search-results";
mock.module("./text-search-preview", () => ({
  default: ({ content }: { content: string }) => <pre>{content}</pre>,
}));
// Geometry belongs to the browser integration; this suite controls search state.
mock.module("@/ui/resizable", () => ({
  ResizablePanelGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => <hr />,
}));
const { TextSearchPanel } = await import("./text-search-panel");

function deferred() {
  let resolve!: (value: string) => void;
  const promise = new Promise<string>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

test("text search supports keyboard selection, refocus and rejects stale previews", async () => {
  const restore = installHappyDom();
  const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previousActEnvironment = globals.IS_REACT_ACT_ENVIRONMENT;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const first = deferred();
  const second = deferred();
  const opened: string[] = [];
  const props: ComponentProps<typeof TextSearchPanel> = {
    query: "needle",
    root: "C:/workspace",
    pending: false,
    error: null,
    availability: "ready",
    focusRequest: 1,
    hasMore: false,
    loadingMore: false,
    results: ["first", "second"].map((name) => ({
      file_path: `C:/workspace/src/${name}.ts`,
      total_matches: 1,
      matches: [{ line_number: 1, line_content: `needle ${name}`, column_start: 0, column_end: 6 }],
    })),
    onQueryChange: () => {},
    onOpen: (row) => {
      opened.push(row.path);
    },
    onLoadMore: () => {},
    readSource: (path) => (path.endsWith("first.ts") ? first.promise : second.promise),
  };
  const render = async () => {
    await act(async () => {
      root.render(
        <LocaleProvider language="en-US">
          <TextSearchPanel {...props} />
        </LocaleProvider>,
      );
    });
  };
  try {
    await render();
    const input = container.querySelector("textarea")!;
    expect(document.activeElement === input).toBe(true);
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });
    await act(async () => {
      second.resolve("needle current preview");
    });
    expect(container.querySelector("section")?.textContent).toContain("current preview");
    await act(async () => {
      first.resolve("needle obsolete preview");
    });
    expect(container.querySelector("section")?.textContent).not.toContain("obsolete preview");
    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    expect(opened).toEqual(["C:/workspace/src/second.ts"]);
    container.querySelector("button")!.focus();
    props.focusRequest++;
    await render();
    expect(document.activeElement === input).toBe(true);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(props.query.length);
    props.pending = true;
    await render();
    expect(container.querySelectorAll('[role="option"]').length).toBe(0);
  } finally {
    first.resolve("");
    second.resolve("");
    await act(async () => {
      root.unmount();
    });
    container.remove();
    restore();
    globals.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  }
});

test("navigation resolves one-based columns against indented source and literal text", () => {
  expect(textSearchColumn("    return Spring.application;", "spring.")).toBe(12);
  expect(textSearchColumn("\t中文needle", "needle")).toBe(4);
  expect(textSearchColumn("removed match", "needle")).toBe(1);
});

test("search controls expose IDEA options, history, context, pin and find-window shortcut", async () => {
  const restore = installHappyDom();
  const globals = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previous = globals.IS_REACT_ACT_ENVIRONMENT;
  globals.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const changes: unknown[] = [];
  const finds: boolean[] = [];
  try {
    await act(async () =>
      root.render(
        <LocaleProvider language="en-US">
          <TextSearchPanel
            query="spring"
            root="C:/workspace"
            pending={false}
            error={null}
            availability="ready"
            focusRequest={1}
            hasMore={false}
            loadingMore={false}
            history={["previous"]}
            results={[
              {
                file_path: "C:/workspace/file.txt",
                total_matches: 1,
                matches: [
                  {
                    line_number: 1,
                    line_content: "Spring spring",
                    column_start: 0,
                    column_end: 6,
                    match_ranges: [
                      { start: 0, end: 6 },
                      { start: 7, end: 13 },
                    ],
                  },
                ],
              },
            ]}
            onQueryChange={(value) => changes.push(value)}
            onOptionChange={(key, value) => changes.push([key, value])}
            onPinnedChange={(value) => changes.push(["pin", value])}
            onFind={(value) => finds.push(value)}
            onOpen={() => {}}
            onLoadMore={() => {}}
            readSource={async () => "Spring spring"}
          />
        </LocaleProvider>,
      ),
    );
    const click = async (label: string) =>
      act(async () => (container.querySelector(`[aria-label="${label}"]`) as HTMLElement).click());
    await click("Match case");
    await click("Whole words");
    await click("Regular expression");
    await click("Keep this window open");
    expect(changes).toEqual([
      ["caseSensitive", true],
      ["wholeWord", true],
      ["useRegex", true],
      ["pin", true],
    ]);
    await click("Search context");
    const comments = [...container.querySelectorAll("label")]
      .find((label) => label.textContent === "In comments")!
      .querySelector("input")!;
    await act(async () => comments.click());
    expect(changes[changes.length - 1]).toEqual(["context", "comments"]);
    await click("Search history");
    await act(async () =>
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "previous")!
        .click(),
    );
    expect(changes[changes.length - 1]).toBe("previous");
    const newTab = [...container.querySelectorAll("label")]
      .find((label) => label.textContent === "Open results in new tab")!
      .querySelector("input")!;
    await act(async () => newTab.click());
    await act(async () =>
      container
        .querySelector("textarea")!
        .dispatchEvent(
          new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }),
        ),
    );
    expect(finds).toEqual([true]);
    expect(container.querySelector('[role="status"]')?.textContent).toContain("2");
    expect(container.querySelectorAll('[role="option"] [style*="background-color"]').length).toBe(
      2,
    );
  } finally {
    await act(async () => root.unmount());
    container.remove();
    restore();
    globals.IS_REACT_ACT_ENVIRONMENT = previous;
  }
});
