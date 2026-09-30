import { expect, test } from "bun:test";
import { migrateIdeaEditorDefaults } from "./idea-appearance-migration";

test("IDEA editor defaults migrate the complete legacy preset once", () => {
  const migrated = migrateIdeaEditorDefaults({
    theme: "lithe-dark",
    fontFamily: "Geist Mono",
    fontSize: 14,
    editorFontLigatures: false,
  });
  expect(migrated.fontFamily).toBe("Ubuntu Mono");
  expect(migrated.fontSize).toBe(17);
  expect(migrated.editorFontLigatures).toBe(true);
  expect(migrateIdeaEditorDefaults(migrated)).toBe(migrated);
});

test("IDEA migration retains a customized font or another theme", () => {
  for (const overrides of [
    { fontFamily: "Consolas" },
    { fontSize: 18 },
    { theme: "lithe-light" },
    { editorFontLigatures: true },
  ]) {
    const settings = {
      theme: "lithe-dark",
      fontFamily: "Geist Mono",
      fontSize: 14,
      editorFontLigatures: false,
      ...overrides,
    };
    expect(migrateIdeaEditorDefaults(settings)).toBe(settings);
  }
});
