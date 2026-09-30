import { afterEach, expect, mock, test } from "bun:test";
import type * as Monaco from "monaco-editor";
import type { ThemeDefinition } from "@/extensions/themes/theme.types";
import { themeRegistry } from "@/extensions/themes/theme-registry";

const defineTheme = mock((_id: string, _data: Monaco.editor.IStandaloneThemeData) => {});
mock.module("monaco-editor", () => ({ editor: { defineTheme } }));
const { defineMonacoTheme } = await import("./theme");
const id = "test-diff-theme";
const theme: ThemeDefinition = {
  id, name: "Test", description: "", category: "Dark", isDark: true,
  cssVariables: { "--background": "#191A1C" },
};
afterEach(() => { themeRegistry.unregisterTheme(id); defineTheme.mockClear(); });

test("opening many diff editors does not invalidate the same global theme repeatedly", () => {
  themeRegistry.registerTheme(theme);
  for (let index = 0; index < 100; index++) defineMonacoTheme(id);
  expect(defineTheme).toHaveBeenCalledTimes(1);
  defineMonacoTheme(id, true);
  expect(defineTheme).toHaveBeenCalledTimes(2);
  themeRegistry.registerTheme({ ...theme, cssVariables: { "--background": "#202020" } });
  defineMonacoTheme(id);
  expect(defineTheme).toHaveBeenCalledTimes(3);
  expect(defineTheme.mock.calls[2][1].colors["editor.background"]).toBe("#202020");
  const replacement = themeRegistry.getTheme(id)!;
  replacement.cssVariables["--background"] = "#303030";
  themeRegistry.registerTheme(replacement);
  defineMonacoTheme(id);
  expect(defineTheme.mock.calls[3][1].colors["editor.background"]).toBe("#303030");
});
