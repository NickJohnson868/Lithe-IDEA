import { describe, expect, test } from "bun:test";
import { SIDEBAR_BOTTOM_ACTIVITY_ITEM_IDS } from "@/features/layout/config/item-order";
import { defaultKeymaps } from "./default-keymaps";
import { getEffectiveKeybindingForCommand } from "../utils/effective-keymaps";

test("JetBrains Git shortcuts retain user overrides", () => {
  const base = {
    preset: "jetbrains" as const,
    registryKeybindings: defaultKeymaps,
    userKeybindings: [],
  };
  expect(getEffectiveKeybindingForCommand({ ...base, commandId: "git.commit" })?.key).toBe("cmd+k");
  expect(getEffectiveKeybindingForCommand({ ...base, commandId: "git.push" })?.key).toBe(
    "cmd+shift+k",
  );
  expect(getEffectiveKeybindingForCommand({ ...base, commandId: "git.update" })?.key).toBe("cmd+t");
  expect(getEffectiveKeybindingForCommand({ ...base, commandId: "git.newBranch" })?.key).toBe(
    "cmd+alt+n",
  );
  expect(
    getEffectiveKeybindingForCommand({
      ...base,
      commandId: "git.commit",
      userKeybindings: [{ key: "ctrl+alt+k", command: "git.commit", source: "user" }],
    })?.key,
  ).toBe("ctrl+alt+k");
});

describe("IDEA-style definition shortcuts", () => {
  test("binds Ctrl/Cmd+B to find references while the editor is focused", () => {
    expect(defaultKeymaps).toContainEqual({
      key: "cmd+b",
      command: "editor.goToReferences",
      source: "default",
      when: "editorFocus",
    });
  });

  test("keeps the activity sidebar toggle off the editor Ctrl/Cmd+B shortcut", () => {
    expect(defaultKeymaps).toContainEqual({
      key: "cmd+b",
      command: "workbench.toggleActivitySidebar",
      source: "default",
      when: "!editorFocus",
    });
  });
});

describe("Git Log workbench entry points", () => {
  test("binds the IntelliJ-compatible Alt+9 shortcut", () => {
    expect(defaultKeymaps).toContainEqual({
      key: "alt+9",
      command: "workbench.toggleGitLog",
      source: "default",
    });
  });

  test("places Git Log on the bottom activity rail above Settings", () => {
    expect(SIDEBAR_BOTTOM_ACTIVITY_ITEM_IDS.indexOf("run")).toBeLessThan(
      SIDEBAR_BOTTOM_ACTIVITY_ITEM_IDS.indexOf("gitLog"),
    );
    expect(SIDEBAR_BOTTOM_ACTIVITY_ITEM_IDS.indexOf("gitLog")).toBeLessThan(
      SIDEBAR_BOTTOM_ACTIVITY_ITEM_IDS.indexOf("settings"),
    );
  });
});
