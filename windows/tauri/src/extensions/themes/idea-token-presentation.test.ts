import { expect, test } from "bun:test";
import {
  encodeMonacoSemanticTokens,
  MONACO_SEMANTIC_TOKEN_MODIFIERS,
} from "@lithe/editor/semantic-tokens";
import { createMonacoTokenStyleRules } from "@lithe/editor/token-theme-roles";
import { normalizeSyntaxColors } from "./syntax-token-colors";

test("explicit IDEA identifier colors survive fallback normalization", () => {
  const palette = normalizeSyntaxColors(
    { type: "#BCBEC4", variable: "#BCBEC4", "function.call": "#BCBEC4" },
    { foreground: "#BCBEC4" },
    "dark",
  );
  expect(palette.type).toBe("#BCBEC4");
  expect(palette.variable).toBe("#BCBEC4");
  expect(palette["function.call"]).toBe("#BCBEC4");
  expect(palette.keyword).toBeDefined();
});

test("JDTLS static modifiers map from the server legend without shifting old bits", () => {
  const data = encodeMonacoSemanticTokens(
    {
      tokenTypes: ["field"],
      tokenModifiers: ["static", "readonly", "deprecated", "unknown"],
      tokens: [{ line: 0, startChar: 0, length: 4, tokenType: 0, tokenModifiers: 15 }],
    },
    { getLineCount: () => 1, getLineMaxColumn: () => 8 },
  );
  expect(MONACO_SEMANTIC_TOKEN_MODIFIERS.slice(0, 3)).toEqual(["readonly", "deprecated", "static"]);
  expect([...data]).toEqual([0, 0, 4, 9, 7]);
});

test("IDEA static member italics preserve deprecation and remain theme opt-in", () => {
  const rules = createMonacoTokenStyleRules(false, true);
  expect(rules.find((rule) => rule.token === "property.static")?.fontStyle).toBe("italic");
  expect(rules.find((rule) => rule.token === "method.readonly.deprecated.static")?.fontStyle).toBe(
    "italic strikethrough",
  );
  expect(createMonacoTokenStyleRules(false).some((rule) => rule.token.endsWith(".static"))).toBe(
    false,
  );
});
