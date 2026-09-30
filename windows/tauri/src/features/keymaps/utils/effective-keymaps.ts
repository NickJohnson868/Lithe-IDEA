import { getKeybindingPresetDefinition } from "@/features/keymaps/defaults/keybinding-presets";
import type { Keybinding } from "@/features/keymaps/types/keymaps.types";
import type { Settings } from "@/features/settings/types/settings.types";

interface EffectiveKeybindingsInput {
  preset: Settings["keybindingPreset"];
  registryKeybindings: Keybinding[];
  userKeybindings: Keybinding[];
}

function getBaseKeybindingsForPreset(
  preset: Settings["keybindingPreset"],
  registryKeybindings: Keybinding[],
): Keybinding[] {
  const { overrides, disabledCommands } = getKeybindingPresetDefinition(preset);
  const disabledCommandIds = new Set(disabledCommands);
  const overriddenCommands = new Set(overrides.map((binding) => binding.command));
  // Keep every alias and context, and give the selected preset precedence over
  // inherited shortcuts that happen to use the same key.
  return [
    ...overrides,
    ...registryKeybindings.filter((binding) =>
      !disabledCommandIds.has(binding.command) && !overriddenCommands.has(binding.command)),
  ];
}

export function getEffectiveKeybindings({
  preset,
  registryKeybindings,
  userKeybindings,
}: EffectiveKeybindingsInput): Keybinding[] {
  const baseKeybindings = getBaseKeybindingsForPreset(preset, registryKeybindings);
  const userCommandIds = new Set(userKeybindings.map((binding) => binding.command));

  return [
    ...userKeybindings,
    ...baseKeybindings.filter((binding) => !userCommandIds.has(binding.command)),
  ];
}

export function getEffectiveKeybindingForCommand({
  commandId,
  preset,
  registryKeybindings,
  userKeybindings,
}: EffectiveKeybindingsInput & { commandId: string }): Keybinding | undefined {
  return getEffectiveKeybindings({
    preset,
    registryKeybindings,
    userKeybindings,
  }).find((binding) => binding.command === commandId);
}
