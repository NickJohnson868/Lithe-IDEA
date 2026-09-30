import { expect, test } from "bun:test";
import type { CoreResponse } from "@/core/lithe-core-client";
import { executeContentSearch, CONTENT_SEARCH_TIMEOUT_MS } from "./content-search-operation";

test("a stuck IPC search times out, cancels Core and ignores its late reply", async () => {
  let release!: (value: CoreResponse<unknown>) => void;
  const reply = new Promise<CoreResponse<unknown>>((resolve) => {
    release = resolve;
  });
  let expire = () => {};
  let cleared = false;
  const cancelled: string[] = [];
  const operation = executeContentSearch(
    { id: "search-1", command: "workspace.search", payload: {} },
    undefined,
    {
      execute: async <T>(request: { timeoutMilliseconds?: number }) => {
        expect(request.timeoutMilliseconds).toBe(CONTENT_SEARCH_TIMEOUT_MS);
        return (await reply) as CoreResponse<T>;
      },
      cancel: async (id) => {
        cancelled.push(id);
        return true;
      },
      schedule: (callback) => {
        expire = callback;
        return () => {
          cleared = true;
        };
      },
    },
  );
  const outcome = operation.catch((error: Error & { code: string }) => error.code);
  try {
    await Promise.resolve();
    expire();
    expect(await outcome).toBe("timed_out");
    expect(cancelled).toEqual(["search-1"]);
    expect(cleared).toBe(true);
  } finally {
    release({ id: "search-1", ok: true, data: {} });
    await outcome;
  }
});

test("closing or replacing a search releases its timer and cancels only its operation", async () => {
  const abort = new AbortController();
  let release!: (value: CoreResponse<unknown>) => void;
  const reply = new Promise<CoreResponse<unknown>>((resolve) => {
    release = resolve;
  });
  let cleared = false;
  const cancelled: string[] = [];
  const operation = executeContentSearch(
    { id: "old-query", command: "workspace.search", payload: {} },
    abort.signal,
    {
      execute: async <T>() => (await reply) as CoreResponse<T>,
      cancel: async (id) => {
        cancelled.push(id);
        return true;
      },
      schedule: () => () => {
        cleared = true;
      },
    },
  );
  const outcome = operation.catch((error: Error & { code: string }) => error.code);
  try {
    await Promise.resolve();
    abort.abort();
    expect(await outcome).toBe("cancelled");
    expect(cleared).toBe(true);
    expect(cancelled).toEqual(["old-query"]);
  } finally {
    abort.abort();
    release({ id: "old-query", ok: true, data: {} });
    await outcome;
  }
});
