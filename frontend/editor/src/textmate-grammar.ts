import { Registry, INITIAL, parseRawGrammar } from "vscode-textmate";
import { loadWASM, OnigScanner, OnigString } from "vscode-oniguruma";

export { INITIAL };
export async function createJavaGrammar(wasm: ArrayBuffer, grammarText: string) {
  await loadWASM(wasm);
  const registry = new Registry({
    onigLib: Promise.resolve({ createOnigScanner: (sources: string[]) => new OnigScanner(sources), createOnigString: (text: string) => new OnigString(text) }),
    loadGrammar: async (scope) => scope === "source.java" ? parseRawGrammar(grammarText, "java.tmLanguage.json") : null,
  });
  const grammar = await registry.loadGrammar("source.java");
  if (!grammar) throw new Error("Java TextMate grammar failed to load");
  return { registry, grammar };
}

// Map TextMate's scope stack to the same token theme used by Monaco's lexical
// and semantic layers, rather than installing a competing global color map.
export function tokenRole(scopes: string[]): string {
  // Nested punctuation and tag scopes must retain their enclosing comment or
  // string role. Java annotations are storage scopes, not orange keywords.
  if (scopes.some((scope) => /^comment\.block\.javadoc\b/.test(scope))) {
    if (scopes.some((scope) => /^keyword\.other\.documentation\b/.test(scope))) {
      return "comment.documentation.tag";
    }
    if (scopes.some((scope) => /^(variable\.parameter|entity\.name\.type)\b/.test(scope))) {
      return "comment.documentation.value";
    }
    return "comment.documentation";
  }
  if (scopes.some((scope) => /^comment\b/.test(scope))) return "comment";
  if (scopes.some((scope) => /^string\b/.test(scope))) {
    return scopes.some((scope) => /^constant\.character\.escape\b/.test(scope))
      ? "string.escape" : "string";
  }
  for (let i = scopes.length - 1; i >= 0; i--) {
    const scope = scopes[i];
    if (/^(storage\.type\.annotation|punctuation\.definition\.annotation)\.java$/.test(scope)) {
      return "annotation";
    }
    if (/^keyword\.operator\b/.test(scope)) {
      return /^keyword\.operator\.(new|instanceof)\b/.test(scope) ? "keyword" : "operator";
    }
    if (/^comment/.test(scope)) return "comment";
    if (/^string/.test(scope)) return "string";
    if (/^constant.numeric/.test(scope)) return "number";
    if (/^constant.language/.test(scope)) return "keyword";
    if (/^(keyword|storage)/.test(scope)) return "keyword";
    if (/^entity.name.(type|class|namespace)|^support.(class|type)/.test(scope)) return "type.identifier";
    if (/^entity.name.function/.test(scope)) return "function";
    if (/^variable/.test(scope)) return "variable";
    if (/^punctuation/.test(scope)) return "delimiter";
  }
  return "";
}
