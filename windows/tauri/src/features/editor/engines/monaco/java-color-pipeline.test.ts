import { afterAll, beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createJavaGrammar, INITIAL, tokenRole } from "@lithe/editor/textmate-grammar";
import { toMonacoSemanticTokenType } from "@lithe/editor/semantic-tokens";
import litheThemes from "@/extensions/themes/builtin/lithe.json";
import { toThemeDefinition } from "@/extensions/themes/theme-file";
import type { Theme } from "@/extensions/themes/theme-schema";
import { createMonacoTokenThemeRules } from "./token-theme-rules";

// Exercise Monaco's installed rule matcher as well as the shipped grammar:
// checking palette JSON alone misses a scope mapped to the wrong color role.
const matcherModule = "monaco-editor/esm/vs/editor/common/languages/supports/tokenization.js";
const { TokenTheme } = await import(matcherModule);
const theme = toThemeDefinition(litheThemes.themes.find((theme) => theme.id === "lithe-dark")! as Theme);
const matcher = TokenTheme.createFromRawTokenTheme([
  { token: "", foreground: "BCBEC4", background: "191A1C" },
  ...createMonacoTokenThemeRules(theme, false),
], []);
let resources: Awaited<ReturnType<typeof createJavaGrammar>>;

beforeAll(async () => {
  const wasm = readFileSync(new URL("../../../../../../../frontend/editor/node_modules/vscode-oniguruma/release/onig.wasm", import.meta.url));
  const grammar = readFileSync(new URL("../../../../../../../frontend/editor/vendor/java.tmLanguage.json", import.meta.url), "utf8");
  resources = await createJavaGrammar(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength), grammar);
});
afterAll(() => resources?.registry.dispose());

function colorForRole(role: string): string {
  return matcher.getColorMap()[(matcher._match(role).metadata >>> 15) & 0x1ff].toString().replace(/^#/, "").toUpperCase();
}

test("shipped Java grammar renders annotation names and markers yellow, assignments white, and strings green", () => {
  const line = '@Schema(name = "Demo", description = "说明")';
  const result = resources.grammar.tokenizeLine(line, INITIAL);
  const colorAt = (column: number) => {
    const token = result.tokens.find((token) => token.startIndex <= column && token.endIndex > column)!;
    return colorForRole(tokenRole(token.scopes));
  };
  expect(colorAt(line.indexOf("@"))).toBe("B3AE60");
  expect(colorAt(line.indexOf("Schema"))).toBe("B3AE60");
  expect(colorAt(line.indexOf("="))).toBe("BCBEC4");
  expect(colorAt(line.indexOf("Demo"))).toBe("6AAB73");
});

test("shipped Java grammar keeps Javadoc prose green and ordinary line comments gray", () => {
  const opening = resources.grammar.tokenizeLine("/**", INITIAL);
  const prose = resources.grammar.tokenizeLine(" * 当前成员可访问门店查询条件。", opening.ruleStack);
  const token = prose.tokens.find((token) => token.endIndex > 5)!;
  expect(colorForRole(tokenRole(token.scopes))).toBe("5F826B");
  const lineComment = resources.grammar.tokenizeLine("// 可选的逻辑门店主键", INITIAL);
  for (const token of lineComment.tokens) expect(colorForRole(tokenRole(token.scopes))).toBe("7A7E85");
});

test("JDT annotation members and record components retain their distinct IDEA color roles", () => {
  expect(toMonacoSemanticTokenType("annotationMember")).toBe(toMonacoSemanticTokenType("variable"));
  expect(toMonacoSemanticTokenType("record")).toBe(toMonacoSemanticTokenType("class"));
  expect(toMonacoSemanticTokenType("recordComponent")).toBe(toMonacoSemanticTokenType("property"));
  expect(colorForRole("property")).toBe("C77DBB");
  expect(colorForRole("method")).toBe("57AAF7");
  expect(colorForRole("class")).toBe("BCBEC4");
});
