import { afterAll, afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { installHappyDom } from "@/test-utils/happy-dom";

let nativeMenuBar = false;
let keybindingPreset: "none" | "jetbrains" = "none";

mock.module("@tauri-apps/plugin-os", () => ({
  arch: () => "x86_64",
  platform: () => "windows",
}));

const restoreDom = installHappyDom();
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

mock.module("@/features/settings/stores/settings.store", () => ({
  useSettingsStore: {
    getState: () => ({
      settings: {
        vimMode: false,
        nativeMenuBar,
        keybindingPreset,
      },
    }),
  },
}));
mock.module("@/features/window/stores/ui-state.store", () => ({
  useUIState: {
    getState: () => ({
      hasOpenModal: () => false,
      closeTopModal: () => undefined,
    }),
  },
}));

const { useKeymaps } = await import("./use-keymaps");
const { useKeymapStore } = await import("../stores/keymaps.store");
const { registerDefaultKeymaps } = await import("../defaults/register-defaults");
const { keymapRegistry } = await import("../utils/registry");

let root: Root;
let container: HTMLDivElement;

function Probe() {
  useKeymaps();
  return null;
}

beforeAll(async () => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(<Probe />);
  });
});

afterEach(() => {
  nativeMenuBar = false;
  keybindingPreset = "none";
  keymapRegistry.clear();
  useKeymapStore.getState().actions.resetToDefaults();
  useKeymapStore.getState().actions.setContexts({
    editorFocus: false,
    terminalFocus: false,
    isRecordingKeybinding: false,
  });
  document.body.querySelector(".monaco-editor")?.remove();
});

afterAll(async () => {
  await act(async () => {
    root.unmount();
  });
  restoreDom();
});

describe("keymap input routing", () => {
  test("IDEA common shortcuts dispatch once without legacy close, redo or chord interception", async () => {
    keybindingPreset = "jetbrains";
    const executed: string[] = [];
    const cases: [string, KeyboardEventInit][] = [
      ["editor.formatDocument", { key: "l", ctrlKey: true, altKey: true }],
      ["navigation.goBack", { key: "ArrowLeft", ctrlKey: true, altKey: true }],
      ["navigation.goForward", { key: "ArrowRight", ctrlKey: true, altKey: true }],
      ["editor.goToDefinition", { key: "b", ctrlKey: true }],
      ["editor.goToImplementation", { key: "b", ctrlKey: true, altKey: true }],
      ["editor.goToReferences", { key: "F7", altKey: true }],
      ["editor.goToReferences", { key: "F7", altKey: true, ctrlKey: true }],
      ["editor.expandSelection", { key: "w", ctrlKey: true }],
      ["editor.shrinkSelection", { key: "w", ctrlKey: true, shiftKey: true }],
      ["editor.duplicateLine", { key: "d", ctrlKey: true }],
      ["editor.deleteLine", { key: "y", ctrlKey: true }],
      ["editor.triggerParameterHints", { key: "p", ctrlKey: true }],
      ["editor.quickFix", { key: "Enter", altKey: true }],
      ["editor.renameSymbol", { key: "F6", shiftKey: true }],
      ["file.quickOpen", { key: "e", ctrlKey: true }],
      ["file.quickOpen", { key: "n", ctrlKey: true, shiftKey: true }],
      ["git.commit", { key: "k", ctrlKey: true }],
      ["git.update", { key: "t", ctrlKey: true }],
      ["file.saveAll", { key: "s", ctrlKey: true }],
      ["file.close", { key: "F4", ctrlKey: true }],
    ];
    for (const id of new Set([...cases.map(([id]) => id), "workbench.closeWindow", "editor.redo"])) {
      keymapRegistry.registerCommand({ id, title: id, execute: () => { executed.push(id); } });
    }
    registerDefaultKeymaps();
    const monaco = document.createElement("div");
    monaco.className = "monaco-editor";
    const input = document.createElement("textarea");
    input.className = "inputarea";
    monaco.append(input);
    document.body.append(monaco);
    input.focus();
    for (const [expected, init] of cases) {
      const before = executed.length;
      const event = new KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true });
      await act(async () => { input.dispatchEvent(event); });
      expect({ command: expected, prevented: event.defaultPrevented }).toEqual({ command: expected, prevented: true });
      expect(executed.slice(before)).toEqual([expected]);
    }
  });

  test("IDEA editing keys leave settings inputs alone", async () => {
    keybindingPreset = "jetbrains";
    const duplicate = mock(() => undefined);
    keymapRegistry.registerCommand({ id: "editor.duplicateLine", title: "Duplicate", execute: duplicate });
    registerDefaultKeymaps();
    const input = document.createElement("input");
    document.body.append(input);
    try {
      input.focus();
      const event = new KeyboardEvent("keydown", { key: "d", ctrlKey: true, bubbles: true, cancelable: true });
      await act(async () => { input.dispatchEvent(event); });
      expect(event.defaultPrevented).toBe(false);
      expect(duplicate).not.toHaveBeenCalled();
    } finally { input.remove(); }
  });

  test("routes Ctrl+Alt+L and the existing Shift+Alt+F alias to document formatting", async () => {
    const formatDocument = mock(() => undefined);
    keymapRegistry.registerCommand({
      id: "editor.formatDocument",
      title: "Format Document",
      execute: formatDocument,
    });
    registerDefaultKeymaps();

    const monaco = document.createElement("div");
    monaco.className = "monaco-editor";
    const editorInput = document.createElement("textarea");
    editorInput.className = "inputarea";
    monaco.append(editorInput);
    document.body.append(monaco);
    editorInput.focus();

    const event = new KeyboardEvent("keydown", {
      key: "l",
      code: "KeyL",
      ctrlKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      editorInput.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(formatDocument).toHaveBeenCalledTimes(1);

    const compatibilityEvent = new KeyboardEvent("keydown", {
      key: "f",
      code: "KeyF",
      shiftKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      editorInput.dispatchEvent(compatibilityEvent);
    });

    expect(compatibilityEvent.defaultPrevented).toBe(true);
    expect(formatDocument).toHaveBeenCalledTimes(2);
  });

  test("routes Ctrl+Alt+Left and Ctrl+Alt+Right to history navigation in the Monaco editor", async () => {
    const goBack = mock(() => undefined);
    const goForward = mock(() => undefined);
    const previousTab = mock(() => undefined);
    const nextTab = mock(() => undefined);
    keymapRegistry.registerCommand({
      id: "navigation.goBack",
      title: "Go Back",
      execute: goBack,
    });
    keymapRegistry.registerCommand({
      id: "navigation.goForward",
      title: "Go Forward",
      execute: goForward,
    });
    keymapRegistry.registerCommand({
      id: "workbench.previousTab",
      title: "Previous Tab",
      execute: previousTab,
    });
    keymapRegistry.registerCommand({
      id: "workbench.nextTab",
      title: "Next Tab",
      execute: nextTab,
    });
    registerDefaultKeymaps();

    const monaco = document.createElement("div");
    monaco.className = "monaco-editor";
    const editorInput = document.createElement("textarea");
    editorInput.className = "inputarea";
    monaco.append(editorInput);
    document.body.append(monaco);
    editorInput.focus();

    const goBackEvent = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      code: "ArrowLeft",
      ctrlKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      editorInput.dispatchEvent(goBackEvent);
    });

    expect(goBackEvent.defaultPrevented).toBe(true);
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(previousTab).not.toHaveBeenCalled();

    const goForwardEvent = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      code: "ArrowRight",
      ctrlKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      editorInput.dispatchEvent(goForwardEvent);
    });

    expect(goForwardEvent.defaultPrevented).toBe(true);
    expect(goForward).toHaveBeenCalledTimes(1);
    expect(nextTab).not.toHaveBeenCalled();
  });

  test("keeps history navigation in the frontend when the Windows native menu setting is enabled", async () => {
    nativeMenuBar = true;
    const goBack = mock(() => undefined);
    keymapRegistry.registerCommand({
      id: "navigation.goBack",
      title: "Go Back",
      execute: goBack,
    });
    registerDefaultKeymaps();

    const event = new KeyboardEvent("keydown", {
      key: "ArrowLeft",
      code: "ArrowLeft",
      ctrlKey: true,
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      document.body.dispatchEvent(event);
    });

    expect(event.defaultPrevented).toBe(true);
    expect(goBack).toHaveBeenCalledTimes(1);
  });

  test("leaves paste native in Monaco find input and routes it in the editor input area", async () => {
    const pasteIntoEditor = mock(() => undefined);
    keymapRegistry.registerCommand({
      id: "editor.paste",
      title: "Paste",
      execute: pasteIntoEditor,
    });
    keymapRegistry.registerKeybinding({
      key: "ctrl+v",
      command: "editor.paste",
      source: "default",
      when: "editorFocus",
    });
    await act(async () => {
      useKeymapStore.getState().actions.setContexts({ editorFocus: false });
    });

    const monaco = document.createElement("div");
    monaco.className = "monaco-editor";
    const findInput = document.createElement("input");
    monaco.append(findInput);
    document.body.append(monaco);
    findInput.focus();

    const findPaste = new KeyboardEvent("keydown", {
      key: "v",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      findInput.dispatchEvent(findPaste);
    });

    expect(findPaste.defaultPrevented).toBe(false);
    expect(pasteIntoEditor).not.toHaveBeenCalled();

    const editorInput = document.createElement("textarea");
    editorInput.className = "inputarea";
    monaco.append(editorInput);
    editorInput.focus();

    const editorPaste = new KeyboardEvent("keydown", {
      key: "v",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    await act(async () => {
      editorInput.dispatchEvent(editorPaste);
    });

    expect(editorPaste.defaultPrevented).toBe(true);
    expect(pasteIntoEditor).toHaveBeenCalledTimes(1);
  });
});
