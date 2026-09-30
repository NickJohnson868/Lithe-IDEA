import { expect, test } from "bun:test";
import { createStore } from "zustand/vanilla";
import { WorkspaceRuntimeRegistry } from "./workspace-runtime-registry";

test("lazy store reads notify observers after render and coalesce notifications", async () => {
  const registry = new WorkspaceRuntimeRegistry();
  registry.registerStore("test", () => createStore(() => ({ count: 0 })));
  let notifications = 0;
  const unsubscribe = registry.subscribe(() => { notifications++; });
  try {
    registry.getStore("test", "one");
    registry.getStore("test", "two");
    expect(notifications).toBe(0);
    await Promise.resolve();
    expect(notifications).toBe(1);
  } finally { unsubscribe(); }
});

test("deferred store registration still binds background observers", async () => {
  const registry = new WorkspaceRuntimeRegistry();
  registry.registerStore("test", () => createStore(() => ({ count: 0 })));
  let notifications = 0;
  const unsubscribe = registry.subscribeToStoreKey("test", () => { notifications++; });
  try {
    const store = registry.getStore<{ count: number }>("test", "one");
    await Promise.resolve();
    notifications = 0;
    store.setState({ count: 1 });
    expect(notifications).toBe(1);
    registry.removeWorkspace("one");
    notifications = 0;
    store.setState({ count: 2 });
    expect(notifications).toBe(0);
  } finally { unsubscribe(); }
});

test("unchanged workspace readiness does not wake every controller", () => {
  const registry = new WorkspaceRuntimeRegistry();
  registry.ensureWorkspace({ id: "one", name: "One" }, "ready");
  let notifications = 0;
  const unsubscribe = registry.subscribe(() => { notifications++; });
  try {
    registry.updateWorkspaceStatus("one", "ready");
    expect(notifications).toBe(0);
    registry.updateWorkspaceStatus("one", "error", "failed");
    expect(notifications).toBe(1);
  } finally { unsubscribe(); }
});
