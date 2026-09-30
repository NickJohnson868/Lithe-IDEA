import type { Settings } from "@/features/settings/types/settings.types";
import { defaultKeymaps } from "./default-keymaps";
import type { Keybinding } from "../types/keymaps.types";

export type KeybindingPreset = Settings["keybindingPreset"];

export interface KeybindingPresetDefinition {
  label: string;
  description: string;
  overrides: Keybinding[];
  disabledCommands: string[];
}

export interface KeybindingPresetCoverageReport {
  coveredCommandIds: string[];
  missingCommandIds: string[];
  totalCommandCount: number;
  isComplete: boolean;
}

export interface KeybindingPresetDiffReport {
  changedCommandIds: string[];
  unchangedCommandIds: string[];
}

const defaultPresetBindings = new Map<string, Keybinding>();

for (const binding of defaultKeymaps) {
  if (!defaultPresetBindings.has(binding.command)) {
    defaultPresetBindings.set(binding.command, { ...binding, source: "preset" });
  }
}

const defaultPresetCommandIds = [...defaultPresetBindings.keys()];

function createPresetDefinition({
  label,
  description,
  overrides = [],
  disabledCommands = [],
}: {
  label: string;
  description: string;
  overrides?: Keybinding[];
  disabledCommands?: string[];
}): KeybindingPresetDefinition {
  const overrideCommands = new Set(overrides.map((binding) => binding.command));
  const disabledCommandIds = new Set(disabledCommands);

  return {
    label,
    description,
    overrides: overrides.map((binding) => ({
        ...defaultPresetBindings.get(binding.command),
        ...binding,
        source: "preset" as const,
      })).concat(defaultKeymaps
        .filter((binding) => !disabledCommandIds.has(binding.command) && !overrideCommands.has(binding.command))
        .map((binding) => ({ ...binding, source: "preset" as const }))),
    disabledCommands,
  };
}

export const keybindingPresetDefinitions: Record<KeybindingPreset, KeybindingPresetDefinition> = {
  none: {
    label: "None",
    description: "Use Lithe built-in shortcuts.",
    overrides: [],
    disabledCommands: [],
  },
  vscode: createPresetDefinition({
    label: "VS Code",
    description: "Match common VS Code shortcuts.",
    overrides: [
      { key: "cmd+n", command: "file.new", source: "preset" },
      { key: "ctrl+g", command: "editor.goToLine", source: "preset" },
      { key: "cmd+alt+f", command: "workbench.showFindReplace", source: "preset" },
      { key: "cmd+shift+m", command: "workbench.toggleDiagnostics", source: "preset" },
      { key: "cmd+b", command: "workbench.toggleActivitySidebar", source: "preset" },
    ],
  }),
  jetbrains: createPresetDefinition({
    label: "IntelliJ IDEA",
    description: "Use common IntelliJ IDEA Windows shortcuts.",
    disabledCommands: [
      "workbench.newWindow",
      "workbench.newTab",
      "workbench.toggleActivitySidebar",
      "workbench.toggleSidebar",
      "file.save",
      "file.reopenClosed",
      "editor.copyLineUp",
      "editor.copyLineDown",
      "editor.insertCursorAbove",
      "editor.insertCursorBelow",
      "editor.inlineEdit",
      "workbench.toggleAIChat",
      "workbench.toggleMinimap",
      "window.quit",
      "window.minimize.alt",
      "window.maximize",
      "workbench.nextTabAlt",
      "workbench.previousTabAlt",
      "workbench.showThemeSelector",
      "workbench.openKeyboardShortcuts",
      ...Array.from({ length: 7 }, (_, index) => `editor.foldLevel${index + 1}`),
    ],
    overrides: [
      { key: "cmd+k", command: "git.commit", source: "preset" },
      { key: "cmd+shift+k", command: "git.push", source: "preset" },
      { key: "cmd+t", command: "git.update", source: "preset" },
      { key: "cmd+alt+n", command: "git.newBranch", when: "!editorFocus && !terminalFocus", source: "preset" },
      { key: "cmd+shift+a", command: "workbench.commandPalette", source: "preset" },
      { key: "cmd+shift+n", command: "file.quickOpen", source: "preset" },
      { key: "cmd+e", command: "file.quickOpen", source: "preset" },
      { key: "cmd+g", command: "editor.goToLine", source: "preset" },
      { key: "alt+1", command: "workbench.showFileExplorer", source: "preset" },
      { key: "alt+0", command: "workbench.showSourceControl", source: "preset" },
      { key: "cmd+b", command: "editor.goToDefinition", source: "preset" },
      { key: "cmd+alt+b", command: "editor.goToImplementation", source: "preset" },
      { key: "cmd+shift+b", command: "editor.goToTypeDefinition", when: "editorFocus", source: "preset" },
      { key: "cmd+u", command: "editor.goToSuperMethod", when: "editorFocus", source: "preset" },
      { key: "alt+F7", command: "editor.goToReferences", source: "preset" },
      { key: "cmd+alt+F7", command: "editor.goToReferences", source: "preset" },
      { key: "shift+F6", command: "editor.renameSymbol", when: "editorFocus", source: "preset" },
      { key: "cmd+F12", command: "editor.showOutline", when: "editorFocus", source: "preset" },
      { key: "alt+7", command: "workbench.showOutline", source: "preset" },
      { key: "cmd+alt+s", command: "workbench.openSettings", source: "preset" },
      { key: "cmd+s", command: "file.saveAll", when: "!terminalFocus", source: "preset" },
      { key: "cmd+F4", command: "file.close", source: "preset" },
      { key: "cmd+w", command: "editor.expandSelection", source: "preset" },
      { key: "cmd+shift+w", command: "editor.shrinkSelection", source: "preset" },
      { key: "cmd+d", command: "editor.duplicateLine", when: "editorFocus", source: "preset" },
      { key: "cmd+y", command: "editor.deleteLine", source: "preset" },
      { key: "cmd+shift+z", command: "editor.redo", source: "preset" },
      { key: "alt+j", command: "editor.selectNextOccurrence", source: "preset" },
      { key: "cmd+alt+shift+j", command: "editor.selectAllOccurrences", source: "preset" },
      { key: "alt+shift+g", command: "editor.insertCursorsAtLineEnds", source: "preset" },
      { key: "alt+shift+up", command: "editor.moveLineUp", source: "preset" },
      { key: "alt+shift+down", command: "editor.moveLineDown", source: "preset" },
      { key: "cmd+alt+l", command: "editor.formatDocument", source: "preset" },
      { key: "cmd+p", command: "editor.triggerParameterHints", source: "preset" },
      { key: "cmd+q", command: "editor.showHover", source: "preset" },
      { key: "alt+enter", command: "editor.quickFix", source: "preset" },
      { key: "cmd+r", command: "workbench.showFindReplace", source: "preset" },
      { key: "cmd+shift+m", command: "editor.goToBracket", source: "preset" },
      { key: "alt+right", command: "workbench.nextTab", source: "preset" },
      { key: "alt+left", command: "workbench.previousTab", source: "preset" },
      { key: "alt+F12", command: "workbench.toggleTerminal", source: "preset" },
      { key: "alt+4", command: "workbench.toggleRun", source: "preset" },
      { key: "alt+5", command: "workbench.showDebugger", source: "preset" },
      { key: "alt+6", command: "workbench.toggleDiagnostics", source: "preset" },
      { key: "ctrl+F8", command: "debug.toggleBreakpoint", when: "editorFocus", source: "preset" },
      { key: "shift+F9", command: "debug.start", source: "preset" },
      { key: "ctrl+F2", command: "debug.stop", source: "preset" },
      { key: "shift+F10", command: "run.runContextConfiguration", source: "preset" },
      { key: "ctrl+shift+F10", command: "run.runContextConfiguration", source: "preset" },
      { key: "ctrl+alt+F11", command: "window.toggleFullscreen", source: "preset" },
      { key: "cmd+shift+-", command: "editor.foldAll", source: "preset" },
      { key: "cmd+shift+=", command: "editor.unfoldAll", source: "preset" },
    ],
  }),
  sublime: createPresetDefinition({
    label: "Sublime Text",
    description: "Match common Sublime Text shortcuts.",
    overrides: [
      { key: "cmd+shift+d", command: "editor.duplicateLine", source: "preset" },
      { key: "cmd+k cmd+b", command: "workbench.toggleSidebar", source: "preset" },
      { key: "cmd+shift+p", command: "workbench.commandPalette", source: "preset" },
      { key: "ctrl+g", command: "editor.goToLine", source: "preset" },
      { key: "cmd+shift+f", command: "workbench.showGlobalSearch", source: "preset" },
    ],
  }),
  xcode: createPresetDefinition({
    label: "Xcode",
    description: "Match common Xcode shortcuts.",
    overrides: [
      { key: "cmd+shift+a", command: "workbench.commandPalette", source: "preset" },
      { key: "cmd+shift+o", command: "file.quickOpen", source: "preset" },
      { key: "cmd+1", command: "workbench.showFileExplorer", source: "preset" },
      { key: "cmd+5", command: "workbench.toggleDiagnostics", source: "preset" },
      { key: "cmd+0", command: "workbench.toggleSidebar", source: "preset" },
      { key: "cmd+shift+f", command: "workbench.showGlobalSearch", source: "preset" },
      { key: "cmd+l", command: "editor.goToLine", source: "preset" },
    ],
  }),
  atom: createPresetDefinition({
    label: "Atom",
    description: "Match common Atom shortcuts.",
    overrides: [
      { key: "cmd+shift+p", command: "workbench.commandPalette", source: "preset" },
      { key: "cmd+\\", command: "workbench.toggleSidebar", source: "preset" },
      { key: "cmd+shift+f", command: "workbench.showGlobalSearch", source: "preset" },
      { key: "cmd+alt+f", command: "workbench.showFindReplace", source: "preset" },
      { key: "ctrl+`", command: "workbench.toggleTerminalAlt", source: "preset" },
      { key: "cmd+shift+d", command: "editor.duplicateLine", source: "preset" },
      { key: "ctrl+g", command: "editor.goToLine", source: "preset" },
    ],
  }),
  emacs: createPresetDefinition({
    label: "Emacs",
    description: "Match common Emacs shortcuts.",
    overrides: [
      { key: "alt+x", command: "workbench.commandPalette", source: "preset" },
      { key: "ctrl+x ctrl+f", command: "file.open", source: "preset" },
      { key: "ctrl+x ctrl+s", command: "file.save", source: "preset" },
      { key: "ctrl+x k", command: "file.close", source: "preset" },
      { key: "ctrl+/", command: "editor.undo", source: "preset" },
      { key: "alt+w", command: "editor.copy", source: "preset" },
      { key: "ctrl+w", command: "editor.cut", source: "preset" },
      { key: "ctrl+y", command: "editor.paste", source: "preset" },
      { key: "ctrl+s", command: "workbench.showFind", source: "preset" },
      { key: "alt+g g", command: "editor.goToLine", source: "preset" },
    ],
  }),
  zed: createPresetDefinition({
    label: "Zed",
    description: "Match common Zed shortcuts.",
    disabledCommands: ["workbench.toggleActivitySidebar"],
    overrides: [
      { key: "cmd+shift+p", command: "workbench.commandPalette", source: "preset" },
      { key: "cmd+p", command: "file.quickOpen", source: "preset" },
      { key: "cmd+shift+f", command: "workbench.showGlobalSearch", source: "preset" },
      { key: "cmd+b", command: "workbench.toggleSidebar", source: "preset" },
      { key: "cmd+j", command: "workbench.toggleTerminal", source: "preset" },
      { key: "cmd+shift+e", command: "workbench.showFileExplorer", source: "preset" },
      { key: "cmd+shift+g", command: "workbench.showSourceControl", source: "preset" },
    ],
  }),
};

export const keybindingPresetOptions = Object.entries(keybindingPresetDefinitions).map(
  ([value, definition]) => ({
    value: value as KeybindingPreset,
    label: definition.label,
  }),
);

export function isKeybindingPreset(value: string): value is KeybindingPreset {
  return value in keybindingPresetDefinitions;
}

export function getKeybindingPresetCoverageReport(
  preset: KeybindingPreset,
): KeybindingPresetCoverageReport {
  if (preset === "none") {
    return {
      coveredCommandIds: [],
      missingCommandIds: [],
      totalCommandCount: defaultPresetCommandIds.length,
      isComplete: true,
    };
  }

  const definition = keybindingPresetDefinitions[preset];
  const coveredCommandIds = defaultPresetCommandIds.filter(
    (commandId) =>
      definition.disabledCommands.includes(commandId) ||
      definition.overrides.some((binding) => binding.command === commandId),
  );
  const missingCommandIds = defaultPresetCommandIds.filter(
    (commandId) => !coveredCommandIds.includes(commandId),
  );

  return {
    coveredCommandIds,
    missingCommandIds,
    totalCommandCount: defaultPresetCommandIds.length,
    isComplete: missingCommandIds.length === 0,
  };
}

export function getKeybindingPresetDiffReport(
  preset: KeybindingPreset,
): KeybindingPresetDiffReport {
  if (preset === "none") {
    return {
      changedCommandIds: [],
      unchangedCommandIds: [...defaultPresetCommandIds],
    };
  }

  const definition = keybindingPresetDefinitions[preset];
  const changedCommandIds = defaultPresetCommandIds.filter((commandId) => {
    if (definition.disabledCommands.includes(commandId)) {
      return true;
    }

    const defaultBinding = defaultPresetBindings.get(commandId);
    const presetBinding = definition.overrides.find((binding) => binding.command === commandId);
    if (!defaultBinding || !presetBinding) {
      return false;
    }

    return (
      defaultBinding.key !== presetBinding.key ||
      defaultBinding.when !== presetBinding.when ||
      JSON.stringify(defaultBinding.args) !== JSON.stringify(presetBinding.args)
    );
  });

  return {
    changedCommandIds,
    unchangedCommandIds: defaultPresetCommandIds.filter(
      (commandId) => !changedCommandIds.includes(commandId),
    ),
  };
}

export function getKeybindingPresetDefinition(
  preset: KeybindingPreset,
): KeybindingPresetDefinition {
  return keybindingPresetDefinitions[preset] ?? keybindingPresetDefinitions.none;
}
