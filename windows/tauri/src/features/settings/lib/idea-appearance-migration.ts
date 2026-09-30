import type { Settings } from "../types/settings.types";
import { DEFAULT_CODE_FONT_SIZE, DEFAULT_MONO_FONT_FAMILY } from "../config/typography-defaults";

/** Upgrade the old untouched editor preset while retaining customized settings. */
export function migrateIdeaEditorDefaults(settings: Settings): Settings;
export function migrateIdeaEditorDefaults(settings: Partial<Settings>): Partial<Settings>;
export function migrateIdeaEditorDefaults(settings: Partial<Settings>): Partial<Settings> {
  if (
    settings.theme !== "lithe-dark" ||
    settings.fontFamily !== "Geist Mono" ||
    settings.fontSize !== 14 ||
    settings.editorFontLigatures !== false
  )
    return settings;
  return {
    ...settings,
    fontFamily: DEFAULT_MONO_FONT_FAMILY,
    fontSize: DEFAULT_CODE_FONT_SIZE,
    editorFontLigatures: true,
    showMinimap: false,
  };
}
